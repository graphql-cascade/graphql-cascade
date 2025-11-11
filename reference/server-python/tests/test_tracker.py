"""
Tests for CascadeTracker.
"""

import pytest
from graphql_cascade import CascadeTracker, CascadeTransaction


class MockEntity:
    """Mock entity for testing."""

    def __init__(self, id: str, name: str, __typename: str = "MockEntity"):
        self.id = id
        self.name = name
        self.__typename__ = __typename

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
        }


class TestCascadeTracker:
    """Test CascadeTracker functionality."""

    def test_initialization(self):
        """Test tracker initialization."""
        tracker = CascadeTracker()
        assert tracker.max_depth == 3
        assert tracker.exclude_types == []
        assert tracker.enable_relationship_tracking is True
        assert tracker.in_transaction is False

    def test_custom_initialization(self):
        """Test tracker with custom settings."""
        tracker = CascadeTracker(
            max_depth=5,
            exclude_types=["AuditLog"],
            enable_relationship_tracking=False
        )
        assert tracker.max_depth == 5
        assert tracker.exclude_types == ["AuditLog"]
        assert tracker.enable_relationship_tracking is False

    def test_transaction_context_manager(self):
        """Test transaction context manager."""
        tracker = CascadeTracker()

        with tracker:
            assert tracker.in_transaction is True
            assert tracker.transaction_id is not None

        assert tracker.in_transaction is False
        assert tracker.transaction_id is None

    def test_track_create(self):
        """Test tracking entity creation."""
        tracker = CascadeTracker()
        entity = MockEntity("1", "Test Entity")

        with tracker:
            tracker.track_create(entity)

        # Check that entity was tracked
        assert len(tracker.updated_entities) == 1
        key = ("MockEntity", "1")
        assert key in tracker.updated_entities

        change = tracker.updated_entities[key]
        assert change.entity == entity
        assert change.operation == "CREATED"

    def test_track_update(self):
        """Test tracking entity update."""
        tracker = CascadeTracker()
        entity = MockEntity("1", "Test Entity")

        with tracker:
            tracker.track_update(entity)

        assert len(tracker.updated_entities) == 1
        key = ("MockEntity", "1")
        assert key in tracker.updated_entities

        change = tracker.updated_entities[key]
        assert change.entity == entity
        assert change.operation == "UPDATED"

    def test_track_delete(self):
        """Test tracking entity deletion."""
        tracker = CascadeTracker()

        with tracker:
            tracker.track_delete("MockEntity", "1")

        assert len(tracker.deleted_entities) == 1
        assert ("MockEntity", "1") in tracker.deleted_entities

    def test_exclude_types(self):
        """Test excluding entity types."""
        tracker = CascadeTracker(exclude_types=["AuditLog"])
        audit_entity = MockEntity("1", "Audit Log", __typename="AuditLog")
        normal_entity = MockEntity("2", "Normal Entity")

        with tracker:
            tracker.track_create(audit_entity)
            tracker.track_create(normal_entity)

        # Only normal entity should be tracked
        assert len(tracker.updated_entities) == 1
        assert ("MockEntity", "2") in tracker.updated_entities

    def test_end_transaction_returns_cascade_data(self):
        """Test that end_transaction returns proper cascade data."""
        tracker = CascadeTracker()
        entity = MockEntity("1", "Test Entity")

        with tracker:
            tracker.track_create(entity)
            tracker.track_delete("OtherEntity", "2")

        cascade_data = tracker.end_transaction()

        assert "updated" in cascade_data
        assert "deleted" in cascade_data
        assert "metadata" in cascade_data

        assert len(cascade_data["updated"]) == 1
        assert len(cascade_data["deleted"]) == 1

        # Check metadata
        metadata = cascade_data["metadata"]
        assert "transaction_id" in metadata
        assert "timestamp" in metadata
        assert metadata["affected_count"] == 2

    def test_transaction_rollback_on_error(self):
        """Test that transaction is properly cleaned up on error."""
        tracker = CascadeTracker()

        with pytest.raises(ValueError):
            with tracker:
                tracker.track_create(MockEntity("1", "Test"))
                raise ValueError("Test error")

        # Transaction should be cleaned up
        assert tracker.in_transaction is False
        assert len(tracker.updated_entities) == 0

    def test_no_transaction_error(self):
        """Test error when tracking outside transaction."""
        tracker = CascadeTracker()
        entity = MockEntity("1", "Test")

        with pytest.raises(RuntimeError, match="No cascade transaction"):
            tracker.track_create(entity)

    def test_double_transaction_error(self):
        """Test error when starting nested transaction."""
        tracker = CascadeTracker()

        with tracker:
            with pytest.raises(RuntimeError, match="Transaction already in progress"):
                tracker.start_transaction()


class TestCascadeTransaction:
    """Test CascadeTransaction context manager."""

    def test_context_manager(self):
        """Test basic context manager usage."""
        tracker = CascadeTracker()

        with CascadeTransaction(tracker) as tx_id:
            assert tracker.in_transaction is True
            assert tx_id is not None
            assert isinstance(tx_id, str)

        assert tracker.in_transaction is False

    def test_context_manager_with_tracking(self):
        """Test context manager with entity tracking."""
        tracker = CascadeTracker()
        entity = MockEntity("1", "Test")

        with CascadeTransaction(tracker):
            tracker.track_create(entity)

        # Transaction should be ended
        assert tracker.in_transaction is False

        # But data should still be accessible until end_transaction is called
        # (This is a bit of an implementation detail, but testing it for completeness)
        assert len(tracker.updated_entities) == 1</content>
</xai:function_call name="write">
<parameter name="filePath">server-reference/tests/test_builder.py