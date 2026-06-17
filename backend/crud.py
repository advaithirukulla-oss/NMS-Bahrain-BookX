from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from models import (
    User,
    Book,
    BookRequest,
    Message
)
from auth import hash_password


def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()


def get_user_by_id(db: Session, user_id: int):
    return db.query(User).filter(User.id == user_id).first()


def create_user(db: Session, user_data):
    new_user = User(
        name=user_data.name,
        email=user_data.email,
        grade=user_data.grade,
        section=user_data.section,
        password=hash_password(user_data.password),
        role="student",
        trust_points=0
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user

def create_book(db: Session, book_data):

    new_book = Book(
        title=book_data.title,
        subject=book_data.subject,
        grade=book_data.grade,
        condition=book_data.condition,
        description=book_data.description,
        is_syllabus_book=book_data.is_syllabus_book,
        owner_id=book_data.owner_id,
        image_url=book_data.image_url
    )

    db.add(new_book)
    db.commit()
    db.refresh(new_book)

    return new_book

def get_all_books(db: Session):

    return db.query(Book).all()

def search_books(db: Session, keyword: str):

    return db.query(Book).filter(
        or_(
            Book.title.ilike(f"%{keyword}%"),
            Book.subject.ilike(f"%{keyword}%")
        )
    ).all()

def create_book_request(
    db: Session,
    request_data
):

    new_request = BookRequest(
        book_id=request_data.book_id,
        requester_id=request_data.requester_id
    )

    db.add(new_request)
    db.commit()
    db.refresh(new_request)

    return new_request

def get_all_requests(db: Session):
    return db.query(BookRequest).all()


def get_requests_by_book(db: Session, book_id: int):
    return db.query(BookRequest).filter(
        BookRequest.book_id == book_id
    ).all()


def get_requests_by_user(db: Session, requester_id: int):
    return db.query(BookRequest).filter(
        BookRequest.requester_id == requester_id
    ).all()

def update_request_status(
    db: Session,
    request_id: int,
    status: str
):

    request = db.query(BookRequest).filter(
        BookRequest.id == request_id
    ).first()

    if request:

        previous_status = request.status
        request.status = status

        if status == "approved" and previous_status != "approved":

            book = db.query(Book).filter(
                Book.id == request.book_id
            ).first()

            if book:

                book.status = "reserved"

                db.query(BookRequest).filter(
                    BookRequest.book_id == book.id,
                    BookRequest.id != request.id,
                    BookRequest.status == "pending"
                ).update({"status": "rejected"})

                owner = db.query(User).filter(
                    User.id == book.owner_id
                ).first()

                if owner:
                    owner.trust_points += 10

        db.commit()
        db.refresh(request)

    return request

def update_book_status(
    db: Session,
    book_id: int,
    status: str
):

    book = db.query(Book).filter(
        Book.id == book_id
    ).first()

    if book:
        book.status = status
        db.commit()
        db.refresh(book)

    return book

def add_trust_points(
    db: Session,
    user_id: int,
    points: int
):

    user = db.query(User).filter(
        User.id == user_id
    ).first()

    if user:
        user.trust_points += points

        db.commit()
        db.refresh(user)

    return user

def existing_request(
    db: Session,
    book_id: int,
    requester_id: int
):

    return db.query(BookRequest).filter(
        BookRequest.book_id == book_id,
        BookRequest.requester_id == requester_id
    ).first()

def delete_request(
    db: Session,
    request_id: int
):

    request = db.query(BookRequest).filter(
        BookRequest.id == request_id
    ).first()

    if request:
        db.delete(request)
        db.commit()

    return request

def get_book_by_id(
    db: Session,
    book_id: int
):

    return db.query(Book).filter(
        Book.id == book_id
    ).first()

def count_books_by_user(
    db: Session,
    user_id: int
):

    return db.query(Book).filter(
        Book.owner_id == user_id
    ).count()


def count_requests_by_user(
    db: Session,
    user_id: int
):

    return db.query(BookRequest).filter(
        BookRequest.requester_id == user_id
    ).count()

def create_message(
    db: Session,
    message_data
):

    new_message = Message(
        sender_id=message_data.sender_id,
        receiver_id=message_data.receiver_id,
        message_text=message_data.message_text
    )

    db.add(new_message)

    db.commit()

    db.refresh(new_message)

    return new_message

def get_conversation(
    db: Session,
    user1_id: int,
    user2_id: int
):

    return db.query(Message).filter(

        or_(

            and_(
                Message.sender_id == user1_id,
                Message.receiver_id == user2_id
            ),

            and_(
                Message.sender_id == user2_id,
                Message.receiver_id == user1_id
            )

        )

    ).order_by(
        Message.id.asc()
    ).all()

def get_chat_users(
    db: Session,
    user_id: int
):

    messages = db.query(Message).filter(
        or_(
            Message.sender_id == user_id,
            Message.receiver_id == user_id
        )
    ).all()

    chat_user_ids = set()

    for msg in messages:

        if msg.sender_id == user_id:
            chat_user_ids.add(msg.receiver_id)
        else:
            chat_user_ids.add(msg.sender_id)

    chat_users = db.query(User).filter(
        User.id.in_(chat_user_ids)
    ).all()

    return chat_users

def get_last_message_between_users(
    db: Session,
    user1_id: int,
    user2_id: int
):

    return db.query(Message).filter(

        or_(

            and_(
                Message.sender_id == user1_id,
                Message.receiver_id == user2_id
            ),

            and_(
                Message.sender_id == user2_id,
                Message.receiver_id == user1_id
            )

        )

    ).order_by(
        Message.id.desc()
    ).first()

def get_unread_count(
    db: Session,
    user_id: int
):

    return db.query(Message).filter(
        Message.receiver_id == user_id,
        Message.is_read == 0
    ).count()

def mark_message_read(
    db: Session,
    message_id: int
):

    message = db.query(Message).filter(
        Message.id == message_id
    ).first()

    if message:

        message.is_read = 1

        db.commit()

        db.refresh(message)

    return message

def delete_message(
    db: Session,
    message_id: int
):

    message = db.query(Message).filter(
        Message.id == message_id
    ).first()

    if message:
        db.delete(message)
        db.commit()

    return message

def get_dm_summary(
    db: Session,
    user_id: int
):

    chat_users = get_chat_users(
        db,
        user_id
    )

    summary = []

    for chat_user in chat_users:

        last_message = get_last_message_between_users(
            db,
            user_id,
            chat_user.id
        )

        unread_count = db.query(Message).filter(
            Message.sender_id == chat_user.id,
            Message.receiver_id == user_id,
            Message.is_read == 0
        ).count()

        summary.append({
            "user_id": chat_user.id,
            "name": chat_user.name,
            "email": chat_user.email,
            "grade": chat_user.grade,
            "section": chat_user.section,
            "last_message": last_message.message_text if last_message else "",
            "last_message_id": last_message.id if last_message else None,
            "last_message_created_at": last_message.created_at if last_message else None,
            "unread_count": unread_count
        })

    return sorted(
        summary,
        key=lambda item: item["last_message_created_at"] or "",
        reverse=True
    )

def mark_conversation_as_read(
    db: Session,
    current_user_id: int,
    other_user_id: int
):

    unread_messages = db.query(Message).filter(
        Message.sender_id == other_user_id,
        Message.receiver_id == current_user_id,
        Message.is_read == 0
    ).all()

    for message in unread_messages:
        message.is_read = 1

    db.commit()

    return len(unread_messages)
