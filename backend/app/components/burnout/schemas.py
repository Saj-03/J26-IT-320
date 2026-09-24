from pydantic import BaseModel, Field


class JournalIn(BaseModel):
    mode: str = "text"
    text: str


class ChatIn(BaseModel):
    message: str
    context_grounded: bool = True   # False = Baseline 2 group in the pilot


class MoodIn(BaseModel):
    mood: int = Field(ge=1, le=5)
