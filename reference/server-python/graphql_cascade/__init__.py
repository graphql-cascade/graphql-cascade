"""
GraphQL Cascade - Server Reference Implementation

Automatic cache updates for GraphQL mutations.
"""

__version__ = "1.1.0"

from .builder import (
    CascadeBuilder,
    CascadeError,
    CascadeResponse,
    StreamingCascadeBuilder,
    build_error_response,
    build_streaming_success_response,
    build_success_response,
)
from .config import (
    CascadeConfig,
    ConfigBuilder,
    development_config,
    merge_configs,
    minimal_config,
    production_config,
    validate_config_file,
)
# Error handling will be imported directly when needed
from .invalidator import (
    CascadeInvalidator,
    OptimizedInvalidator,
    batch_invalidations,
    deduplicate_invalidations,
    prioritize_invalidations,
)
from .middleware import (
    AriadneCascadeMiddleware,
    CascadeMiddleware,
    GraphQLYogaCascadePlugin,
    StrawberryCascadeExtension,
    cascade_transaction,
    create_cascade_middleware,
)
from .tracker import CascadeTracker, CascadeTransaction, track_cascade

__all__ = [
    "CascadeTracker",
    "CascadeBuilder",
    "CascadeInvalidator",
    "CascadeMiddleware",
    "CascadeConfig",
    "CascadeResponse",
    "CascadeError",
    "StreamingCascadeBuilder",
    "OptimizedInvalidator",
    "AriadneCascadeMiddleware",
    "StrawberryCascadeExtension",
    "GraphQLYogaCascadePlugin",
    "CascadeTransaction",
    "track_cascade",
    "cascade_transaction",
    "ConfigBuilder",
    "create_cascade_middleware",
    "build_success_response",
    "build_error_response",
    "build_streaming_success_response",
    "deduplicate_invalidations",
    "prioritize_invalidations",
    "batch_invalidations",
    "development_config",
    "production_config",
    "minimal_config",
    "validate_config_file",
    "merge_configs",
]
