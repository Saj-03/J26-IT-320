from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, field_validator


class RegisterIn(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=120)
    # bcrypt only uses the first 72 bytes, so longer passwords are rejected rather than silently truncated
    password: str = Field(min_length=8, max_length=72)
    university: str | None = Field(default=None, max_length=160)
    year_of_study: int | None = Field(default=None, ge=1, le=6)
    research_consent: bool = False

    @field_validator("email")
    @classmethod
    def normalise_email(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("full_name", "university")
    @classmethod
    def strip_text(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = " ".join(v.split())
        return v or None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password is too long")
        if v.isdigit() or v.isalpha():
            raise ValueError("Use a mix of letters and numbers or symbols")
        return v


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MeOut(BaseModel):
    id: str
    email: str
    full_name: str
    research_id: str
    research_consent: bool
    university: str | None = None
    year_of_study: int | None = None
    created_at: datetime | None = None
