"""
Tests for CascadeBuilder.
"""

import pytest
from graphql_cascade import (
    CascadeBuilder,
    CascadeResponse,
    CascadeError,
    CascadeTracker,
    CascadeTransaction,
    build_success_response,
    build_error_response,
)


class MockEntity:
    """Mock entity for testing."""

    def __init__(self, id: str, name: str, typename: str = "MockEntity"):
        self.id = id
        self.name = name
        self.__typename__ = typename

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
        }


class TestCascadeBuilder:
    """Test CascadeBuilder functionality."""

    def test_initialization(self):
        """Test builder initialization."""
        tracker = CascadeTracker()
        builder = CascadeBuilder(tracker)

        assert builder.tracker == tracker
        assert builder.max_response_size_mb == 5.0
        assert builder.max_updated_entities == 500

    def test_build_success_response(self):
        """Test building successful cascade response."""
        tracker = CascadeTracker()
        builder = CascadeBuilder(tracker)
        entity = MockEntity("1", "Test Entity")

        tracker.start_transaction()
        tracker.track_create(entity)

        response = builder.build_response(primary_result=entity)

        assert response.success is True
        assert response.data == entity
        assert response.errors == []

        cascade = response.cascade
        assert cascade is not None
        assert len(cascade["updated"]) == 1
        assert len(cascade["deleted"]) == 0
        assert len(cascade["invalidations"]) == 0  # No invalidator provided

        # Check metadata
        metadata = cascade["metadata"]
        assert metadata["affected_count"] == 1
        assert "timestamp" in metadata
        assert "transaction_id" in metadata

    def test_build_error_response(self):
        """Test building error cascade response."""
        tracker = CascadeTracker()
        builder = CascadeBuilder(tracker)

        errors = [
            CascadeError(
                message="Validation failed",
                code="VALIDATION_ERROR",
                field="name"
            )
        ]

        response = builder.build_error_response(errors, primary_result=None)

        assert response.success is False
        assert response.data is None
        assert len(response.errors) == 1

        error = response.errors[0]
        assert error["message"] == "Validation failed"
        assert error["code"] == "VALIDATION_ERROR"
        assert error["field"] == "name"

    def test_response_size_limits(self):
        """Test response size limiting."""
        tracker = CascadeTracker()
        builder = CascadeBuilder(
            tracker,
            max_updated_entities=2,
            max_response_size_mb=0.001  # Very small limit
        )

        tracker.start_transaction()
        # Add more entities than the limit
        for i in range(5):
            entity = MockEntity(str(i), f"Entity {i}")
            tracker.track_create(entity)

        response = builder.build_response()

        # Should be truncated
        cascade = response.cascade
        assert len(cascade["updated"]) <= 2
        assert cascade["metadata"]["truncated_updated"] is True

    def test_cascade_error_to_dict(self):
        """Test CascadeError to_dict conversion."""
        error = CascadeError(
            message="Test error",
            code="TEST_ERROR",
            field="test_field",
            path=["root", "nested"],
            extensions={"custom": "data"}
        )

        error_dict = error.to_dict()

        expected = {
            "message": "Test error",
            "code": "TEST_ERROR",
            "field": "test_field",
            "path": ["root", "nested"],
            "extensions": {"custom": "data"}
        }

        assert error_dict == expected


class TestConvenienceFunctions:
    """Test convenience functions."""

    def test_build_success_response_function(self):
        """Test build_success_response convenience function."""
        tracker = CascadeTracker()
        entity = MockEntity("1", "Test")

        tracker.start_transaction()
        tracker.track_create(entity)

        response = build_success_response(tracker, None, entity)

        assert response.success is True
        assert response.data == entity
        assert len(response.cascade["updated"]) == 1

    def test_build_error_response_function(self):
        """Test build_error_response convenience function."""
        tracker = CascadeTracker()
        errors = [CascadeError(message="Error", code="ERROR")]

        response = build_error_response(tracker, errors)

        assert response.success is False
        assert len(response.errors) == 1
        assert response.errors[0]["message"] == "Error"


class TestCascadeResponse:
    """Test CascadeResponse dataclass."""

    def test_initialization(self):
        """Test CascadeResponse initialization."""
        response = CascadeResponse(success=True, data="test")

        assert response.success is True
        assert response.data == "test"
        assert response.errors == []
        assert response.cascade == {
            "updated": [],
            "deleted": [],
            "invalidations": [],
            "metadata": {}
        }

    def test_custom_cascade(self):
        """Test CascadeResponse with custom cascade data."""
        custom_cascade = {
            "updated": [{"__typename": "Test", "id": "1"}],
            "deleted": [],
            "invalidations": [],
            "metadata": {"count": 1}
        }

        response = CascadeResponse(
            success=True,
            cascade=custom_cascade
        )

        assert response.cascade == custom_cascade