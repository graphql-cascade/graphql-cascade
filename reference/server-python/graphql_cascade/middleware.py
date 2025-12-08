"""
GraphQL Cascade Middleware

Integrates cascade tracking into GraphQL execution.
"""

from contextlib import asynccontextmanager
from typing import Any, Awaitable, Callable, Dict, Optional

from .builder import CascadeBuilder, CascadeError
from .invalidator import CascadeInvalidator
from .tracker import CascadeTracker, CascadeTransaction


class CascadeMiddleware:
    """
    GraphQL middleware that automatically handles cascade tracking.

    Integrates with GraphQL execution to track entity changes and
    build cascade responses for mutations with @cascade directive.
    """

    def __init__(
        self,
        tracker_factory: Optional[Callable[[], CascadeTracker]] = None,
        invalidator_factory: Optional[Callable[[], CascadeInvalidator]] = None,
        config: Optional[Dict[str, Any]] = None,
    ):
        self.config = config or {}
        self.tracker_factory = tracker_factory or self._default_tracker_factory
        self.invalidator_factory = invalidator_factory or self._default_invalidator_factory

    def _default_tracker_factory(self) -> CascadeTracker:
        """Create default cascade tracker."""
        return CascadeTracker(
            max_depth=self.config.get("max_depth", 3),
            exclude_types=self.config.get("exclude_types", []),
        )

    def _default_invalidator_factory(self) -> CascadeInvalidator:
        """Create default cascade invalidator."""
        return CascadeInvalidator(
            schema=None, config=self.config  # Would be set by GraphQL framework
        )

    async def intercept_mutation(
        self,
        execute_fn: Callable[..., Awaitable[Any]],
        mutation_name: str,
        field_def: Any,
        args: Dict[str, Any],
        context: Any,
        info: Any,
    ) -> Any:
        """
        Intercept mutation execution to add cascade tracking.

        Args:
            execute_fn: Function to execute the mutation
            mutation_name: Name of the mutation
            field_def: GraphQL field definition
            args: Mutation arguments
            context: GraphQL context
            info: GraphQL resolve info

        Returns:
            CascadeResponse if mutation has @cascade directive, otherwise normal result
        """
        # Check if mutation has @cascade directive
        if not self._has_cascade_directive(field_def):
            # Normal execution
            return await execute_fn()

        # Get cascade configuration from directive
        cascade_config = self._get_cascade_config(field_def)

        # Create tracker and invalidator
        tracker = self.tracker_factory()
        invalidator = self.invalidator_factory()

        # Apply directive configuration
        self._configure_tracker(tracker, cascade_config)

        # Execute mutation with cascade tracking
        async with CascadeTransaction(tracker):
            try:
                # Execute the actual mutation
                result = await execute_fn()

                # Build cascade response
                builder = CascadeBuilder(tracker, invalidator)
                cascade_response = builder.build_response(result, success=True)

                return cascade_response

            except Exception as e:
                # Handle mutation errors
                error = CascadeError(message=str(e), code="INTERNAL_ERROR")

                builder = CascadeBuilder(tracker)
                cascade_response = builder.build_error_response([error])

                return cascade_response

    def _has_cascade_directive(self, field_def: Any) -> bool:
        """Check if field has @cascade directive."""
        if not hasattr(field_def, "directives"):
            return False

        directives = field_def.directives or []
        return any(directive.name.value == "cascade" for directive in directives)

    def _get_cascade_config(self, field_def: Any) -> Dict[str, Any]:
        """Extract cascade configuration from directive."""
        config = {"maxDepth": 3, "includeRelated": True, "autoInvalidate": True, "excludeTypes": []}

        if not hasattr(field_def, "directives"):
            return config

        for directive in field_def.directives or []:
            if directive.name.value == "cascade":
                # Extract arguments from directive
                for arg in directive.arguments or []:
                    arg_name = arg.name.value
                    arg_value = self._parse_directive_value(arg.value)

                    if arg_name == "maxDepth":
                        config["maxDepth"] = arg_value
                    elif arg_name == "includeRelated":
                        config["includeRelated"] = arg_value
                    elif arg_name == "autoInvalidate":
                        config["autoInvalidate"] = arg_value
                    elif arg_name == "excludeTypes":
                        config["excludeTypes"] = arg_value

        return config

    def _parse_directive_value(self, value_node: Any) -> Any:
        """Parse GraphQL directive argument value."""
        if hasattr(value_node, "value"):
            return value_node.value
        elif hasattr(value_node, "values"):
            # List value
            return [self._parse_directive_value(v) for v in value_node.values]
        else:
            # Complex value - return as-is for now
            return value_node

    def _configure_tracker(self, tracker: CascadeTracker, config: Dict[str, Any]) -> None:
        """Configure tracker with cascade directive settings."""
        tracker.max_depth = config.get("maxDepth", tracker.max_depth)
        tracker.exclude_types = set(config.get("excludeTypes", []))
        tracker.enable_relationship_tracking = config.get("includeRelated", True)


class AriadneCascadeMiddleware(CascadeMiddleware):
    """
    Ariadne-specific cascade middleware.
    """

    def get_middleware(self) -> Callable:
        """Get Ariadne middleware function."""

        async def middleware(next_resolver, root, info, **kwargs):
            field_def = info.field_definition

            async def execute_fn():
                return await next_resolver(root, info, **kwargs)

            return await self.intercept_mutation(
                execute_fn, info.field_name, field_def, kwargs, root, info
            )

        return middleware


class StrawberryCascadeExtension:
    """
    Strawberry GraphQL extension for cascade support.
    """

    def __init__(self, middleware: CascadeMiddleware):
        self.middleware = middleware

    def on_operation(self) -> None:
        """Hook into Strawberry operation execution."""
        # Implementation would integrate with Strawberry's extension system
        pass


class GraphQLYogaCascadePlugin:
    """
    GraphQL Yoga plugin for cascade support.
    """

    def __init__(self, middleware: CascadeMiddleware):
        self.middleware = middleware

    def onExecute(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Hook into Yoga execution."""
        # Check if operation is a mutation with cascade
        if payload.get("operation", {}).get("operation") == "mutation":
            # Apply cascade logic
            pass

        return payload


# Apollo Server integration would require custom plugins
# due to Apollo's complex plugin system

# Utility functions


@asynccontextmanager
async def cascade_transaction(tracker: CascadeTracker):
    """
    Context manager for cascade transactions.

    Usage:
        async with cascade_transaction(tracker):
            # Execute mutation logic
            user = create_user(...)
            tracker.track_create(user)
    """
    transaction_id = tracker.start_transaction()
    try:
        yield transaction_id
    finally:
        # Transaction end is handled by builder
        pass


def create_cascade_middleware(
    tracker_config: Optional[Dict[str, Any]] = None,
    invalidator_config: Optional[Dict[str, Any]] = None,
) -> CascadeMiddleware:
    """
    Create a configured cascade middleware instance.

    Args:
        tracker_config: Configuration for cascade tracker
        invalidator_config: Configuration for cascade invalidator

    Returns:
        Configured CascadeMiddleware instance
    """
    tracker_config = tracker_config or {}
    invalidator_config = invalidator_config or {}

    def tracker_factory():
        return CascadeTracker(**tracker_config)

    def invalidator_factory():
        return CascadeInvalidator(config=invalidator_config)

    return CascadeMiddleware(
        tracker_factory=tracker_factory,
        invalidator_factory=invalidator_factory,
        config={**tracker_config, **invalidator_config},
    )


# Example usage


def example_ariadne_integration() -> Any:
    """Example of integrating with Ariadne."""
    from ariadne import make_executable_schema

    # Create middleware
    create_cascade_middleware()

    # Create Ariadne middleware
    ariadne_middleware = AriadneCascadeMiddleware()

    # Placeholder definitions
    type_defs = []
    mutation_resolvers = {}

    # Add to schema
    schema = make_executable_schema(
        type_defs, mutation_resolvers, middleware=[ariadne_middleware.get_middleware()]
    )

    return schema


def example_strawberry_integration() -> Any:
    """Example of integrating with Strawberry."""
    import strawberry

    # Create extension
    middleware = create_cascade_middleware()
    extension = StrawberryCascadeExtension(middleware)

    # Placeholder definitions
    @strawberry.type
    class Query:
        pass

    # Add to schema
    @strawberry.type
    class Mutation:
        # Mutation definitions...
        pass

    schema = strawberry.Schema(query=Query, mutation=Mutation, extensions=[extension])

    return schema
