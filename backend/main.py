import os
import logging
import time
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, Depends, Header, HTTPException, Request, UploadFile
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from jose import JWTError, jwt
from sqlalchemy import inspect, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException as StarletteHTTPException
from schemas import (
    UserCreate,
    UserLogin,
    BookCreate,
    BookRequestCreate,
    BookRequestUpdate,
    MessageCreate
)
from fastapi import Query
from pydantic import ValidationError

import models
import crud

from database import engine, SessionLocal
from schemas import UserCreate, UserLogin
from auth import ALGORITHM, SECRET_KEY, verify_password, create_access_token

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

if load_dotenv:
    load_dotenv()

APP_NAME = os.getenv("APP_NAME", "NMS Bahrain BookX API")
APP_VERSION = os.getenv("APP_VERSION", "1.0.0")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
ENABLE_DB_INIT = os.getenv("ENABLE_DB_INIT", "true").lower() == "true"
ENABLE_DOCS = os.getenv("ENABLE_DOCS", "true").lower() == "true"
UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
MAX_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("nms-bookx")

app = FastAPI(
    title=APP_NAME,
    description="A school book exchange platform for NMS Bahrain students.",
    version=APP_VERSION,
    docs_url="/docs" if ENABLE_DOCS else None,
    redoc_url="/redoc" if ENABLE_DOCS else None,
)

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if origin.strip()
]

frontend_url = os.getenv("FRONTEND_URL", "").strip()
if frontend_url and frontend_url not in allowed_origins:
    allowed_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


def initialize_database():
    models.Base.metadata.create_all(bind=engine)

    if "created_at" not in {
        column["name"] for column in inspect(engine).get_columns("messages")
    }:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE messages "
                    "ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"
                )
            )

    if "created_at" not in {
        column["name"] for column in inspect(engine).get_columns("book_requests")
    }:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE book_requests "
                    "ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"
                )
            )

    if "image_url" not in {
        column["name"] for column in inspect(engine).get_columns("books")
    }:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE books "
                    "ADD COLUMN image_url VARCHAR(500)"
                )
            )


@app.on_event("startup")
def startup_event():
    if not ENABLE_DB_INIT:
        logger.info("Database initialization skipped.")
        return

    try:
        initialize_database()
        logger.info("Database initialization complete.")
    except Exception:
        logger.exception("Database initialization failed.")
        if ENVIRONMENT == "production":
            raise


@app.middleware("http")
async def add_request_logging(request: Request, call_next):
    start_time = time.perf_counter()

    try:
        response = await call_next(request)
    except Exception:
        logger.exception("Unhandled request error on %s", request.url.path)
        return JSONResponse(
            status_code=500,
            content={"detail": "An unexpected server error occurred."},
        )

    duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
    response.headers["X-Process-Time-ms"] = str(duration_ms)
    logger.info(
        "%s %s completed with %s in %sms",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning("Validation error on %s: %s", request.url.path, exc.errors())
    return JSONResponse(
        status_code=422,
        content={
            "detail": "Request validation failed.",
            "errors": jsonable_encoder(exc.errors()),
        },
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    logger.warning("HTTP error on %s: %s", request.url.path, exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


@app.exception_handler(SQLAlchemyError)
async def database_exception_handler(request: Request, exc: SQLAlchemyError):
    logger.exception("Database error on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=503,
        content={"detail": "Database is unavailable. Please check the backend database configuration."},
    )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_admin(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db)
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required.")

    try:
        payload = jwt.decode(
            authorization.removeprefix("Bearer ").strip(),
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")

    user = crud.get_user_by_email(db, payload.get("sub"))

    if not user or user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")

    return user


async def save_book_image(image: UploadFile | None) -> str | None:
    if not image or not image.filename:
        return None

    extension = ALLOWED_IMAGE_TYPES.get(image.content_type or "")
    if not extension:
        raise HTTPException(
            status_code=400,
            detail="Book image must be a JPG, PNG, or WEBP file."
        )

    content = await image.read()
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=400,
            detail="Book image must be 5MB or smaller."
        )

    file_name = f"{uuid4().hex}{extension}"
    file_path = UPLOAD_DIR / file_name
    file_path.write_bytes(content)

    return f"/uploads/{file_name}"


async def parse_book_create_request(request: Request) -> BookCreate:
    content_type = request.headers.get("content-type", "")

    if content_type.startswith("multipart/form-data"):
        form = await request.form()
        image = form.get("image")
        image_url = await save_book_image(image if hasattr(image, "filename") else None)
        raw_data = {
            "title": form.get("title"),
            "subject": form.get("subject"),
            "grade": form.get("grade"),
            "condition": form.get("condition"),
            "description": form.get("description"),
            "is_syllabus_book": form.get("is_syllabus_book"),
            "owner_id": form.get("owner_id"),
            "image_url": image_url,
        }
    else:
        raw_data = await request.json()

    try:
        return BookCreate.model_validate(raw_data)
    except ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail=jsonable_encoder(exc.errors())
        )


@app.get("/")
def home():
    return {
        "app": APP_NAME,
        "version": APP_VERSION,
        "environment": ENVIRONMENT,
        "status": "running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "app": APP_NAME,
        "version": APP_VERSION,
        "environment": ENVIRONMENT
    }


@app.get("/test-db")
def test_database():
    with engine.connect() as connection:
        result = connection.execute(text("SELECT DATABASE();"))
        database_name = result.scalar()

    return {
        "message": "Database connected successfully",
        "database": database_name
    }


@app.post("/register")
def register_user(user: UserCreate, db: Session = Depends(get_db)):

    if user.accepted_terms == False:
        raise HTTPException(
            status_code=400,
            detail="You must accept the Terms & Conditions."
        )

    if not user.email.endswith("@nmsedu.bh"):
        raise HTTPException(
            status_code=400,
            detail="Only NMS Bahrain school email addresses are allowed."
        )

    existing_user = crud.get_user_by_email(db, user.email)

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="This email is already registered."
        )

    created_user = crud.create_user(db, user)

    return {
        "message": "User registered successfully",
        "user": {
            "id": created_user.id,
            "name": created_user.name,
            "email": created_user.email,
            "grade": created_user.grade,
            "section": created_user.section,
            "role": created_user.role,
            "trust_points": created_user.trust_points
        }
    }


@app.post("/login")
def login_user(user: UserLogin, db: Session = Depends(get_db)):

    existing_user = crud.get_user_by_email(db, user.email)

    if not existing_user:
        raise HTTPException(
            status_code=404,
            detail="User not found."
        )

    password_matches = verify_password(
        user.password,
        existing_user.password
    )

    if not password_matches:
        raise HTTPException(
            status_code=401,
            detail="Incorrect password."
        )

    token = create_access_token(
        {
            "sub": existing_user.email
        }
    )

    return {
        "message": "Login successful",
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": existing_user.id,
            "name": existing_user.name,
            "email": existing_user.email,
            "grade": existing_user.grade,
            "section": existing_user.section,
            "role": existing_user.role,
            "trust_points": existing_user.trust_points
        }
    }


@app.get("/profile/{user_id}")
def get_profile(
    user_id: int,
    db: Session = Depends(get_db)
):

    user = crud.get_user_by_id(
        db,
        user_id
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found."
        )

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "grade": user.grade,
        "section": user.section,
        "role": user.role,
        "trust_points": user.trust_points
    }

@app.post("/books")
async def create_book(
    request: Request,
    db: Session = Depends(get_db)
):
    book = await parse_book_create_request(request)

    if not book.is_syllabus_book:
        raise HTTPException(
            status_code=400,
            detail="Only school syllabus books are allowed."
        )

    created_book = crud.create_book(
        db,
        book
    )

    return {
        "message": "Book created successfully",
        "book": {
            "id": created_book.id,
            "title": created_book.title,
            "subject": created_book.subject,
            "grade": created_book.grade,
            "condition": created_book.condition,
            "description": created_book.description,
            "status": created_book.status,
            "owner_id": created_book.owner_id,
            "image_url": created_book.image_url
        }
    }

@app.get("/books")
def get_books(
    db: Session = Depends(get_db)
):

    books = crud.get_all_books(db)

    return books

@app.get("/books/search")
def search_books(
    keyword: str = Query(...),
    db: Session = Depends(get_db)
):

    books = crud.search_books(
        db,
        keyword
    )

    return books

@app.post("/requests")
def request_book(
    request: BookRequestCreate,
    db: Session = Depends(get_db)
):

    book = crud.get_book_by_id(
        db,
        request.book_id
    )

    if not book:
        raise HTTPException(
            status_code=404,
            detail="Book not found."
        )

    if book.status == "reserved":
        raise HTTPException(
            status_code=400,
            detail="This book has already been reserved."
        )

    existing = crud.existing_request(
        db,
        request.book_id,
        request.requester_id
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail="You have already requested this book."
        )

    created_request = crud.create_book_request(
        db,
        request
    )

    return {
        "message": "Book request created",
        "request_id": created_request.id,
        "status": created_request.status
    }

@app.get("/requests")
def get_all_requests(
    db: Session = Depends(get_db)
):
    requests = crud.get_all_requests(db)
    return requests


@app.get("/requests/book/{book_id}")
def get_requests_for_book(
    book_id: int,
    db: Session = Depends(get_db)
):
    requests = crud.get_requests_by_book(
        db,
        book_id
    )

    return requests


@app.get("/requests/user/{requester_id}")
def get_requests_for_user(
    requester_id: int,
    db: Session = Depends(get_db)
):
    requests = db.query(
        models.BookRequest,
        models.Book,
        models.User
    ).join(
        models.Book,
        models.BookRequest.book_id == models.Book.id
    ).join(
        models.User,
        models.Book.owner_id == models.User.id
    ).filter(
        models.BookRequest.requester_id == requester_id
    ).order_by(
        models.BookRequest.created_at.desc()
    ).all()

    return [
        {
            "id": request.id,
            "book_id": book.id,
            "book_title": book.title,
            "owner_id": owner.id,
            "owner_name": owner.name,
            "request_date": request.created_at,
            "status": request.status
        }
        for request, book, owner in requests
    ]


@app.get("/books/owner/{owner_id}/requests")
def get_owner_books_with_requests(
    owner_id: int,
    db: Session = Depends(get_db)
):
    books = db.query(models.Book).filter(
        models.Book.owner_id == owner_id
    ).order_by(models.Book.id.desc()).all()

    result = []

    for book in books:
        incoming = db.query(
            models.BookRequest,
            models.User
        ).join(
            models.User,
            models.BookRequest.requester_id == models.User.id
        ).filter(
            models.BookRequest.book_id == book.id
        ).order_by(
            models.BookRequest.created_at.desc()
        ).all()

        result.append({
            "id": book.id,
            "title": book.title,
            "subject": book.subject,
            "grade": book.grade,
            "image_url": book.image_url,
            "status": book.status,
            "requests": [
                {
                    "id": request.id,
                    "requester_id": requester.id,
                    "requester_name": requester.name,
                    "request_date": request.created_at,
                    "status": request.status
                }
                for request, requester in incoming
            ]
        })

    return result

@app.put("/requests/{request_id}")
def update_request(
    request_id: int,
    request_update: BookRequestUpdate,
    db: Session = Depends(get_db)
):

    if request_update.status not in ["approved", "rejected"]:
        raise HTTPException(
            status_code=400,
            detail="Status must be approved or rejected."
        )

    updated_request = crud.update_request_status(
        db,
        request_id,
        request_update.status
    )

    if not updated_request:
        raise HTTPException(
            status_code=404,
            detail="Request not found."
        )

    return {
        "message": "Request status updated",
        "request": {
            "id": updated_request.id,
            "book_id": updated_request.book_id,
            "requester_id": updated_request.requester_id,
            "status": updated_request.status
        }
    }

@app.get("/leaderboard")
def trust_leaderboard(
    db: Session = Depends(get_db)
):

    users = db.query(models.User).order_by(
        models.User.trust_points.desc()
    ).all()

    return [
        {
            "id": user.id,
            "name": user.name,
            "grade": user.grade,
            "section": user.section,
            "trust_points": user.trust_points
        }
        for user in users
    ]


@app.get("/admin/stats")
def admin_stats(
    db: Session = Depends(get_db),
    _admin: models.User = Depends(get_current_admin)
):
    return {
        "total_users": db.query(models.User).count(),
        "total_books": db.query(models.Book).count(),
        "total_requests": db.query(models.BookRequest).count(),
        "total_messages": db.query(models.Message).count(),
        "available_books": db.query(models.Book).filter(
            models.Book.status == "available"
        ).count(),
        "reserved_books": db.query(models.Book).filter(
            models.Book.status == "reserved"
        ).count(),
        "pending_requests": db.query(models.BookRequest).filter(
            models.BookRequest.status == "pending"
        ).count(),
        "approved_requests": db.query(models.BookRequest).filter(
            models.BookRequest.status == "approved"
        ).count()
    }

@app.delete("/requests/{request_id}")
def cancel_request(
    request_id: int,
    db: Session = Depends(get_db)
):

    request = db.query(models.BookRequest).filter(
        models.BookRequest.id == request_id
    ).first()

    if not request:
        raise HTTPException(
            status_code=404,
            detail="Request not found."
        )

    if request.status != "pending":
        raise HTTPException(
            status_code=400,
            detail="Only pending requests can be cancelled."
        )

    db.delete(request)
    db.commit()

    return {
        "message": "Request cancelled successfully"
    }

@app.get("/dashboard/{user_id}")
def user_dashboard(
    user_id: int,
    db: Session = Depends(get_db)
):

    user = crud.get_user_by_id(
        db,
        user_id
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found."
        )

    books_posted = crud.count_books_by_user(
        db,
        user_id
    )

    books_requested = crud.count_requests_by_user(
        db,
        user_id
    )

    books_approved = db.query(models.BookRequest).filter(
        models.BookRequest.requester_id == user_id,
        models.BookRequest.status == "approved"
    ).count()

    return {
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "grade": user.grade,
        "section": user.section,
        "books_posted": books_posted,
        "books_requested": books_requested,
        "books_approved": books_approved,
        "trust_points": user.trust_points
    }


@app.get("/notifications/{user_id}")
def get_notifications(
    user_id: int,
    db: Session = Depends(get_db)
):
    notifications = []

    request_updates = db.query(
        models.BookRequest,
        models.Book
    ).join(
        models.Book,
        models.BookRequest.book_id == models.Book.id
    ).filter(
        models.BookRequest.requester_id == user_id,
        models.BookRequest.status.in_(["approved", "rejected"])
    ).all()

    for request, book in request_updates:
        notifications.append({
            "id": f"request-update-{request.id}",
            "type": f"book_{request.status}",
            "title": f"Book request {request.status}",
            "message": f'Your request for "{book.title}" was {request.status}.',
            "created_at": request.created_at,
            "is_unread": True
        })

    incoming_requests = db.query(
        models.BookRequest,
        models.Book,
        models.User
    ).join(
        models.Book,
        models.BookRequest.book_id == models.Book.id
    ).join(
        models.User,
        models.BookRequest.requester_id == models.User.id
    ).filter(
        models.Book.owner_id == user_id,
        models.BookRequest.status == "pending"
    ).all()

    for request, book, requester in incoming_requests:
        notifications.append({
            "id": f"incoming-request-{request.id}",
            "type": "new_request",
            "title": "New book request",
            "message": f'{requester.name} requested "{book.title}".',
            "created_at": request.created_at,
            "is_unread": True
        })

    unread_messages = db.query(
        models.Message,
        models.User
    ).join(
        models.User,
        models.Message.sender_id == models.User.id
    ).filter(
        models.Message.receiver_id == user_id,
        models.Message.is_read == 0
    ).all()

    for message, sender in unread_messages:
        notifications.append({
            "id": f"message-{message.id}",
            "type": "new_message",
            "title": "New message",
            "message": f"{sender.name}: {message.message_text}",
            "created_at": message.created_at,
            "is_unread": True
        })

    notifications.sort(
        key=lambda item: item["created_at"].isoformat() if item["created_at"] else "",
        reverse=True
    )

    return {
        "unread_count": len(notifications),
        "notifications": notifications
    }

@app.post("/messages")
def send_message(
    message_data: MessageCreate,
    db: Session = Depends(get_db)
):

    if message_data.sender_id == message_data.receiver_id:

        raise HTTPException(
            status_code=400,
            detail="You cannot send messages to yourself."
        )

    created_message = crud.create_message(
        db,
        message_data
    )

    return {
        "message": "Message sent successfully",
        "message_id": created_message.id
    }

@app.get("/messages/conversation")
def get_conversation(
    user1_id: int,
    user2_id: int,
    db: Session = Depends(get_db)
):

    messages = crud.get_conversation(
        db,
        user1_id,
        user2_id
    )

    return messages

@app.get("/messages/users/{user_id}")
def get_message_users(
    user_id: int,
    db: Session = Depends(get_db)
):

    users = crud.get_chat_users(
        db,
        user_id
    )

    return users

@app.get("/messages/preview")
def get_last_message(
    user1_id: int,
    user2_id: int,
    db: Session = Depends(get_db)
):

    message = crud.get_last_message_between_users(
        db,
        user1_id,
        user2_id
    )

    if not message:
        return {
            "message": "No messages found"
        }

    return {
        "message_id": message.id,
        "sender_id": message.sender_id,
        "receiver_id": message.receiver_id,
        "message_text": message.message_text,
        "created_at": message.created_at
    }

@app.get("/messages/unread/{user_id}")
def unread_count(
    user_id: int,
    db: Session = Depends(get_db)
):

    count = crud.get_unread_count(
        db,
        user_id
    )

    return {
        "user_id": user_id,
        "unread_messages": count
    }

@app.put("/messages/read/{message_id}")
def mark_read(
    message_id: int,
    db: Session = Depends(get_db)
):

    message = crud.mark_message_read(
        db,
        message_id
    )

    if not message:
        raise HTTPException(
            status_code=404,
            detail="Message not found."
        )

    return {
        "message": "Marked as read"
    }

@app.delete("/messages/{message_id}")
def delete_message(
    message_id: int,
    db: Session = Depends(get_db)
):

    message = crud.delete_message(
        db,
        message_id
    )

    if not message:
        raise HTTPException(
            status_code=404,
            detail="Message not found."
        )

    return {
        "message": "Message deleted successfully"
    }

@app.get("/messages/summary/{user_id}")
def dm_summary(
    user_id: int,
    db: Session = Depends(get_db)
):

    summary = crud.get_dm_summary(
        db,
        user_id
    )

    return summary

@app.put("/messages/read-conversation")
def read_conversation(
    current_user_id: int,
    other_user_id: int,
    db: Session = Depends(get_db)
):

    updated_count = crud.mark_conversation_as_read(
        db,
        current_user_id,
        other_user_id
    )

    return {
        "message": "Conversation marked as read",
        "messages_updated": updated_count
    }
