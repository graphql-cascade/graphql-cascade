#!/bin/bash
# GraphQL Cascade Documentation Validation Script
#
# This script provides a convenient wrapper around the Python validation tool.
# It runs validation and optionally generates reports.
#
# Usage:
#   ./scripts/validate_docs.sh [options]
#
# Options:
#   -v, --verbose          Enable verbose output
#   -g, --generate-reports Generate markdown reports in current directory
#   -o, --output-dir DIR   Output directory for reports (default: .)
#   -h, --help            Show this help message

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# Default values
VERBOSE=""
GENERATE_REPORTS=""
OUTPUT_DIR="."

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE="--verbose"
            shift
            ;;
        -g|--generate-reports)
            GENERATE_REPORTS="--generate-reports"
            shift
            ;;
        -o|--output-dir)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -h|--help)
            echo "GraphQL Cascade Documentation Validation Script"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  -v, --verbose          Enable verbose output"
            echo "  -g, --generate-reports Generate markdown reports"
            echo "  -o, --output-dir DIR   Output directory for reports (default: .)"
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
PYTHON_SCRIPT="$SCRIPT_DIR/validate_docs.py"
if [[ ! -f "$PYTHON_SCRIPT" ]]; then
    echo "Error: Python validation script not found at $PYTHON_SCRIPT"
    exit 1
fi

# Run the Python validation script
cd "$REPO_ROOT"
python "$PYTHON_SCRIPT" $VERBOSE $GENERATE_REPORTS --output-dir "$OUTPUT_DIR"