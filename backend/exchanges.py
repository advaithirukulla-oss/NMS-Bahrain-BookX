"""Exchange transitions share one book lock and one transaction.

The no-op UPDATE takes an InnoDB row lock (and a SQLite writer lock in tests).
All state is reread with locking reads after acquiring it, avoiding stale
REPEATABLE READ snapshots. Never commit between checking and transitioning.
"""
from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy import update
from models import Book, BookRequest, User


def now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def lock_book(db, book_id):
    db.execute(update(Book).where(Book.id == book_id).values(status=Book.status))
    book = db.query(Book).filter_by(id=book_id).populate_existing().with_for_update().first()
    if not book:
        raise HTTPException(404, "Book not found.")
    return book


def create_request(db, book_id, user_id):
    book = lock_book(db, book_id)
    if book.owner_id == user_id:
        raise HTTPException(400, "You cannot request your own book.")
    if book.status != "available":
        raise HTTPException(400, "This book is no longer available.")
    prior = db.query(BookRequest).filter(
        BookRequest.book_id == book_id, BookRequest.requester_id == user_id,
        BookRequest.status != "cancelled",
    ).with_for_update().first()
    if prior:
        raise HTTPException(400, "You have already requested this book.")
    request = BookRequest(book_id=book_id, requester_id=user_id)
    db.add(request)
    db.commit()
    db.refresh(request)
    return request


def transition(db, request_id, user_id, action):
    book_id = db.query(BookRequest.book_id).filter_by(id=request_id).scalar()
    if book_id is None:
        raise HTTPException(404, "Request not found.")
    book = lock_book(db, book_id)
    request = db.query(BookRequest).filter_by(id=request_id).populate_existing().with_for_update().first()
    if not request:
        raise HTTPException(404, "Request not found.")
    actor = request.requester_id if action == "cancelled" else book.owner_id
    if actor != user_id:
        raise HTTPException(403, "Only the requester can cancel." if action == "cancelled" else "Only the book owner can make this decision.")
    required = "approved" if action == "completed" else "pending"
    if request.status != required:
        raise HTTPException(400, f"Only {required} requests permit this action.")
    timestamp = now()
    if action == "approved":
        if book.status != "available":
            raise HTTPException(409, "This book is already reserved or given.")
        # Also protect legacy inconsistent rows without rewriting them.
        conflict = db.query(BookRequest.id).filter(
            BookRequest.book_id == book.id, BookRequest.id != request.id,
            BookRequest.status.in_(["approved", "completed"]),
        ).with_for_update().first()
        if conflict:
            raise HTTPException(409, "Another exchange already holds this book.")
        book.status = "reserved"
        request.accepted_at = timestamp
        db.execute(update(User).where(User.id == book.owner_id).values(trust_points=User.trust_points + 10))
    elif action == "completed":
        if book.status != "reserved":
            raise HTTPException(409, "Only a reserved book can be handed over.")
        book.status = "given"
        request.completed_at = timestamp
    elif action == "rejected":
        request.declined_at = timestamp
    elif action == "cancelled":
        request.cancelled_at = timestamp
    else:
        raise HTTPException(400, "Unknown exchange action.")
    if action in ("approved", "completed"):
        db.execute(update(BookRequest).where(
            BookRequest.book_id == book.id, BookRequest.id != request.id,
            BookRequest.status == "pending",
        ).values(status="rejected", declined_at=timestamp))
    request.status = action
    db.commit()
    db.refresh(request)
    return request


def event_times(request):
    return {name: getattr(request, name) for name in (
        "accepted_at", "declined_at", "cancelled_at", "completed_at"
    )}


def timeline(request):
    events = [{"status": "pending", "at": request.created_at}]
    for status, field in (("approved", "accepted_at"), ("rejected", "declined_at"),
                          ("cancelled", "cancelled_at"), ("completed", "completed_at")):
        value = getattr(request, field)
        if value:
            events.append({"status": status, "at": value})
    return events
