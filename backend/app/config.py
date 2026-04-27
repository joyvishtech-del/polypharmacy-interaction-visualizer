"""Application settings loaded from environment variables.

All values come from environment variables (see ``.env.example``).
No secrets should be hardcoded here.
"""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Centralised application settings.

    Uses ``pydantic-settings`` to read from environment variables and ``.env``.
    """

    # App
    APP_NAME: str = "Polypharmacy Interaction Visualizer"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

    # Database
    DATABASE_URL: str

    # Auth / JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Cookies (refresh-token transport)
    # COOKIE_SECURE defaults False so dev over plain HTTP works; flip to True
    # in any non-dev environment (set in production .env).
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "strict"

    # Google OAuth (post-MVP)
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # Anthropic Claude
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-opus-4-7"

    # OCR
    TESSERACT_PATH: str = "/usr/bin/tesseract"
    OCR_API_KEY: str = ""

    # Object storage (S3-compatible)
    S3_BUCKET: str = "polypharmacy-photos"
    S3_REGION: str = "us-east-1"
    S3_ACCESS_KEY_ID: str = ""
    S3_SECRET_ACCESS_KEY: str = ""
    S3_ENDPOINT_URL: str = ""

    # Frontend / CORS
    FRONTEND_ORIGIN: str = "http://localhost:5173"
    VITE_API_URL: str = "http://localhost:8000"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
