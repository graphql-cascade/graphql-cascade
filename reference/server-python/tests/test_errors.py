import pytest
from graphql_cascade.errors import (
    CascadeError,
    CascadeErrorCode,
    timeout_error,
    rate_limited_error,
    service_unavailable_error,
    validation_error,
    not_found_error,
)
from graphql_cascade.builder import CascadeError as BuilderCascadeError


def test_error_codes_defined():
    """Test that all required error codes are defined."""
    assert CascadeErrorCode.VALIDATION_ERROR == "VALIDATION_ERROR"
    assert CascadeErrorCode.NOT_FOUND == "NOT_FOUND"
    assert CascadeErrorCode.TIMEOUT == "TIMEOUT"
    assert CascadeErrorCode.RATE_LIMITED == "RATE_LIMITED"
    assert CascadeErrorCode.SERVICE_UNAVAILABLE == "SERVICE_UNAVAILABLE"
    assert CascadeErrorCode.INTERNAL_ERROR == "INTERNAL_ERROR"


def test_timeout_error():
    """Test timeout error creation."""
    error = timeout_error("DB timeout", 5000, "database")

    assert error.message == "DB timeout"
    assert error.code == CascadeErrorCode.TIMEOUT
    assert error.extensions["timeoutMs"] == 5000
    assert error.extensions["service"] == "database"
    assert error.extensions["retryable"] is True


def test_rate_limited_error():
    """Test rate limited error creation."""
    error = rate_limited_error("Rate limit exceeded", 45, 100, "1m")

    assert error.code == CascadeErrorCode.RATE_LIMITED
    assert error.extensions["retryAfter"] == 45
    assert error.extensions["limit"] == 100
    assert error.extensions["window"] == "1m"
    assert error.extensions["remaining"] == 0


def test_service_unavailable_error():
    """Test service unavailable error creation."""
    error = service_unavailable_error("Email service down", "email-provider", 60)

    assert error.code == CascadeErrorCode.SERVICE_UNAVAILABLE
    assert error.extensions["service"] == "email-provider"
    assert error.extensions["retryable"] is True
    assert error.extensions["retryAfter"] == 60


def test_validation_error():
    """Test validation error creation."""
    error = validation_error("Invalid email", "email", ["input", "email"])

    assert error.message == "Invalid email"
    assert error.code == CascadeErrorCode.VALIDATION_ERROR
    assert error.field == "email"
    assert error.path == ["input", "email"]


def test_not_found_error():
    """Test not found error creation."""
    error = not_found_error("User not found", "userId", ["user"])

    assert error.message == "User not found"
    assert error.code == CascadeErrorCode.NOT_FOUND
    assert error.field == "userId"
    assert error.path == ["user"]


def test_error_to_dict():
    """Test error serialization."""
    error = validation_error("Invalid email", "email", ["input", "email"])

    result = error.to_dict()

    assert result["message"] == "Invalid email"
    assert result["code"] == "VALIDATION_ERROR"
    assert result["field"] == "email"
    assert result["path"] == ["input", "email"]


def test_error_to_dict_with_extensions():
    """Test error serialization with extensions."""
    error = timeout_error("DB timeout", 5000, "database")

    result = error.to_dict()

    assert result["message"] == "DB timeout"
    assert result["code"] == "TIMEOUT"
    assert result["extensions"]["timeoutMs"] == 5000
    assert result["extensions"]["service"] == "database"
    assert result["extensions"]["retryable"] is True


def test_cascade_error_creation():
    """Test direct CascadeError creation."""
    error = CascadeError(
        message="Test error",
        code=CascadeErrorCode.INTERNAL_ERROR,
        field="testField",
        path=["test", "path"],
        extensions={"custom": "value"}
    )

    assert error.message == "Test error"
    assert error.code == CascadeErrorCode.INTERNAL_ERROR
    assert error.field == "testField"
    assert error.path == ["test", "path"]
    assert error.extensions == {"custom": "value"}