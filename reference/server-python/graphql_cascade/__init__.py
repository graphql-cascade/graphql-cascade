"""
GraphQL Cascade - Server Reference Implementation

Automatic cache updates for GraphQL mutations.
"""

__version__ = "0.1.0"

from .tracker import CascadeTracker, CascadeTransaction, track_cascade
from .builder import (
    CascadeBuilder,
    CascadeResponse,
    CascadeError,
    StreamingCascadeBuilder,
    build_success_response,
    build_error_response,
    build_streaming_success_response,
)
from .invalidator import (
    CascadeInvalidator,
    OptimizedInvalidator,
    deduplicate_invalidations,
    prioritize_invalidations,
    batch_invalidations,
)
from .middleware import (
    CascadeMiddleware,
    AriadneCascadeMiddleware,
    StrawberryCascadeExtension,
    GraphQLYogaCascadePlugin,
    create_cascade_middleware,
    cascade_transaction,
)
from .config import (
    CascadeConfig,
    ConfigBuilder,
    development_config,
    production_config,
    minimal_config,
    validate_config_file,
    merge_configs,
)

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
]</content>
</xai:function_call name="run">
<parameter name="command">cd server-reference && mkdir -p tests examples