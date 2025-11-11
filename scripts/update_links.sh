#!/bin/bash
# GraphQL Cascade Link Update Script
#
# This script updates relative links in markdown files after file moves.
# It can update links from old paths to new paths across all documentation.
#
# Usage:
#   ./scripts/update_links.sh <old_path> <new_path> [options]
#
# Options:
#   --dry-run      Show what would be changed without modifying files
#   --verbose      Show detailed output
#   -h, --help     Show this help message
#
# Examples:
#   ./scripts/update_links.sh docs/old-guide.md docs/getting-started/new-guide.md
#   ./scripts/update_links.sh "docs/" "docs/getting-started/" --dry-run

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# Default values
DRY_RUN=""
VERBOSE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN="true"
            shift
            ;;
        --verbose)
            VERBOSE="true"
            shift
            ;;
        -h|--help)
            echo "GraphQL Cascade Link Update Script"
            echo ""
            echo "Usage: $0 <old_path> <new_path> [options]"
            echo ""
            echo "Options:"
            echo "  --dry-run      Show what would be changed without modifying files"
            echo "  --verbose      Show detailed output"
            echo "  -h, --help     Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 docs/old-guide.md docs/getting-started/new-guide.md"
            echo "  $0 \"docs/\" \"docs/getting-started/\" --dry-run"
            exit 0
            ;;
        *)
            if [[ -z "$OLD_PATH" ]]; then
                OLD_PATH="$1"
            elif [[ -z "$NEW_PATH" ]]; then
                NEW_PATH="$1"
            else
                echo "❌ Too many arguments. Expected: old_path new_path"
                echo "Run '$0 --help' for usage information."
                exit 1
            fi
            shift
            ;;
    esac
done

# Validate arguments
if [[ -z "$OLD_PATH" || -z "$NEW_PATH" ]]; then
    echo "❌ Missing required arguments: old_path and new_path"
    echo "Run '$0 --help' for usage information."
    exit 1
fi

cd "$REPO_ROOT"

echo "🔗 GraphQL Cascade Link Update Script"
echo "===================================="
echo "Old path: $OLD_PATH"
echo "New path: $NEW_PATH"
if [[ -n "$DRY_RUN" ]]; then
    echo "Mode: DRY RUN (no files will be modified)"
fi
echo ""

# Function to calculate relative path between two files
calculate_relative_path() {
    local from="$1"
    local to="$2"

    # Get directory of 'from' file
    local from_dir=$(dirname "$from")

    # Calculate relative path from from_dir to to
    local relative_path=""

    # Count directory levels to go up
    local up_count=$(echo "$from_dir" | tr -cd '/' | wc -c)

    # Add ../ for each level
    for ((i=0; i<up_count; i++)); do
        relative_path+="../"
    done

    # Add the target path
    relative_path+="$to"

    echo "$relative_path"
}

# Function to update links in a file
update_links_in_file() {
    local file="$1"
    local old_path="$2"
    local new_path="$3"

    local changed=false
    local link_count=0

    # Create a temporary file
    local temp_file=$(mktemp)

    while IFS= read -r line; do
        # Look for markdown links that reference the old path
        if echo "$line" | grep -q "\[.*\]($old_path"; then
            local old_line="$line"
            # Replace the old path with new path in links
            line=$(echo "$line" | sed "s|]($old_path|]($new_path|g")
            changed=true
            link_count=$((link_count + 1))

            if [[ -n "$VERBOSE" ]]; then
                echo "  📝 $file: $old_line"
                echo "     → $line"
            fi
        fi
        echo "$line" >> "$temp_file"
    done < "$file"

    if [[ "$changed" == "true" ]]; then
        if [[ -n "$DRY_RUN" ]]; then
            echo "  📋 Would update $link_count link(s) in $file"
        else
            mv "$temp_file" "$file"
            echo "  ✓ Updated $link_count link(s) in $file"
        fi
        return 0
    else
        rm "$temp_file"
        return 1
    fi
}

# Find all markdown files
echo "🔍 Finding markdown files..."
mapfile -t markdown_files < <(find . -name "*.md" -not -path "./node_modules/*" -not -path "./.git/*")

echo "📄 Found ${#markdown_files[@]} markdown files"
echo ""

# Process each markdown file
updated_files=0
total_links=0

for file in "${markdown_files[@]}"; do
    if update_links_in_file "$file" "$OLD_PATH" "$NEW_PATH"; then
        updated_files=$((updated_files + 1))
        # Count links in this file (rough estimate)
        local file_links=$(grep -c "\[.*\]($NEW_PATH" "$file" 2>/dev/null || echo "0")
        total_links=$((total_links + file_links))
    fi
done

echo ""
echo "📊 Summary:"
echo "=========="
if [[ -n "$DRY_RUN" ]]; then
    echo "Would update $updated_files file(s) with $total_links link(s)"
else
    echo "Updated $updated_files file(s) with $total_links link(s)"
fi

if [[ $updated_files -eq 0 ]]; then
    echo "ℹ️ No files needed updating"
else
    echo "✅ Link update complete!"
fi