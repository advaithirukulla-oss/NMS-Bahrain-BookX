from sqlalchemy import Column, DateTime, Integer, String, ForeignKey, func
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

    is_syllabus_book = Column(Integer, default=1)

    owner_id = Column(Integer, ForeignKey("users.id"))

class BookRequest(Base):
    __tablename__ = "book_requests"

    id = Column(Integer, primary_key=True, index=True)

    book_id = Column(Integer, ForeignKey("books.id"))

    requester_id = Column(Integer, ForeignKey("users.id"))

    status = Column(String(30), default="pending")

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
