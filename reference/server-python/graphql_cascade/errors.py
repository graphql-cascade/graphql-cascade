"""GraphQL Cascade error codes and utilities."""

from enum import Enum
from typing import Any, Optional


class CascadeErrorCode(str, Enum):
    """Standard GraphQL Cascade error codes."""

    # Input and validation errors
    VALIDATION_ERROR = "VALIDATION_ERROR"
    NOT_FOUND = "NOT_FOUND"

    # Authentication and authorization
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"

    # Conflict and consistency
    CONFLICT = "CONFLICT"
    TRANSACTION_FAILED = "TRANSACTION_FAILED"

    # Operational errors (v1.1)
    TIMEOUT = "TIMEOUT"
    RATE_LIMITED = "RATE_LIMITED"
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"

    # Fallback
    INTERNAL_ERROR = "INTERNAL_ERROR"


class CascadeError:
    """Structured error information for GraphQL Cascade operations."""

    def __init__(
        self,
        message: str,
        code: CascadeErrorCode,
        field: Optional[str] = None,
        path: Optional[list[str]] = None,
        extensions: Optional[dict[str, Any]] = None,
    ):
        self.message = message
        self.code = code
        self.field = field
        self.path = path or []
        self.extensions = extensions

    def to_dict(self) -> dict[str, Any]:
        """Convert error to dictionary representation."""
        result: dict[str, Any] = {
            "message": self.message,
            "code": self.code.value,
            "path": self.path,
        }

        if self.field is not None:
            result["field"] = self.field

        if self.extensions is not None:
            result["extensions"] = self.extensions

        return result


# Convenience functions for creating common errors

def validation_error(
    message: str,
    field: Optional[str] = None,
    path: Optional[list[str]] = None,
    **extensions: Any,
) -> CascadeError:
    """Create a validation error."""
    return CascadeError(
        message=message,
        code=CascadeErrorCode.VALIDATION_ERROR,
        field=field,
        path=path,
        extensions=extensions or None,
    )


def not_found_error(
    message: str,
    field: Optional[str] = None,
    path: Optional[list[str]] = None,
    **extensions: Any,
) -> CascadeError:
    """Create a not found error."""
    return CascadeError(
        message=message,
        code=CascadeErrorCode.NOT_FOUND,
        field=field,
        path=path,
        extensions=extensions or None,
    )


def timeout_error(
    message: str,
    timeout_ms: int,
    service: Optional[str] = None,
    **extensions: Any,
) -> CascadeError:
    """Create a timeout error."""
    ext = {"timeoutMs": timeout_ms, "retryable": True}
    if service:
        ext["service"] = service
    ext.update(extensions)

    return CascadeError(
        message=message,
        code=CascadeErrorCode.TIMEOUT,
        extensions=ext,
    )


def rate_limited_error(
    message: str,
    retry_after: int,
    limit: int,
    window: str,
    **extensions: Any,
) -> CascadeError:
    """Create a rate limited error."""
    ext = {
        "retryAfter": retry_after,
        "limit": limit,
        "window": window,
        "remaining": 0,
    }
    ext.update(extensions)

    return CascadeError(
        message=message,
        code=CascadeErrorCode.RATE_LIMITED,
        extensions=ext,
    )


def service_unavailable_error(
    message: str,
    service: str,
    retry_after: Optional[int] = None,
    **extensions: Any,
) -> CascadeError:
    """Create a service unavailable error."""
    ext = {
        "service": service,
        "retryable": True,
    }
    if retry_after is not None:
        ext["retryAfter"] = retry_after
    ext.update(extensions)

    return CascadeError(
        message=message,
        code=CascadeErrorCode.SERVICE_UNAVAILABLE,
        extensions=ext,
    )
