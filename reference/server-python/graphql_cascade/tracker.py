"""
GraphQL Cascade Entity Tracker

Tracks entity changes during GraphQL mutations for cascade response construction.
"""

import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Iterator, List, Optional, Set, Tuple


@dataclass
class EntityChange:
    """Represents a change to an entity."""

    entity: Any
    operation: str  # 'CREATED', 'UPDATED', 'DELETED'
    timestamp: float = field(default_factory=time.time)


@dataclass
class CascadeTransaction:
    """Context manager for cascade transaction tracking."""

    tracker: "CascadeTracker"

    def __enter__(self):
        return self.tracker.start_transaction()

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            # Normal exit - mark as not in transaction but keep data
            self.tracker.in_transaction = False
            self.tracker.transaction_id = None
            self.tracker.transaction_start_time = None
            self.tracker.tracking_start_time = None
        else:
            # Exception occurred - reset state
            self.tracker._reset_transaction_state()


class CascadeTracker:
    """
    Tracks entity changes during GraphQL mutations.

    Supports multiple tracking strategies:
    - ORM hooks (preferred)
    - Database triggers
    - Manual tracking
    """

    def __init__(
        self,
        max_depth: int = 3,
        exclude_types: Optional[List[str]] = None,
        enable_relationship_tracking: bool = True,
    ):
        self.max_depth = max_depth
        self.exclude_types = set(exclude_types or [])
        self.enable_relationship_tracking = enable_relationship_tracking

        # Transaction state
        self.in_transaction = False
        self.transaction_start_time: Optional[float] = None
        self.transaction_id: Optional[str] = None

        # Change tracking
        self.updated_entities: Dict[Tuple[str, str], EntityChange] = {}
        self.deleted_entities: Set[Tuple[str, str]] = set()
        self.visited_entities: Set[Tuple[str, str]] = set()
        self.current_depth = 0

        # Performance tracking
        self.tracking_start_time: Optional[float] = None

    def start_transaction(self) -> str:
        """Start a new cascade transaction."""
        if self.in_transaction:
            raise RuntimeError("Transaction already in progress")

        self.in_transaction = True
        self.transaction_start_time = time.time()
        self.transaction_id = f"cascade_{int(self.transaction_start_time * 1000000)}"
        self.tracking_start_time = time.time()

        # Reset tracking state
        self.updated_entities.clear()
        self.deleted_entities.clear()
        self.visited_entities.clear()
        self.current_depth = 0

        return self.transaction_id

    def end_transaction(self) -> Dict[str, Any]:
        """End the current transaction and return cascade data."""
        if not self.in_transaction and not self.updated_entities and not self.deleted_entities:
            raise RuntimeError("No transaction in progress")

        tracking_time = time.time() - (self.tracking_start_time or 0)

        cascade_data = {
            "updated": self._build_updated_entities(),
            "deleted": self._build_deleted_entities(),
            "metadata": {
                "transaction_id": self.transaction_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "depth": self.current_depth,
                "affected_count": len(self.updated_entities) + len(self.deleted_entities),
                "tracking_time": tracking_time,
            },
        }

        # Reset state
        self._reset_transaction_state()

        return cascade_data

    def _reset_transaction_state(self):
        """Reset transaction state."""
        self.in_transaction = False
        self.transaction_start_time = None
        self.transaction_id = None
        self.tracking_start_time = None
        self.updated_entities.clear()
        self.deleted_entities.clear()
        self.visited_entities.clear()
        self.current_depth = 0

    def get_cascade_data(self) -> Dict[str, Any]:
        """Get cascade data without ending the transaction."""
        if not self.in_transaction:
            raise RuntimeError("No transaction in progress")

        tracking_time = time.time() - (self.tracking_start_time or 0)

        return {
            "updated": self._build_updated_entities(),
            "deleted": self._build_deleted_entities(),
            "metadata": {
                "transaction_id": self.transaction_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "depth": self.current_depth,
                "affected_count": len(self.updated_entities) + len(self.deleted_entities),
                "tracking_time": tracking_time,
            },
        }

    def track_create(self, entity: Any) -> None:
        """Track entity creation."""
        self._ensure_transaction()
        self._track_entity(entity, "CREATED")

    def track_update(self, entity: Any) -> None:
        """Track entity update."""
        self._ensure_transaction()
        self._track_entity(entity, "UPDATED")

    def track_delete(self, typename: str, entity_id: str) -> None:
        """Track entity deletion."""
        self._ensure_transaction()

        key = (typename, entity_id)
        self.deleted_entities.add(key)

        # Remove from updated if it was there
        self.updated_entities.pop(key, None)

    def _track_entity(self, entity: Any, operation: str) -> None:
        """Internal entity tracking with relationship traversal."""
        typename = self._get_entity_type(entity)
        entity_id = self._get_entity_id(entity)
        key = (typename, entity_id)

        # Skip excluded types
        if typename in self.exclude_types:
            return

        # Skip if already visited
        if key in self.visited_entities:
            return

        self.visited_entities.add(key)

        # Store the change
        self.updated_entities[key] = EntityChange(
            entity=entity, operation=operation, timestamp=time.time()
        )

        # Traverse relationships if enabled and within depth
        if self.enable_relationship_tracking and self.current_depth < self.max_depth:
            self._traverse_relationships(entity, operation)

    def _traverse_relationships(self, entity: Any, operation: str) -> None:
        """Traverse entity relationships to find cascade effects."""
        self.current_depth += 1

        try:
            related_entities = self._get_related_entities(entity)

            for related_entity in related_entities:
                if related_entity is not None:
                    # Related entities are typically UPDATED
                    self._track_entity(related_entity, "UPDATED")
        finally:
            self.current_depth -= 1

    def _get_related_entities(self, entity: Any) -> List[Any]:
        """Get related entities for an entity."""
        related = []

        # Try different methods to get related entities
        if hasattr(entity, "get_related_entities"):
            # Custom method
            related.extend(entity.get_related_entities())
        elif hasattr(entity, "__dict__"):
            # Inspect object attributes
            for attr_name, attr_value in entity.__dict__.items():
                if attr_name.startswith("_"):
                    continue  # Skip private attributes

                if self._is_entity(attr_value):
                    related.append(attr_value)
                elif isinstance(attr_value, (list, tuple)):
                    # Handle collections
                    for item in attr_value:
                        if self._is_entity(item):
                            related.append(item)

        return related

    def _is_entity(self, obj: Any) -> bool:
        """Check if an object is a domain entity."""
        if obj is None or not hasattr(obj, "__class__"):
            return False

        # Check for entity characteristics
        has_id = hasattr(obj, "id")
        has_typename = hasattr(obj, "__typename__") or hasattr(obj, "_typename")

        # Exclude basic types and collections
        if isinstance(obj, (str, int, float, bool, dict, list)):
            return False

        return has_id and has_typename

    def _get_entity_type(self, entity: Any) -> str:
        """Get the type name of an entity."""
        if hasattr(entity, "__typename__"):
            return entity.__typename__
        elif hasattr(entity, "_typename"):
            return entity._typename
        else:
            return entity.__class__.__name__

    def _get_entity_id(self, entity: Any) -> str:
        """Get the ID of an entity."""
        if hasattr(entity, "id"):
            return str(entity.id)
        else:
            raise ValueError(f"Entity {entity} has no 'id' attribute")

    def _ensure_transaction(self) -> None:
        """Ensure we're in a transaction."""
        if not self.in_transaction:
            raise RuntimeError(
                "No cascade transaction in progress. Use CascadeTransaction context manager."
            )

    def _build_updated_entities(self) -> List[Dict[str, Any]]:
        """Build the updated entities list for cascade response."""
        updated = []

        for (typename, entity_id), change in self.updated_entities.items():
            try:
                entity_dict = self._entity_to_dict(change.entity)
                updated.append(
                    {
                        "__typename": typename,
                        "id": entity_id,
                        "operation": change.operation,
                        "entity": entity_dict,
                    }
                )
            except Exception as e:
                # Log error but continue
                print(f"Error serializing entity {typename}:{entity_id}: {e}")
                continue

        return updated

    def _build_deleted_entities(self) -> List[Dict[str, Any]]:
        """Build the deleted entities list for cascade response."""
        deleted = []

        for typename, entity_id in self.deleted_entities:
            deleted.append(
                {
                    "__typename": typename,
                    "id": entity_id,
                    "deletedAt": datetime.now(timezone.utc).isoformat(),
                }
            )

        return deleted

    def _entity_to_dict(self, entity: Any) -> Dict[str, Any]:
        """Convert entity to dictionary."""
        if hasattr(entity, "to_dict"):
            return entity.to_dict()
        elif hasattr(entity, "__dict__"):
            # Basic object serialization
            result = {}
            for key, value in entity.__dict__.items():
                if not key.startswith("_"):  # Skip private attributes
                    result[key] = self._serialize_value(value)
            return result
        else:
            raise ValueError(f"Cannot serialize entity {entity}")

    def _serialize_value(self, value: Any) -> Any:
        """Serialize a value for JSON."""
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
        elif self._is_entity(value):
            # For related entities, just include reference
            return {"__typename": self._get_entity_type(value), "id": self._get_entity_id(value)}
        else:
            # Convert to string as fallback
            return str(value)

    # Iterator methods for streaming
    def get_updated_stream(self) -> Iterator[Tuple[Any, str]]:
        """Stream updated entities."""
        for change in self.updated_entities.values():
            yield (change.entity, change.operation)

    def get_deleted_stream(self) -> Iterator[Tuple[str, str]]:
        """Stream deleted entities."""
        yield from self.deleted_entities


# Convenience context manager
def track_cascade(max_depth: int = 3, exclude_types: Optional[List[str]] = None):
    """Context manager for cascade tracking."""
    tracker = CascadeTracker(max_depth=max_depth, exclude_types=exclude_types)
    return CascadeTransaction(tracker)
