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
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException as StarletteHTTPException
from schemas import (
    UserCreate,
    UserLogin,
    UserProfileUpdate,
    BookCreate,
    BookRequestCreate,
    BookRequestUpdate,
    MessageCreate,
    ReportCreate,
    ModerationUpdate,
    AccountStatusUpdate,
    BookModerationUpdate,
    REPORT_BOOK_REASONS,
    REPORT_USER_REASONS,
)
from fastapi import Query
from pydantic import ValidationError

import models
import crud
import exchanges
import smart
from exchange_migration import migrate_exchange_timestamps

from database import engine, SessionLocal
from schemas import UserCreate, UserLogin
from auth import ALGORITHM, SECRET_KEY, INSECURE_DEFAULT_SECRET, verify_password, create_access_token

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

if load_dotenv:
    load_dotenv()

APP_NAME = os.getenv("APP_NAME", "BookSpins API")
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
    description="BookSpins is the school book exchange platform for NMS Bahrain students.",
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

# Keep the production origins available even if an environment variable was
# accidentally left on its local-development default.  Extra origins can still
# be supplied through CORS_ORIGINS.
for origin in (
    "https://bookspins.com",
    "https://www.bookspins.com",
    "https://bookspins-frontend.onrender.com",
):
    if origin not in allowed_origins:
        allowed_origins.append(origin)

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
    migrate_exchange_timestamps(engine)

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

    additive_columns = {
        "users": ("account_status", "VARCHAR(20) NOT NULL DEFAULT 'active'"),
        "books": ("moderation_status", "VARCHAR(20) NOT NULL DEFAULT 'active'"),
    }
    for table_name, (column_name, definition) in additive_columns.items():
        if column_name not in {column["name"] for column in inspect(engine).get_columns(table_name)}:
            with engine.begin() as connection:
                connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}"))


@app.on_event("startup")
def startup_event():
    if ENVIRONMENT == "production" and SECRET_KEY == INSECURE_DEFAULT_SECRET:
        raise RuntimeError("SECRET_KEY must be configured in production.")
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
    if request.url.path.startswith("/smart/"):
        logger.warning("Smart input validation failed on %s", request.url.path)
        return JSONResponse(status_code=422, content={"detail": "Check your input: query and notes must be 500 characters or fewer; only supported text fields are accepted."})
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
        headers=exc.headers,
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

    if not user or user.role != "admin" or user.account_status != "active":
        raise HTTPException(status_code=403, detail="Admin access required.")

    return user


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required.")

    try:
        payload = jwt.decode(
            authorization.removeprefix("Bearer ").strip(),
            SECRET_KEY,
            algorithms=[ALGORITHM],
        )
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")

    email = payload.get("sub")
    user = crud.get_user_by_email(db, email) if email else None
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")

    return user


def ensure_active(user: models.User):
    if user.account_status != "active":
        raise HTTPException(status_code=403, detail="This account is suspended. Please contact a school administrator.")


def users_are_blocked(db: Session, first_id: int, second_id: int) -> bool:
    return db.query(models.UserBlock).filter(
        ((models.UserBlock.blocker_id == first_id) & (models.UserBlock.blocked_id == second_id))
        | ((models.UserBlock.blocker_id == second_id) & (models.UserBlock.blocked_id == first_id))
    ).first() is not None


def audit(db: Session, admin_id: int, action: str, target_type: str, target_id: int, metadata: str | None = None):
    db.add(models.AdminAuditLog(admin_user_id=admin_id, action_type=action, target_type=target_type,
                                target_id=target_id, metadata_json=metadata))


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

    image_headers = {
        ".jpg": (b"\xff\xd8\xff",),
        ".png": (b"\x89PNG\r\n\x1a\n",),
        ".webp": (b"RIFF",),
    }
    if not any(content.startswith(header) for header in image_headers[extension]):
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid image.")
    if extension == ".webp" and content[8:12] != b"WEBP":
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid WEBP image.")

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
        "release": "2.4",
        "app": APP_NAME,
        "version": APP_VERSION,
        "environment": ENVIRONMENT
    }


@app.get("/test-db")
def test_database(_admin: models.User = Depends(get_current_admin)):
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
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.id != user_id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="You can only view your own profile.")

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
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ensure_active(current_user)
    book = await parse_book_create_request(request)
    book.owner_id = current_user.id

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
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    books = crud.get_all_books(db)

    return books if current_user.role == "admin" else [book for book in books if book.moderation_status == "active"]


@app.get("/smart/capabilities")
def smart_capabilities(current_user: models.User = Depends(get_current_user)):
    return {"finder": "deterministic", "text_assist": True, "vision": False,
            "image_message": "Image suggestions are unavailable. Add details below or continue manually."}


@app.post("/smart/find")
def smart_find(data: smart.FinderInput, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_active(current_user)
    smart.rate_limit(current_user.id)
    return smart.find_books(db, current_user, data)


@app.post("/smart/listing")
def smart_listing(data: smart.ListingInput, current_user: models.User = Depends(get_current_user)):
    ensure_active(current_user)
    smart.rate_limit(current_user.id)
    return smart.listing_suggestions(data)

@app.get("/books/search")
def search_books(
    keyword: str = Query(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    books = crud.search_books(
        db,
        keyword
    )

    return books if current_user.role == "admin" else [book for book in books if book.moderation_status == "active"]

@app.get("/saved-books")
def get_saved_books(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(models.Book).join(models.SavedBook, models.SavedBook.book_id == models.Book.id).filter(
        models.SavedBook.user_id == current_user.id,
        models.Book.moderation_status == "active"
    ).order_by(models.SavedBook.created_at.desc(), models.SavedBook.id.desc()).all()


@app.post("/saved-books/{book_id}")
def save_book(book_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not crud.get_book_by_id(db, book_id):
        raise HTTPException(status_code=404, detail="Book not found.")
    existing = db.query(models.SavedBook).filter_by(user_id=current_user.id, book_id=book_id).first()
    if not existing:
        db.add(models.SavedBook(user_id=current_user.id, book_id=book_id))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            # Concurrent saves are idempotent; other integrity errors are not hidden.
            if not db.query(models.SavedBook).filter_by(user_id=current_user.id, book_id=book_id).first():
                if not crud.get_book_by_id(db, book_id):
                    raise HTTPException(status_code=404, detail="Book not found.")
                raise
    return {"book_id": book_id, "saved": True}


@app.delete("/saved-books/{book_id}")
def unsave_book(book_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(models.SavedBook).filter_by(user_id=current_user.id, book_id=book_id).delete()
    db.commit()
    return {"book_id": book_id, "saved": False}


@app.get("/books/{book_id}")
def book_details(book_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    book = crud.get_book_by_id(db, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found.")
    if book.moderation_status != "active" and current_user.id != book.owner_id and current_user.role != "admin":
        raise HTTPException(status_code=404, detail="Book not found.")
    # Request activity is private to the requester or the owner.
    requests = db.query(models.BookRequest).filter(models.BookRequest.book_id == book_id)
    if book.owner_id != current_user.id:
        requests = requests.filter(models.BookRequest.requester_id == current_user.id)
    return {"book": book, "activity": [{"status": request.status, "created_at": request.created_at, "timeline": exchanges.timeline(request)}
            for request in requests.order_by(models.BookRequest.id.desc()).all()]}


@app.post("/reports/books/{book_id}")
def report_book(book_id: int, report: ReportCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_active(current_user)
    book = crud.get_book_by_id(db, book_id)
    if not book:
        raise HTTPException(404, "Book not found.")
    if book.owner_id == current_user.id:
        raise HTTPException(400, "You cannot report your own listing.")
    if report.reason not in REPORT_BOOK_REASONS:
        raise HTTPException(422, "Choose a valid book report reason.")
    if report.reason == "other" and not report.note:
        raise HTTPException(422, "Please add a short note for Other.")
    created = models.Report(reporter_id=current_user.id, report_type="book", book_id=book_id,
                            reported_user_id=book.owner_id, reason=report.reason, note=report.note)
    db.add(created); db.commit(); db.refresh(created)
    return {"report_id": created.id, "status": created.status}


@app.post("/reports/users/{user_id}")
def report_user(user_id: int, report: ReportCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_active(current_user)
    if user_id == current_user.id:
        raise HTTPException(400, "You cannot report yourself.")
    if not crud.get_user_by_id(db, user_id):
        raise HTTPException(404, "User not found.")
    if report.reason not in REPORT_USER_REASONS:
        raise HTTPException(422, "Choose a valid user report reason.")
    if report.reason == "other" and not report.note:
        raise HTTPException(422, "Please add a short note for Other.")
    created = models.Report(reporter_id=current_user.id, report_type="user", reported_user_id=user_id,
                            reason=report.reason, note=report.note)
    db.add(created); db.commit(); db.refresh(created)
    return {"report_id": created.id, "status": created.status}


@app.post("/blocks/{user_id}")
def block_user(user_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_active(current_user)
    if user_id == current_user.id:
        raise HTTPException(400, "You cannot block yourself.")
    if not crud.get_user_by_id(db, user_id):
        raise HTTPException(404, "User not found.")
    if not db.query(models.UserBlock).filter_by(blocker_id=current_user.id, blocked_id=user_id).first():
        db.add(models.UserBlock(blocker_id=current_user.id, blocked_id=user_id)); db.commit()
    return {"blocked_user_id": user_id, "blocked": True}


@app.delete("/blocks/{user_id}")
def unblock_user(user_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(models.UserBlock).filter_by(blocker_id=current_user.id, blocked_id=user_id).delete()
    db.commit()
    return {"blocked_user_id": user_id, "blocked": False}


@app.get("/blocks")
def get_blocks(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return [{"id": block.blocked_id, "name": user.name, "grade": user.grade, "section": user.section}
            for block, user in db.query(models.UserBlock, models.User).join(models.User, models.UserBlock.blocked_id == models.User.id)
            .filter(models.UserBlock.blocker_id == current_user.id).all()]


@app.get("/interactions/{user_id}")
def interaction_status(user_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user_id == current_user.id:
        raise HTTPException(400, "Choose another user.")
    other = crud.get_user_by_id(db, user_id)
    if not other:
        raise HTTPException(404, "User not found.")
    allowed = current_user.account_status == "active" and other.account_status == "active" and not users_are_blocked(db, current_user.id, user_id)
    return {"blocked": not allowed, "messaging_allowed": allowed}


@app.post("/requests")
def request_book(
    request: BookRequestCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ensure_active(current_user)
    book = crud.get_book_by_id(db, request.book_id)
    if not book:
        raise HTTPException(404, "Book not found.")
    if book.moderation_status != "active":
        raise HTTPException(400, "This listing is not available.")
    if users_are_blocked(db, current_user.id, book.owner_id):
        raise HTTPException(403, "You cannot request books from a blocked user.")
    created_request = exchanges.create_request(db, request.book_id, current_user.id)

    return {
        "message": "Book request created",
        "request_id": created_request.id,
        "status": created_request.status
    }

@app.get("/requests")
def get_all_requests(
    _admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    requests = crud.get_all_requests(db)
    return requests


@app.get("/requests/book/{book_id}")
def get_requests_for_book(
    book_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    book = crud.get_book_by_id(db, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found.")
    if book.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="You can only view requests for your own books.")
    requests = crud.get_requests_by_book(
        db,
        book_id
    )

    return requests


@app.get("/requests/user/{requester_id}")
def get_requests_for_user(
    requester_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if requester_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="You can only view your own requests.")
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
            "image_url": book.image_url, "book_status": book.status,
            "owner_id": owner.id,
            "owner_name": owner.name,
            "request_date": request.created_at,
            **exchanges.event_times(request),
            "status": request.status
        }
        for request, book, owner in requests
    ]


@app.get("/books/owner/{owner_id}/requests")
def get_owner_books_with_requests(
    owner_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="You can only view your own books.")
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
                    **exchanges.event_times(request),
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
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    updated = exchanges.transition(db, request_id, current_user.id, request_update.status)
    return {"message": "Request status updated", "request": updated}


@app.post("/requests/{request_id}/complete")
def complete_exchange(request_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    updated = exchanges.transition(db, request_id, current_user.id, "completed")
    return {"message": "Another book got a second spin.", "request": updated}


@app.get("/exchanges/{request_id}")
def exchange_details(request_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    request = db.query(models.BookRequest).filter_by(id=request_id).first()
    if not request:
        raise HTTPException(404, "Request not found.")
    book = crud.get_book_by_id(db, request.book_id)
    if current_user.id not in (book.owner_id, request.requester_id) and current_user.role != "admin":
        raise HTTPException(403, "Only exchange participants can view this exchange.")
    owner = crud.get_user_by_id(db, book.owner_id)
    requester = crud.get_user_by_id(db, request.requester_id)
    return {"id": request.id, "status": request.status, "book": book,
            "owner": {"id": owner.id, "name": owner.name},
            "requester": {"id": requester.id, "name": requester.name},
            "timeline": exchanges.timeline(request)}


@app.get("/leaderboard")
def trust_leaderboard(
    _current_user: models.User = Depends(get_current_user),
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
        "completed_requests": db.query(models.BookRequest).filter_by(status="completed").count(),
        "declined_requests": db.query(models.BookRequest).filter_by(status="rejected").count(),
        "cancelled_requests": db.query(models.BookRequest).filter_by(status="cancelled").count(),
        "given_books": db.query(models.Book).filter_by(status="given").count(),
        "approved_requests": db.query(models.BookRequest).filter(
            models.BookRequest.status == "approved"
        ).count(),
        "open_reports": db.query(models.Report).filter_by(status="open").count(),
        "hidden_books": db.query(models.Book).filter_by(moderation_status="hidden").count(),
        "suspended_users": db.query(models.User).filter_by(account_status="suspended").count(),
    }


@app.get("/admin/reports")
def admin_reports(_admin: models.User = Depends(get_current_admin), db: Session = Depends(get_db)):
    reports = db.query(models.Report).order_by(models.Report.created_at.desc()).all()
    return [{
        "id": report.id, "type": report.report_type, "reason": report.reason, "note": report.note,
        "status": report.status, "created_at": report.created_at, "book_id": report.book_id,
        "reported_user_id": report.reported_user_id,
        "reporter": {"id": reporter.id, "name": reporter.name, "email": reporter.email},
        "reported_user": ({"id": target.id, "name": target.name, "email": target.email} if target else None),
        "book": ({"id": book.id, "title": book.title, "moderation_status": book.moderation_status} if book else None),
    } for report in reports for reporter, target, book in [(
        crud.get_user_by_id(db, report.reporter_id), crud.get_user_by_id(db, report.reported_user_id),
        crud.get_book_by_id(db, report.book_id) if report.book_id else None)]]


@app.patch("/admin/reports/{report_id}")
def review_report(report_id: int, update: ModerationUpdate, admin: models.User = Depends(get_current_admin), db: Session = Depends(get_db)):
    report = db.query(models.Report).filter_by(id=report_id).first()
    if not report:
        raise HTTPException(404, "Report not found.")
    report.status = update.status; report.reviewed_by_id = admin.id
    from datetime import datetime, timezone
    report.reviewed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    audit(db, admin.id, f"report_{update.status}", "report", report.id)
    db.commit()
    return {"report_id": report.id, "status": report.status}


@app.patch("/admin/books/{book_id}/moderation")
def moderate_book(book_id: int, update: BookModerationUpdate, admin: models.User = Depends(get_current_admin), db: Session = Depends(get_db)):
    book = crud.get_book_by_id(db, book_id)
    if not book:
        raise HTTPException(404, "Book not found.")
    book.moderation_status = update.status
    audit(db, admin.id, "book_hidden" if update.status == "hidden" else "book_restored", "book", book.id)
    db.commit()
    return {"book_id": book.id, "moderation_status": book.moderation_status}


@app.patch("/admin/users/{user_id}/status")
def moderate_user(user_id: int, update: AccountStatusUpdate, admin: models.User = Depends(get_current_admin), db: Session = Depends(get_db)):
    user = crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(404, "User not found.")
    if user.id == admin.id:
        raise HTTPException(400, "Admins cannot change their own account status.")
    user.account_status = update.status
    audit(db, admin.id, "user_suspended" if update.status == "suspended" else "user_reactivated", "user", user.id)
    db.commit()
    return {"user_id": user.id, "account_status": user.account_status}


@app.get("/admin/audit")
def admin_audit(_admin: models.User = Depends(get_current_admin), db: Session = Depends(get_db)):
    return [{"id": item.id, "admin_user_id": item.admin_user_id, "action_type": item.action_type,
             "target_type": item.target_type, "target_id": item.target_id, "created_at": item.created_at}
            for item in db.query(models.AdminAuditLog).order_by(models.AdminAuditLog.id.desc()).limit(100).all()]


@app.patch("/profile")
def update_profile(
    profile_update: UserProfileUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    updated_user = crud.update_user_profile(
        db,
        current_user,
        profile_update.grade,
        profile_update.section,
    )
    return {
        "message": "Grade and section updated successfully.",
        "user": {
            "id": updated_user.id,
            "name": updated_user.name,
            "email": updated_user.email,
            "grade": updated_user.grade,
            "section": updated_user.section,
            "role": updated_user.role,
            "trust_points": updated_user.trust_points,
        },
    }

@app.delete("/requests/{request_id}")
def cancel_request(
    request_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    updated = exchanges.transition(db, request_id, current_user.id, "cancelled")
    return {"message": "Request cancelled successfully", "request": updated}

@app.get("/dashboard/{user_id}")
def user_dashboard(
    user_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="You can only view your own dashboard.")

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

    books_given = db.query(models.BookRequest).join(models.Book).filter(
        models.Book.owner_id == user_id, models.BookRequest.status == "completed").count()
    books_received = db.query(models.BookRequest).filter_by(requester_id=user_id, status="completed").count()

    return {
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "grade": user.grade,
        "section": user.section,
        "books_posted": books_posted,
        "books_requested": books_requested,
        "books_approved": books_approved,
        "books_given": books_given, "books_received": books_received,
        "completed_exchanges": books_given + books_received,
        "trust_points": user.trust_points
    }


@app.get("/notifications/{user_id}")
def get_notifications(
    user_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="You can only view your own notifications.")
    notifications = []

    rows = db.query(models.BookRequest, models.Book).join(models.Book).filter(
        (models.BookRequest.requester_id == user_id) | (models.Book.owner_id == user_id)
    ).all()
    labels = {"approved": "Request accepted", "rejected": "Request declined",
              "cancelled": "Request cancelled", "completed": "Exchange completed"}
    for request, book in rows:
        owner_view = book.owner_id == user_id
        if request.status == "pending" and owner_view:
            requester = crud.get_user_by_id(db, request.requester_id)
            notifications.append({"id": f"incoming-request-{request.id}", "type": "new_request",
                "target": "my-books", "request_id": request.id, "book_id": book.id,
                "title": "New book request", "message": f'{requester.name} requested "{book.title}".',
                "created_at": request.created_at, "is_unread": True})
        if request.status in labels and (not owner_view or request.status in ("cancelled", "completed")):
            field = {"approved": "accepted_at", "rejected": "declined_at", "cancelled": "cancelled_at", "completed": "completed_at"}[request.status]
            notifications.append({"id": f"request-{request.id}-{request.status}", "type": f"book_{request.status}",
                "target": "my-books" if owner_view else "requests", "request_id": request.id, "book_id": book.id,
                "title": labels[request.status], "message": f'{labels[request.status]}: "{book.title}".',
                "created_at": getattr(request, field), "is_unread": True})

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
            "target": "messages", "conversation": {"user_id": sender.id, "name": sender.name},
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
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ensure_active(current_user)
    if current_user.id == message_data.receiver_id:

        raise HTTPException(
            status_code=400,
            detail="You cannot send messages to yourself."
        )

    receiver = crud.get_user_by_id(db, message_data.receiver_id)
    if not receiver:
        raise HTTPException(status_code=404, detail="Recipient not found.")
    if receiver.account_status != "active":
        raise HTTPException(status_code=403, detail="Messaging is not available for this account.")
    if users_are_blocked(db, current_user.id, receiver.id):
        raise HTTPException(status_code=403, detail="Messaging is unavailable because one of you has blocked the other.")

    created_message = crud.create_message(
        db,
        message_data.model_copy(update={"sender_id": current_user.id})
    )

    return {
        "message": "Message sent successfully",
        "message_id": created_message.id
    }

@app.get("/messages/conversation")
def get_conversation(
    user1_id: int,
    user2_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.id not in {user1_id, user2_id} and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="You can only view your own conversations.")

    messages = crud.get_conversation(
        db,
        user1_id,
        user2_id
    )

    return messages

@app.get("/messages/users/{user_id}")
def get_message_users(
    user_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="You can only view your own conversations.")

    users = crud.get_chat_users(
        db,
        user_id
    )

    return [{"id": user.id, "name": user.name, "grade": user.grade, "section": user.section}
            for user in users]

@app.get("/messages/preview")
def get_last_message(
    user1_id: int,
    user2_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.id not in {user1_id, user2_id} and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="You can only view your own conversations.")

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
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="You can only view your own unread count.")

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
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    existing_message = db.query(models.Message).filter(models.Message.id == message_id).first()
    if not existing_message:
        raise HTTPException(status_code=404, detail="Message not found.")
    if existing_message.receiver_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="You can only mark messages sent to you as read.")

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
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    existing_message = db.query(models.Message).filter(models.Message.id == message_id).first()
    if not existing_message:
        raise HTTPException(status_code=404, detail="Message not found.")
    if current_user.id not in {existing_message.sender_id, existing_message.receiver_id} and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="You can only delete messages in your own conversations.")

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
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="You can only view your own conversations.")

    summary = crud.get_dm_summary(
        db,
        user_id
    )

    return summary

@app.put("/messages/read-conversation")
def read_conversation(
    current_user_id: int,
    other_user_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="You can only update your own conversations.")

    updated_count = crud.mark_conversation_as_read(
        db,
        current_user_id,
        other_user_id
    )

    return {
        "message": "Conversation marked as read",
        "messages_updated": updated_count
    }
