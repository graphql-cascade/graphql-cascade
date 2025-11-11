#!/bin/bash
# GraphQL Cascade Structure Validation Script
#
# This script validates that the repository follows the target documentation structure.
#
# Usage:
#   ./scripts/validate_structure.sh [options]
#
# Options:
#   -v, --verbose          Enable verbose output
#   -c, --create-stubs     Create stub files and directories
#   -h, --help            Show this help message

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# Default values
VERBOSE=""
CREATE_STUBS=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE="--verbose"
            shift
            ;;
        -c|--create-stubs)
            CREATE_STUBS="--create-stubs"
            shift
            ;;
        -h|--help)
            echo "GraphQL Cascade Structure Validation Script"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  -v, --verbose          Enable verbose output"
            echo "  -c, --create-stubs     Create stub files and directories"
            echo "  -h, --help            Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

# Check if Python script exists
PYTHON_SCRIPT="$SCRIPT_DIR/validate_structure.py"
if [[ ! -f "$PYTHON_SCRIPT" ]]; then
    echo "Error: Python validation script not found at $PYTHON_SCRIPT"
    exit 1
fi

# Run the Python validation script
cd "$REPO_ROOT"
python "$PYTHON_SCRIPT" $VERBOSE $CREATE_STUBS