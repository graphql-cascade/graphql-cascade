"""
GraphQL Cascade Configuration

Configuration management for GraphQL Cascade server components.
"""

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml


class CascadeConfig:
    """
    Configuration manager for GraphQL Cascade.

    Handles loading, validation, and access to cascade configuration.
    """

    def __init__(self, config_dict: Optional[Dict[str, Any]] = None):
        self._config = config_dict or self._load_default_config()
        self._validate_config()

    @classmethod
    def from_file(cls, config_path: str) -> "CascadeConfig":
        """Load configuration from file."""
        path = Path(config_path)

        if not path.exists():
            raise FileNotFoundError(f"Config file not found: {config_path}")

        if path.suffix.lower() in [".yaml", ".yml"]:
            with open(path) as f:
                config_dict = yaml.safe_load(f)
        elif path.suffix.lower() == ".json":
            with open(path) as f:
                config_dict = json.load(f)
        else:
            raise ValueError(f"Unsupported config file format: {path.suffix}")

        return cls(config_dict)

    @classmethod
    def from_env(cls) -> "CascadeConfig":
        """Load configuration from environment variables."""
        config = {}

        # Load cascade settings
        cascade_config = {}

        # Tracking settings
        if "CASCADE_MAX_DEPTH" in os.environ:
            cascade_config["max_depth"] = int(os.environ["CASCADE_MAX_DEPTH"])

        if "CASCADE_EXCLUDE_TYPES" in os.environ:
            cascade_config["exclude_types"] = os.environ["CASCADE_EXCLUDE_TYPES"].split(",")

        if "CASCADE_TRACK_RELATIONSHIPS" in os.environ:
            cascade_config["enable_relationship_tracking"] = (
                os.environ["CASCADE_TRACK_RELATIONSHIPS"].lower() == "true"
            )

        # Response settings
        response_config = {}
        if "CASCADE_MAX_RESPONSE_SIZE_MB" in os.environ:
            response_config["max_response_size_mb"] = float(
                os.environ["CASCADE_MAX_RESPONSE_SIZE_MB"]
            )

        if "CASCADE_MAX_UPDATED_ENTITIES" in os.environ:
            response_config["max_updated_entities"] = int(
                os.environ["CASCADE_MAX_UPDATED_ENTITIES"]
            )

        if "CASCADE_MAX_DELETED_ENTITIES" in os.environ:
            response_config["max_deleted_entities"] = int(
                os.environ["CASCADE_MAX_DELETED_ENTITIES"]
            )

        if "CASCADE_MAX_INVALIDATIONS" in os.environ:
            response_config["max_invalidations"] = int(os.environ["CASCADE_MAX_INVALIDATIONS"])

        # Invalidation settings
        invalidation_config = {}
        if "CASCADE_AUTO_INVALIDATE" in os.environ:
            invalidation_config["auto_compute"] = (
                os.environ["CASCADE_AUTO_INVALIDATE"].lower() == "true"
            )

        if "CASCADE_INCLUDE_RELATED_INVALIDATIONS" in os.environ:
            invalidation_config["include_related"] = (
                os.environ["CASCADE_INCLUDE_RELATED_INVALIDATIONS"].lower() == "true"
            )

        # Combine configs
        if cascade_config:
            config["cascade"] = cascade_config
        if response_config:
            config["response"] = response_config
        if invalidation_config:
            config["invalidation"] = invalidation_config

        return cls(config)

    def _load_default_config(self) -> Dict[str, Any]:
        """Load default configuration."""
        return {
            "cascade": {
                "enabled": True,
                "max_depth": 3,
                "exclude_types": [],
                "enable_relationship_tracking": True,
                "tracking_strategy": "orm_hooks",
            },
            "response": {
                "max_response_size_mb": 5.0,
                "max_updated_entities": 500,
                "max_deleted_entities": 100,
                "max_invalidations": 50,
            },
            "invalidation": {"auto_compute": True, "include_related": True, "max_depth": 3},
            "performance": {
                "use_db_returning": True,
                "batch_fetches": True,
                "cache_metadata": True,
            },
        }

    def _validate_config(self) -> None:
        """Validate configuration values."""
        # Validate cascade settings
        cascade_config = self._config.get("cascade", {})

        if "max_depth" in cascade_config:
            max_depth = cascade_config["max_depth"]
            if not isinstance(max_depth, int) or max_depth < 0:
                raise ValueError("max_depth must be a non-negative integer")

        if "exclude_types" in cascade_config:
            exclude_types = cascade_config["exclude_types"]
            if not isinstance(exclude_types, list):
                raise ValueError("exclude_types must be a list")

        # Validate response settings
        response_config = self._config.get("response", {})

        if "max_response_size_mb" in response_config:
            max_size = response_config["max_response_size_mb"]
            if not isinstance(max_size, (int, float)) or max_size <= 0:
                raise ValueError("max_response_size_mb must be a positive number")

        if "max_updated_entities" in response_config:
            max_entities = response_config["max_updated_entities"]
            if not isinstance(max_entities, int) or max_entities <= 0:
                raise ValueError("max_updated_entities must be a positive integer")

        # Add more validations as needed

    def get(self, key: str, default: Any = None) -> Any:
        """Get configuration value."""
        keys = key.split(".")
        value = self._config

        for k in keys:
            if isinstance(value, dict):
                value = value.get(k)
            else:
                return default

        return value if value is not None else default

    def set(self, key: str, value: Any) -> None:
        """Set configuration value."""
        keys = key.split(".")
        config = self._config

        for k in keys[:-1]:
            if k not in config:
                config[k] = {}
            config = config[k]

        config[keys[-1]] = value

        # Re-validate after changes
        self._validate_config()

    def to_dict(self) -> Dict[str, Any]:
        """Export configuration as dictionary."""
        return self._config.copy()

    def save_to_file(self, config_path: str) -> None:
        """Save configuration to file."""
        path = Path(config_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        if path.suffix.lower() in [".yaml", ".yml"]:
            with open(path, "w") as f:
                yaml.dump(self._config, f, default_flow_style=False)
        elif path.suffix.lower() == ".json":
            with open(path, "w") as f:
                json.dump(self._config, f, indent=2)
        else:
            raise ValueError(f"Unsupported config file format: {path.suffix}")

    # Convenience properties

    @property
    def enabled(self) -> bool:
        """Check if cascade is enabled."""
        return self.get("cascade.enabled", True)

    @property
    def max_depth(self) -> int:
        """Get maximum cascade depth."""
        return self.get("cascade.max_depth", 3)

    @property
    def exclude_types(self) -> List[str]:
        """Get excluded entity types."""
        return self.get("cascade.exclude_types", [])

    @property
    def max_response_size_mb(self) -> float:
        """Get maximum response size in MB."""
        return self.get("response.max_response_size_mb", 5.0)

    @property
    def max_updated_entities(self) -> int:
        """Get maximum updated entities."""
        return self.get("response.max_updated_entities", 500)

    @property
    def max_invalidations(self) -> int:
        """Get maximum invalidations."""
        return self.get("response.max_invalidations", 50)


class ConfigBuilder:
    """
    Fluent builder for cascade configuration.
    """

    def __init__(self) -> None:
        self._config = CascadeConfig().to_dict()

    def enable_cascade(self, enabled: bool = True) -> "ConfigBuilder":
        """Enable or disable cascade."""
        self._config["cascade"]["enabled"] = enabled
        return self

    def max_depth(self, depth: int) -> "ConfigBuilder":
        """Set maximum cascade depth."""
        self._config["cascade"]["max_depth"] = depth
        return self

    def exclude_types(self, types: List[str]) -> "ConfigBuilder":
        """Set excluded entity types."""
        self._config["cascade"]["exclude_types"] = types
        return self

    def max_response_size(self, size_mb: float) -> "ConfigBuilder":
        """Set maximum response size."""
        self._config["response"]["max_response_size_mb"] = size_mb
        return self

    def max_entities(self, max_updated: int, max_deleted: int = 100) -> "ConfigBuilder":
        """Set maximum entity limits."""
        self._config["response"]["max_updated_entities"] = max_updated
        self._config["response"]["max_deleted_entities"] = max_deleted
        return self

    def build(self) -> CascadeConfig:
        """Build the configuration."""
        return CascadeConfig(self._config)


# Example configurations


def development_config() -> CascadeConfig:
    """Configuration for development environment."""
    return ConfigBuilder().max_depth(5).max_response_size(10.0).max_entities(1000).build()


def production_config() -> CascadeConfig:
    """Configuration for production environment."""
    return (
        ConfigBuilder()
        .max_depth(3)
        .max_response_size(5.0)
        .max_entities(500)
        .exclude_types(["AuditLog", "SystemEvent"])
        .build()
    )


def minimal_config() -> CascadeConfig:
    """Minimal configuration for testing."""
    return ConfigBuilder().max_depth(1).max_response_size(1.0).max_entities(50).build()


# Configuration validation


def validate_config_file(config_path: str) -> List[str]:
    """
    Validate a configuration file.

    Returns a list of validation errors, empty if valid.
    """
    try:
        CascadeConfig.from_file(config_path)
        return []
    except Exception as e:
        return [str(e)]


def merge_configs(base_config: CascadeConfig, override_config: CascadeConfig) -> CascadeConfig:
    """
    Merge two configurations, with override_config taking precedence.
    """
    merged = base_config.to_dict()

    def deep_merge(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
        result = base.copy()
        for key, value in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = deep_merge(result[key], value)
            else:
                result[key] = value
        return result

    return CascadeConfig(deep_merge(merged, override_config.to_dict()))
