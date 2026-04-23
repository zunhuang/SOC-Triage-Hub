"""
SQLAlchemy ORM Models
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.database.postgres import Base


class AuthProvider(str, enum.Enum):
    """Authentication provider types."""
    LOCAL = "local"
    GOOGLE = "google"
    MICROSOFT = "microsoft"


class User(Base):
    """User model for authentication and user management."""

    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=True)
    password_hash = Column(String(255), nullable=True)  # Nullable for SSO users

    # Profile
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)

    # Auth
    auth_provider = Column(SQLEnum(AuthProvider), default=AuthProvider.LOCAL)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    is_admin = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<User {self.email}>"

    @property
    def full_name(self) -> str:
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.username or self.email
