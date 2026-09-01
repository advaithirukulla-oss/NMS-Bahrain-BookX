from pydantic import BaseModel, EmailStr, Field, field_validator

VALID_GRADES = {"KG 1", "KG 2", *{str(grade) for grade in range(1, 13)}}


def _validate_grade(value: str) -> str:
    cleaned_value = value.strip()
    if cleaned_value not in VALID_GRADES:
        raise ValueError("Grade must be KG 1, KG 2, or a number from 1 to 12.")
    return cleaned_value


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    grade: str
    section: str = Field(min_length=1, max_length=20, pattern=r"^[A-Za-z0-9 -]+$")
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


class UserProfileUpdate(BaseModel):
    grade: str
    section: str = Field(min_length=1, max_length=20, pattern=r"^[A-Za-z0-9 -]+$")

    @field_validator("grade")
    @classmethod
    def validate_grade(cls, value: str):
        return _validate_grade(value)

    @field_validator("section")
    @classmethod
    def validate_section(cls, value: str):
        cleaned_value = value.strip()
        if not cleaned_value:
            raise ValueError("Section is required.")
        return cleaned_value


class BookCreate(BaseModel):
    title: str = Field(min_length=2, max_length=150)
    subject: str = Field(min_length=2, max_length=100)
    grade: str
    condition: str = Field(pattern=r"^(Excellent|Good|Used)$")
    description: str = Field(min_length=8, max_length=500)
    is_syllabus_book: bool
    # The authenticated user is always assigned as the owner by the API.
    # Keep this optional for compatibility with older clients that still send it.
    owner_id: int | None = None
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
    requester_id: int | None = None


class BookRequestUpdate(BaseModel):
    status: str = Field(pattern=r"^(approved|rejected)$")


class MessageCreate(BaseModel):
    sender_id: int | None = None
    receiver_id: int
    message_text: str = Field(min_length=1, max_length=1000)

    @field_validator("message_text")
    @classmethod
    def strip_message(cls, value: str):
        return value.strip()
