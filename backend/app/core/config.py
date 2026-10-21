"""All settings come from .env - no secrets inside code."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "IHUSD Backend"
    DATABASE_URL: str = "sqlite:///./ihusd.sqlite3"
    JWT_SECRET: str = "change-me"
    JWT_EXPIRE_MINUTES: int = 1440
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5199"  # comma-separated
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "claude-sonnet-4-6"
    LLM_PROVIDER: str = "anthropic"            # "anthropic" or "openai" (any OpenAI-compatible API, e.g. Groq, Gemini)
    LLM_BASE_URL: str = ""                     # only for provider "openai", e.g. https://api.groq.com/openai/v1
    RISK_SIGNAL_MAX_AGE_HOURS: int = 24       # freshness check (C3 <- C4)
    BASELINE2_IDS: str = ""                   # comma-separated research_ids whose chat gets NO academic context (Baseline 2, pilot)
    DEMO_MODE: bool = True                    # enables /burnout/demo/* (seeds sample weeks); set False in production
    URGENT_DEADLINE_WINDOW_HOURS: int = 48    # tasks due inside this window are never deferred
    SCHEDULER_RESEARCHER_EMAILS: str = ""    # C3 pilot: who may set participants' experiment mode (comma-separated)

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
