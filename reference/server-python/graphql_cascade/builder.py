"""
GraphQL Cascade Response Builder

Constructs CascadeResponse objects from tracked entity changes.
"""

import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .tracker import CascadeTracker


@dataclass
class CascadeResponse:
    """GraphQL Cascade response structure."""

    success: bool
    data: Optional[Any] = None
    cascade: Optional[Dict[str, Any]] = None
    errors: Optional[List[Dict[str, Any]]] = None

    def __post_init__(self):
        if self.errors is None:
            self.errors = []
        if self.cascade is None:
            self.cascade = {"updated": [], "deleted": [], "invalidations": [], "metadata": {}}


@dataclass
class CascadeError:
    """Structured cascade error."""

    message: str
    code: str
    field: Optional[str] = None
    path: Optional[List[str]] = None
    extensions: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert error to dictionary."""
        result: Dict[str, Any] = {"message": self.message, "code": self.code}

        if self.field:
            result["field"] = self.field
        if self.path:
            result["path"] = self.path
        if self.extensions:
            result["extensions"] = self.extensions

        return result


class CascadeBuilder:
    """
    Builds GraphQL Cascade responses from tracked changes.

    Handles response construction, validation, and optimization.
    """

    def __init__(
        self,
        tracker: CascadeTracker,
        invalidator: Optional[Any] = None,
        max_response_size_mb: float = 5.0,
        max_updated_entities: int = 500,
        max_deleted_entities: int = 100,
        max_invalidations: int = 50,
    ):
        self.tracker = tracker
        self.invalidator = invalidator
        self.max_response_size_mb = max_response_size_mb
        self.max_updated_entities = max_updated_entities
        self.max_deleted_entities = max_deleted_entities
        self.max_invalidations = max_invalidations

    def build_response(
        self,
        primary_result: Any = None,
        success: bool = True,
        errors: Optional[List[CascadeError]] = None,
    ) -> CascadeResponse:
        """
        Build a complete CascadeResponse.

        Args:
            primary_result: The primary result of the mutation
            success: Whether the mutation succeeded
            errors: List of errors (if any)

        Returns:
            CascadeResponse: Complete cascade response
        """
        start_time = time.time()

        # Get cascade data from tracker
        cascade_data = self.tracker.get_cascade_data()
        self.tracker.end_transaction()

        # Compute invalidations if invalidator provided
        if self.invalidator and success:
            invalidations = self.invalidator.compute_invalidations(
                cascade_data["updated"], cascade_data["deleted"], primary_result
            )
            cascade_data["invalidations"] = (
                invalidations[: self.max_invalidations] if invalidations else []
            )
        else:
            cascade_data["invalidations"] = []

        # Apply size limits
        cascade_data = self._apply_size_limits(cascade_data)

        # Build response
        response = CascadeResponse(
            success=success,
            data=primary_result,
            cascade=cascade_data,
            errors=[error.to_dict() for error in (errors or [])],
        )

        # Add construction time to metadata
        construction_time = time.time() - start_time
        if response.cascade and "metadata" in response.cascade:
            response.cascade["metadata"]["construction_time"] = construction_time

        return response

    def build_error_response(
        self, errors: List[CascadeError], primary_result: Any = None
    ) -> CascadeResponse:
        """
        Build an error response.

        Args:
            errors: List of errors
            primary_result: Primary result (if any)

        Returns:
            CascadeResponse: Error cascade response
        """
        # For errors, we still want to track the transaction if it was started
        cascade_data = {"updated": [], "deleted": [], "invalidations": [], "metadata": {}}

        if self.tracker.in_transaction:
            try:
                cascade_data = self.tracker.end_transaction()
            except Exception:
                # If transaction ending fails, use empty cascade
                pass

        # Minimal metadata for error responses
        cascade_data["metadata"] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "depth": 0,
            "affected_count": 0,
            "construction_time": 0,
        }

        return CascadeResponse(
            success=False,
            data=primary_result,
            cascade=cascade_data,
            errors=[error.to_dict() for error in errors],
        )

    def _apply_size_limits(self, cascade_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Apply size limits to cascade data.

        Truncates data if it exceeds configured limits.
        """
        updated = cascade_data["updated"]
        deleted = cascade_data["deleted"]
        invalidations = cascade_data["invalidations"]

        # Apply entity limits
        if len(updated) > self.max_updated_entities:
            updated = updated[: self.max_updated_entities]
            cascade_data["metadata"]["truncated_updated"] = True

        if len(deleted) > self.max_deleted_entities:
            deleted = deleted[: self.max_deleted_entities]
            cascade_data["metadata"]["truncated_deleted"] = True

        if len(invalidations) > self.max_invalidations:
            invalidations = invalidations[: self.max_invalidations]
            cascade_data["metadata"]["truncated_invalidations"] = True

        # Check response size
        response_size = self._estimate_response_size(updated, deleted, invalidations)

        if response_size > self.max_response_size_mb * 1024 * 1024:
            # Truncate further if needed
            total_entities = len(updated) + len(deleted)
            if total_entities > 100:
                # Keep only first 50 of each type
                updated = updated[:50]
                deleted = deleted[:50]
                cascade_data["metadata"]["truncated_size"] = True

        cascade_data["updated"] = updated
        cascade_data["deleted"] = deleted
        cascade_data["invalidations"] = invalidations

        return cascade_data

    def _estimate_response_size(self, updated: List, deleted: List, invalidations: List) -> int:
        """Estimate the JSON size of the cascade data."""
        # Rough estimation: assume average 1KB per entity/invalidation
        entity_size = (len(updated) + len(deleted)) * 1024
        invalidation_size = len(invalidations) * 512
        metadata_size = 1024

        return entity_size + invalidation_size + metadata_size


class StreamingCascadeBuilder(CascadeBuilder):
    """
    Builds cascade responses using streaming to handle large datasets.
    """

    def build_streaming_response(
        self,
        primary_result: Any = None,
        success: bool = True,
        errors: Optional[List[CascadeError]] = None,
    ) -> CascadeResponse:
        """
        Build response using streaming to avoid loading all entities in memory.
        """
        # For streaming, we process entities on-demand
        cascade_data = {
            "updated": [],
            "deleted": [],
            "invalidations": [],
            "metadata": {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "depth": self.tracker.current_depth,
                "affected_count": 0,
                "streaming": True,
            },
        }

        # Stream updated entities
        updated_count = 0
        for entity, operation in self.tracker.get_updated_stream():
            if updated_count >= self.max_updated_entities:
                cascade_data["metadata"]["truncated_updated"] = True
                break

            try:
                entity_dict = self._entity_to_dict(entity)
                cascade_data["updated"].append(
                    {
                        "__typename": self._get_entity_type(entity),
                        "id": self._get_entity_id(entity),
                        "operation": operation,
                        "entity": entity_dict,
                    }
                )
                updated_count += 1
            except Exception:
                # Skip problematic entities
                continue

        # Stream deleted entities
        deleted_count = 0
        for typename, entity_id in self.tracker.get_deleted_stream():
            if deleted_count >= self.max_deleted_entities:
                cascade_data["metadata"]["truncated_deleted"] = True
                break

            cascade_data["deleted"].append(
                {
                    "__typename": typename,
                    "id": entity_id,
                    "deletedAt": datetime.now(timezone.utc).isoformat(),
                }
            )
            deleted_count += 1

        cascade_data["metadata"]["affected_count"] = updated_count + deleted_count

        # Compute invalidations
        if self.invalidator and success:
            invalidations = self.invalidator.compute_invalidations(
                cascade_data["updated"], cascade_data["deleted"], primary_result
            )
            cascade_data["invalidations"] = invalidations[: self.max_invalidations]

        return CascadeResponse(
            success=success,
            data=primary_result,
            cascade=cascade_data,
            errors=[error.to_dict() for error in (errors or [])],
        )

    def _entity_to_dict(self, entity: Any) -> Dict[str, Any]:
        """Convert entity to dictionary (streaming version)."""
        if hasattr(entity, "to_dict"):
            return entity.to_dict()
        elif hasattr(entity, "__dict__"):
            result = {}
            for key, value in entity.__dict__.items():
                if not key.startswith("_"):
                    result[key] = self._serialize_value(value)
            return result
        else:
            raise ValueError(f"Cannot serialize entity {entity}")

    def _serialize_value(self, value: Any) -> Any:
        """Serialize a value for JSON (streaming version)."""
        if value is None:
            return None
        elif isinstance(value, (str, int, float, bool)):
            return value
        elif isinstance(value, datetime):
            return value.isoformat()
        elif isinstance(value, (list, tuple)):
            return [self._serialize_value(item) for item in value]
        elif isinstance(value, dict):
            return {k: self._serialize_value(v) for k, v in value.items()}
        else:
            return str(value)

    def _get_entity_type(self, entity: Any) -> str:
        """Get entity type name."""
        if hasattr(entity, "__typename__"):
            return entity.__typename__
        elif hasattr(entity, "_typename"):
            return entity._typename
        else:
            return entity.__class__.__name__

    def _get_entity_id(self, entity: Any) -> str:
        """Get entity ID."""
        if hasattr(entity, "id"):
            return str(entity.id)
        else:
            raise ValueError(f"Entity {entity} has no 'id' attribute")


# Convenience functions


def build_success_response(
    tracker: CascadeTracker, invalidator: Optional[Any], primary_result: Any = None
) -> CascadeResponse:
    """Build a successful cascade response."""
    builder = CascadeBuilder(tracker, invalidator)
    return builder.build_response(primary_result, success=True)


def build_error_response(
    tracker: CascadeTracker, errors: List[CascadeError], primary_result: Any = None
) -> CascadeResponse:
    """Build an error cascade response."""
    builder = CascadeBuilder(tracker)
    return builder.build_error_response(errors, primary_result)


def build_streaming_success_response(
    tracker: CascadeTracker, invalidator: Optional[Any], primary_result: Any = None
) -> CascadeResponse:
    """Build a successful streaming cascade response."""
    builder = StreamingCascadeBuilder(tracker, invalidator)
    return builder.build_streaming_response(primary_result, success=True)
