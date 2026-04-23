"""Error types for consistent API responses."""
from dataclasses import dataclass
from typing import Any


@dataclass
class AppError(Exception):
    message: str
    code: str
    status_code: int = 400
    details: Any = None


class ExternalServiceError(AppError):
    def __init__(self, message: str, code: str = "external_service_error", details: Any = None):
        super().__init__(message=message, code=code, status_code=502, details=details)


class NotFoundError(AppError):
    def __init__(self, message: str, code: str = "not_found", details: Any = None):
        super().__init__(message=message, code=code, status_code=404, details=details)
