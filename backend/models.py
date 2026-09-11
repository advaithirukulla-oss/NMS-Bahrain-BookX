from sqlalchemy import Column, DateTime, Integer, String, ForeignKey, UniqueConstraint, func
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(100))
    email = Column(String(100), unique=True)

    grade = Column(String(20))
    section = Column(String(20))

    password = Column(String(255))

    role = Column(String(20), default="student")

    trust_points = Column(Integer, default=0)
    account_status = Column(String(20), default="active", nullable=False)


class Book(Base):
    __tablename__ = "books"

    id = Column(Integer, primary_key=True, index=True)

    title = Column(String(150))
    subject = Column(String(100))
    grade = Column(String(20))
    school_year = Column(String(20))
    image_url = Column(String(500))

    condition = Column(String(50))
    description = Column(String(500))

    status = Column(String(30), default="available")
    moderation_status = Column(String(20), default="active", nullable=False)

    is_syllabus_book = Column(Integer, default=1)

    owner_id = Column(Integer, ForeignKey("users.id"))

class SavedBook(Base):
    __tablename__ = "saved_books"
    __table_args__ = (UniqueConstraint("user_id", "book_id", name="uq_saved_user_book"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    book_id = Column(Integer, ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())


class BookRequest(Base):
    __tablename__ = "book_requests"

    id = Column(Integer, primary_key=True, index=True)

    book_id = Column(Integer, ForeignKey("books.id"))

    requester_id = Column(Integer, ForeignKey("users.id"))

    status = Column(String(30), default="pending")

    accepted_at = Column(DateTime, nullable=True)
    declined_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now()
    )

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)

    sender_id = Column(
        Integer,
        ForeignKey("users.id")
    )

    receiver_id = Column(
        Integer,
        ForeignKey("users.id")
    )

    message_text = Column(
        String(1000)
    )

    is_read = Column(
        Integer,
        default=0
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now()
    )


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    report_type = Column(String(20), nullable=False)  # book or user
    book_id = Column(Integer, ForeignKey("books.id"), nullable=True, index=True)
    reported_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    reason = Column(String(50), nullable=False)
    note = Column(String(300), nullable=True)
    status = Column(String(20), default="open", nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    reviewed_at = Column(DateTime, nullable=True)
    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)


class UserBlock(Base):
    __tablename__ = "user_blocks"
    __table_args__ = (UniqueConstraint("blocker_id", "blocked_id", name="uq_user_block"),)

    id = Column(Integer, primary_key=True)
    blocker_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    blocked_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())


class AdminAuditLog(Base):
    __tablename__ = "admin_audit_logs"

    id = Column(Integer, primary_key=True)
    admin_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    action_type = Column(String(50), nullable=False)
    target_type = Column(String(30), nullable=False)
    target_id = Column(Integer, nullable=False, index=True)
    metadata_json = Column(String(300), nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
