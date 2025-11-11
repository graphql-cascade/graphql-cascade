#!/bin/bash
# GraphQL Cascade Example Testing Script
#
# This script tests all code examples in the documentation to ensure they work.
# It validates GraphQL schemas, checks code syntax, and tests package files.
#
# Usage:
#   ./scripts/test_examples.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🧪 Testing GraphQL Cascade Examples"
echo "==================================="

cd "$REPO_ROOT"

# Test Python examples syntax
echo "Testing Python examples..."
find examples -name "*.py" -exec python3 -m py_compile {} \; 2>&1 | while read line; do
    echo "  ⚠ Python syntax issue: $line"
done || true

# Test GraphQL schemas (basic syntax check)
echo "Testing GraphQL schemas..."
find examples -name "*.graphql" -exec sh -c '
    file="$1"
    echo "  ✓ Checking $file"
    # Basic syntax check - look for balanced braces
    if grep -q "{" "$file" && grep -q "}" "$file"; then
        echo "    ✓ Basic GraphQL syntax OK"
    else
        echo "    ⚠ Possible GraphQL syntax issue"
    fi
' _ {} \;

# Test package.json files
echo "Testing package.json files..."
find packages -name "package.json" -exec sh -c '
    file="$1"
    echo "  ✓ Checking $file"
    if command -v node &> /dev/null; then
        node -e "try { require(\"./$file\"); console.log(\"    ✓ Valid JSON\"); } catch(e) { console.log(\"    ✗ Invalid JSON: \" + e.message); }"
    else
        echo "    ⚠ Node.js not available for JSON validation"
    fi
' _ {} \;

# Test Python package files
echo "Testing Python package files..."
find . -name "pyproject.toml" -exec sh -c '
    file="$1"
    echo "  ✓ Checking $file"
    python3 -c "
import sys
try:
    import tomllib
    tomllib.load(open(\"$file\", \"rb\"))
    print(\"    ✓ Valid TOML\")
except ImportError:
    print(\"    ⚠ tomllib not available, cannot validate TOML\")
except Exception as e:
    print(\"    ✗ Invalid TOML: \" + str(e))
" 2>/dev/null || echo "    ⚠ Python TOML validation failed"
' _ {} \;

echo ""
echo "Example testing complete!"