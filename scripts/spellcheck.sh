#!/bin/bash
# GraphQL Cascade Spell Check Script
#
# This script performs spell checking on markdown documentation files.
# It uses available spell check tools and provides a basic word list.
#
# Usage:
#   ./scripts/spellcheck.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🔤 Spell Checking Documentation"
echo "==============================="

cd "$REPO_ROOT"

# Create custom word list for technical terms
cat > /tmp/custom_words.txt << 'EOF'
GraphQL
API
APIs
backend
frontend
cache
caching
cascades
cascade
mutation
mutations
subscription
subscriptions
schema
schemas
directive
directives
resolver
resolvers
optimistic
invalidation
entity
entities
identification
conformance
middleware
serialization
deserialization
TypeScript
JavaScript
URQL
React
Query
Relay
Apollo
FraiseQL
Strawberry
TOML
YAML
JSON
CI
CD
PR
EOF

ISSUES_FOUND=0

# Function to check spelling in a file
check_spelling() {
    local file="$1"
    echo "  ✓ Checking $file"

    # Extract text content (remove markdown formatting)
    local text_content
    text_content=$(sed 's/`[^`]*`//g; s/\[\([^\]]*\)\]([^)]*)/\1/g; s/^[#]* //g; s/^\* //g; s/^[0-9]*\. //g' "$file" | tr -d '[]()')

    # Use aspell if available
    if command -v aspell &> /dev/null; then
        echo "$text_content" | aspell --lang=en --encoding=utf-8 --personal=/tmp/custom_words.txt list | while read word; do
            if [[ -n "$word" ]]; then
                echo "    ⚠ Possible misspelling: $word"
                ISSUES_FOUND=$((ISSUES_FOUND + 1))
            fi
        done
    else
        echo "    ⚠ aspell not available, skipping spell check"
    fi
}

# Check all markdown files
find . -name "*.md" -not -path "./node_modules/*" -not -path "./.git/*" | while read file; do
    check_spelling "$file"
done

echo ""
if [[ $ISSUES_FOUND -eq 0 ]]; then
    echo "✅ No spelling issues found!"
else
    echo "⚠️ Found $ISSUES_FOUND potential spelling issues"
fi