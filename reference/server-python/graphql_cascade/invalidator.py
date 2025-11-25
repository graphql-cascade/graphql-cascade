"""
GraphQL Cascade Invalidation Algorithm

Computes cache invalidation hints based on entity changes.
"""

import json
from collections import defaultdict
from typing import Any, Dict, List, Optional


class CascadeInvalidator:
    """
    Computes cache invalidation hints for GraphQL Cascade.

    Analyzes entity changes and generates invalidation instructions
    that tell clients which cached queries need to be updated.
    """

    def __init__(self, schema: Optional[Any] = None, config: Optional[Dict[str, Any]] = None):
        self.schema = schema
        self.config = config or {}
        self.invalidation_rules = self._load_custom_rules()

    def compute_invalidations(
        self,
        updated_entities: List[Dict[str, Any]],
        deleted_entities: List[Dict[str, Any]],
        primary_result: Any = None,
    ) -> List[Dict[str, Any]]:
        """
        Compute invalidation hints for entity changes.

        Args:
            updated_entities: List of updated entity dictionaries
            deleted_entities: List of deleted entity dictionaries
            primary_result: Primary mutation result

        Returns:
            List of invalidation hints
        """
        invalidations = []

        # 1. Automatic invalidations based on entity types
        invalidations.extend(
            self._compute_automatic_invalidations(updated_entities, deleted_entities)
        )

        # 2. Custom invalidations from @cascadeInvalidates directives
        invalidations.extend(self._compute_custom_invalidations(updated_entities, deleted_entities))

        # 3. Primary result invalidations
        invalidations.extend(self._compute_primary_invalidations(primary_result))

        # 4. Optimize and deduplicate
        optimized = self._optimize_invalidations(invalidations)

        return optimized

    def _compute_automatic_invalidations(
        self, updated: List[Dict[str, Any]], deleted: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Generate automatic invalidations based on entity types."""
        invalidations = []
        affected_types = set()

        # Collect all affected entity types
        for entity in updated:
            affected_types.add(entity["__typename"])
        for entity in deleted:
            affected_types.add(entity["__typename"])

        # Generate invalidations for each type
        for entity_type in affected_types:
            invalidations.extend(self._get_type_invalidations(entity_type))

        return invalidations

    def _get_type_invalidations(self, entity_type: str) -> List[Dict[str, Any]]:
        """Get standard invalidations for an entity type."""
        return [
            {"queryName": f"list{entity_type}s", "strategy": "INVALIDATE", "scope": "PREFIX"},
            {"queryName": f"get{entity_type}", "strategy": "REFETCH", "scope": "EXACT"},
            {"queryPattern": f"search{entity_type}*", "strategy": "INVALIDATE", "scope": "PATTERN"},
        ]

    def _compute_custom_invalidations(
        self, updated: List[Dict[str, Any]], deleted: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Generate invalidations from @cascadeInvalidates directives."""
        invalidations = []

        for entity in updated:
            entity_type = entity["__typename"]
            entity_data = entity["entity"]

            # Get changed fields (simplified - would need entity diffing in practice)
            changed_fields = self._get_changed_fields(entity)

            # Apply rules for changed fields
            for field_name in changed_fields:
                rules = self.invalidation_rules.get(entity_type, {}).get(field_name, [])
                for rule in rules:
                    invalidations.append(
                        {
                            "queryName": rule.get("query"),
                            "strategy": rule.get("strategy", "INVALIDATE"),
                            "scope": rule.get("scope", "PREFIX"),
                            "arguments": rule.get("arguments"),
                        }
                    )

        return invalidations

    def _compute_primary_invalidations(self, primary_result: Any) -> List[Dict[str, Any]]:
        """Generate invalidations for the primary mutation result."""
        if not primary_result:
            return []

        # Try to get entity info from primary result
        try:
            entity_type = self._get_entity_type(primary_result)
            entity_id = self._get_entity_id(primary_result)

            return [
                {
                    "queryName": f"get{entity_type}",
                    "arguments": {"id": entity_id},
                    "strategy": "REFETCH",
                    "scope": "EXACT",
                }
            ]
        except (AttributeError, KeyError):
            return []

    def _optimize_invalidations(self, invalidations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Optimize and deduplicate invalidation hints."""
        # Remove duplicates
        seen = set()
        deduplicated = []

        for inv in invalidations:
            # Create hash for deduplication
            inv_hash = (
                inv.get("queryName"),
                inv.get("queryPattern"),
                inv.get("strategy"),
                inv.get("scope"),
                json.dumps(inv.get("arguments"), sort_keys=True) if inv.get("arguments") else None,
            )

            if inv_hash not in seen:
                seen.add(inv_hash)
                deduplicated.append(inv)

        # Apply scope precedence (EXACT > PREFIX > PATTERN > ALL)
        scope_priority = {"EXACT": 4, "PREFIX": 3, "PATTERN": 2, "ALL": 1}

        deduplicated.sort(
            key=lambda x: scope_priority.get(x.get("scope", "PREFIX"), 0), reverse=True
        )

        # Limit total invalidations
        max_invalidations = self.config.get("max_invalidations", 50)
        return deduplicated[:max_invalidations]

    def _get_changed_fields(self, entity: Dict[str, Any]) -> List[str]:
        """Determine which fields changed in an entity."""
        # In practice, this would compare entity to its previous state
        # For now, assume all fields might have changed
        entity_data = entity.get("entity", {})
        return list(entity_data.keys())

    def _load_custom_rules(self) -> Any:
        """Load invalidation rules from schema directives."""
        rules = defaultdict(lambda: defaultdict(list))

        if not self.schema:
            return rules

        # Parse schema and extract @cascadeInvalidates directives
        # This is a simplified version - in practice would need GraphQL schema parsing
        try:
            # Mock implementation for demonstration
            # In real implementation, would parse schema AST
            pass
        except Exception:
            # If schema parsing fails, return empty rules
            pass

        return rules

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


class OptimizedInvalidator(CascadeInvalidator):
    """
    Optimized version with caching and batching.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._rule_cache = {}
        self._type_cache = {}

    def _get_type_invalidations(self, entity_type: str) -> List[Dict[str, Any]]:
        """Cached version of type invalidations."""
        if entity_type not in self._type_cache:
            self._type_cache[entity_type] = super()._get_type_invalidations(entity_type)
        return self._type_cache[entity_type]

    def _load_custom_rules(self) -> Dict[str, Dict[str, List[Dict[str, Any]]]]:
        """Cached version of custom rules loading."""
        cache_key = "custom_rules"
        if cache_key not in self._rule_cache:
            self._rule_cache[cache_key] = super()._load_custom_rules()
        return self._rule_cache[cache_key]


# Utility functions


def deduplicate_invalidations(invalidations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Deduplicate invalidation hints."""
    seen = set()
    deduplicated = []

    for inv in invalidations:
        inv_hash = (
            inv.get("queryName"),
            inv.get("queryPattern"),
            inv.get("strategy"),
            inv.get("scope"),
            json.dumps(inv.get("arguments"), sort_keys=True) if inv.get("arguments") else None,
        )

        if inv_hash not in seen:
            seen.add(inv_hash)
            deduplicated.append(inv)

    return deduplicated


def prioritize_invalidations(invalidations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Sort invalidations by specificity."""
    scope_priority = {"EXACT": 4, "PREFIX": 3, "PATTERN": 2, "ALL": 1}

    return sorted(
        invalidations, key=lambda x: scope_priority.get(x.get("scope", "PREFIX"), 0), reverse=True
    )


def batch_invalidations(invalidations: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """Batch invalidations by strategy and scope."""
    batches = defaultdict(list)

    for inv in invalidations:
        key = (inv.get("strategy"), inv.get("scope"))
        batches[key].append(inv)

    return dict(batches)
