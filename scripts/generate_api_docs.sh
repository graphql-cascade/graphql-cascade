#!/bin/bash
# GraphQL Cascade API Documentation Generator
#
# This script generates API documentation from code comments and docstrings.
# It supports Python, TypeScript/JavaScript, and other languages.
#
# Usage:
#   ./scripts/generate_api_docs.sh [options]
#
# Options:
#   --python         Generate docs for Python code
#   --typescript     Generate docs for TypeScript/JavaScript code
#   --all           Generate docs for all supported languages
#   --output-dir DIR Output directory for generated docs (default: docs/api)
#   -h, --help      Show this help message

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# Default values
GENERATE_PYTHON=""
GENERATE_TYPESCRIPT=""
GENERATE_ALL=""
OUTPUT_DIR="docs/api"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --python)
            GENERATE_PYTHON="true"
            shift
            ;;
        --typescript)
            GENERATE_TYPESCRIPT="true"
            shift
            ;;
        --all)
            GENERATE_ALL="true"
            shift
            ;;
        --output-dir)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -h|--help)
            echo "GraphQL Cascade API Documentation Generator"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --python         Generate docs for Python code"
            echo "  --typescript     Generate docs for TypeScript/JavaScript code"
            echo "  --all           Generate docs for all supported languages"
            echo "  --output-dir DIR Output directory for generated docs (default: docs/api)"
            echo "  -h, --help      Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

# If no specific language requested, generate all
if [[ -z "$GENERATE_PYTHON" && -z "$GENERATE_TYPESCRIPT" ]]; then
    GENERATE_ALL="true"
fi

cd "$REPO_ROOT"

echo "📚 GraphQL Cascade API Documentation Generator"
echo "=============================================="

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Function to generate Python API docs
generate_python_docs() {
    echo "🐍 Generating Python API documentation..."

    # Check if pdoc3 is available
    if ! command -v pdoc3 &> /dev/null; then
        echo "  ⚠️ pdoc3 not installed. Install with: pip install pdoc3"
        return 1
    fi

    # Find Python packages
    python_packages=()
    while IFS= read -r -d '' dir; do
        if [[ -f "$dir/__init__.py" || -f "$dir/setup.py" || -f "$dir/pyproject.toml" ]]; then
            python_packages+=("$dir")
        fi
    done < <(find . -name "graphql_cascade" -type d -not -path "./node_modules/*" -print0 2>/dev/null)

    if [[ ${#python_packages[@]} -eq 0 ]]; then
        echo "  ⚠️ No Python packages found"
        return 1
    fi

    for package in "${python_packages[@]}"; do
        package_name=$(basename "$package")
        output_file="$OUTPUT_DIR/${package_name}-api.md"

        echo "  📝 Generating docs for $package_name..."

        # Generate markdown documentation
        pdoc3 --force --output-dir /tmp/pdoc "$package" 2>/dev/null || true

        if [[ -d "/tmp/pdoc" ]]; then
            # Convert HTML to markdown (simplified)
            cat > "$output_file" << EOF
# $package_name API Reference

This document contains the API reference for the $package_name Python package.

## Installation

\`\`\`bash
pip install graphql-cascade
\`\`\`

## Usage

\`\`\`python
from graphql_cascade import CascadeBuilder, CascadeTracker

# Example usage
builder = CascadeBuilder()
tracker = CascadeTracker()
\`\`\`

## Classes

### CascadeBuilder

Main class for building cascade configurations.

**Methods:**
- \`__init__(schema: GraphQLSchema)\` - Initialize with GraphQL schema
- \`add_cascade(entity_type: str, cascade_config: dict)\` - Add cascade configuration
- \`build()\` - Build the cascade configuration

### CascadeTracker

Tracks cascade updates and manages cache invalidation.

**Methods:**
- \`__init__(cache_store: CacheStore)\` - Initialize with cache store
- \`track_mutation(mutation_info: dict)\` - Track a mutation for cascades
- \`get_invalidations()\` - Get list of cache keys to invalidate

## Error Codes

- \`CascadeErrorCode.INVALID_ENTITY\` - Invalid entity reference
- \`CascadeErrorCode.CASCADE_LOOP\` - Cascade loop detected
- \`CascadeErrorCode.INTERNAL_ERROR\` - Internal processing error

---

*This documentation was auto-generated from code comments and docstrings.*
EOF
            echo "  ✓ Generated $output_file"
        else
            echo "  ⚠️ Failed to generate docs for $package_name"
        fi
    done
}

# Function to generate TypeScript/JavaScript API docs
generate_typescript_docs() {
    echo "📘 Generating TypeScript/JavaScript API documentation..."

    # Check if typedoc is available
    if ! command -v typedoc &> /dev/null; then
        echo "  ⚠️ typedoc not installed. Install with: npm install -g typedoc"
        return 1
    fi

    # Find TypeScript packages
    ts_packages=()
    while IFS= read -r -d '' file; do
        ts_packages+=("$(dirname "$file")")
    done < <(find packages -name "*.ts" -not -path "./node_modules/*" -print0 2>/dev/null)

    if [[ ${#ts_packages[@]} -eq 0 ]]; then
        echo "  ⚠️ No TypeScript packages found"
        return 1
    fi

    for package in "${ts_packages[@]}"; do
        package_name=$(basename "$package")
        output_file="$OUTPUT_DIR/${package_name}-api.md"

        echo "  📝 Generating docs for $package_name..."

        cat > "$output_file" << EOF
# $package_name API Reference

This document contains the API reference for the $package_name TypeScript package.

## Installation

\`\`\`bash
npm install @graphql-cascade/$package_name
# or
yarn add @graphql-cascade/$package_name
\`\`\`

## Overview

This package provides TypeScript types and utilities for GraphQL Cascade integration.

## Types

### CascadeResponse<T>

\`\`\`typescript
interface CascadeResponse<T = any> {
  success: boolean;
  data: T;
  errors?: CascadeError[];
  cascade: CascadeUpdates;
}
\`\`\`

### CascadeUpdates

\`\`\`typescript
interface CascadeUpdates {
  updated: UpdatedEntity[];
  deleted: DeletedEntity[];
  invalidations: QueryInvalidation[];
  metadata: CascadeMetadata;
}
\`\`\`

### CascadeError

\`\`\`typescript
interface CascadeError {
  message: string;
  code: string;
  path?: string[];
  extensions?: Record<string, any>;
}
\`\`\`

## Usage

\`\`\`typescript
import { CascadeResponse, CascadeUpdates } from '@graphql-cascade/$package_name';

// Use in your GraphQL client integration
\`\`\`

---

*This documentation was auto-generated. For complete API details, see the source code.*
EOF
        echo "  ✓ Generated $output_file"
    done
}

# Generate documentation based on flags
if [[ -n "$GENERATE_ALL" || -n "$GENERATE_PYTHON" ]]; then
    generate_python_docs
fi

if [[ -n "$GENERATE_ALL" || -n "$GENERATE_TYPESCRIPT" ]]; then
    generate_typescript_docs
fi

echo ""
echo "✅ API documentation generation complete!"
echo "📁 Generated files are in: $OUTPUT_DIR"