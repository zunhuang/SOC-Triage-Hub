"""Application configuration with strict environment validation."""
from functools import lru_cache
from pydantic import Field, HttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=True)

    APP_NAME: str = "Detect and Respond Middleware"
    APP_VERSION: str = "0.1.0"
    NODE_ENV: str = "development"
    LOG_LEVEL: str = "info"
    FRONTEND_URL: str = "http://localhost:3000"

    MONGODB_URI: str = Field(..., description="MongoDB connection URI")
    MONGODB_DB_NAME: str = Field(..., description="MongoDB database name")

    JIRA_BASE_URL: str = Field(default="")
    JIRA_USERNAME: str = Field(default="")
    JIRA_PASSWORD: str = Field(default="")
    JIRA_JQL: str = Field(default='project = "SOC" AND statusCategory != Done')
    JIRA_POLL_INTERVAL_MINUTES: int = Field(default=5, ge=1, le=60)

    KINDO_API_KEY: str = Field(...)
    KINDO_API_BASE_URL: HttpUrl = Field(default="https://api.kindo.ai/v1")
    KINDO_INFERENCE_URL: HttpUrl = Field(default="https://llm.kindo.ai/v1")

    LLM_PROVIDER: str = Field(default="openai")
    OPENAI_API_KEY: str = Field(default="")
    ANTHROPIC_API_KEY: str = Field(default="")
    GOOGLE_GEMINI_API_KEY: str = Field(default="")

    AUTO_TRIAGE_ENABLED: bool = False
    ENABLE_INTERNAL_SCHEDULER: bool = False

    # Auth
    SECRET_KEY: str = Field(..., description="JWT signing secret — must be set in .env")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30)
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7)
    ALGORITHM: str = "HS256"

    # Seed admin (created on first startup if users collection is empty)
    ADMIN_EMAIL: str = Field(default="admin@deloitte.com")
    ADMIN_PASSWORD: str = Field(default="")

    # Azure AD (Entra ID) SSO
    AZURE_CLIENT_ID: str = Field(default="")
    AZURE_CLIENT_SECRET: str = Field(default="")
    AZURE_TENANT_ID: str = Field(default="")

    @property
    def AZURE_ENABLED(self) -> bool:
        return bool(self.AZURE_CLIENT_ID and self.AZURE_CLIENT_SECRET and self.AZURE_TENANT_ID)

    @field_validator("LOG_LEVEL")
    @classmethod
    def validate_log_level(cls, value: str) -> str:
        allowed = {"debug", "info", "warning", "error", "critical"}
        lowered = value.lower()
        if lowered not in allowed:
            raise ValueError(f"LOG_LEVEL must be one of: {', '.join(sorted(allowed))}")
        return lowered


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
