from pydantic import BaseModel, EmailStr, Field, field_validator


def _validate_grade(value: str) -> str:
    cleaned_value = value.strip()
    if cleaned_value not in {str(grade) for grade in range(1, 13)}:
        raise ValueError("Grade must be a number from 1 to 12.")
    return cleaned_value


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    grade: str
    section: str = Field(min_length=1, max_length=20)
    password: str = Field(min_length=8, max_length=128)
    accepted_terms: bool

    @field_validator("email")
    @classmethod
    def validate_school_email(cls, value: EmailStr):
        email = str(value).strip().lower()
        if not email.endswith("@nmsedu.bh"):
            raise ValueError("Only NMS Bahrain school email addresses are allowed.")
        return email

    @field_validator("grade")
    @classmethod
    def validate_grade(cls, value: str):
        return _validate_grade(value)

    @field_validator("name", "section")
    @classmethod
    def strip_text(cls, value: str):
        return value.strip()


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr):
        return str(value).strip().lower()


class BookCreate(BaseModel):
    title: str = Field(min_length=2, max_length=150)
    subject: str = Field(min_length=2, max_length=100)
    grade: str
    condition: str = Field(pattern=r"^(Excellent|Good|Used)$")
    description: str = Field(min_length=8, max_length=500)
    is_syllabus_book: bool
    owner_id: int
    image_url: str | None = Field(default=None, max_length=500)

    @field_validator("grade")
    @classmethod
    def validate_grade(cls, value: str):
        return _validate_grade(value)

    @field_validator("title", "subject", "description")
    @classmethod
    def strip_text(cls, value: str):
        return value.strip()


class BookRequestCreate(BaseModel):
    book_id: int
    requester_id: int


class BookRequestUpdate(BaseModel):
    status: str = Field(pattern=r"^(approved|rejected)$")


class MessageCreate(BaseModel):
    sender_id: int
    receiver_id: int
    message_text: str = Field(min_length=1, max_length=1000)

    @field_validator("message_text")
    @classmethod
    def strip_message(cls, value: str):
        return value.strip()
