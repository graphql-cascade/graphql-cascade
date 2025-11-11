#!/bin/bash
# GraphQL Cascade Table of Contents Generator
#
# This script generates table of contents for markdown files.
# It uses markdown-toc or a similar tool to auto-generate TOCs.
#
# Usage:
#   ./scripts/generate_toc.sh [file.md] [options]
#
# Options:
#   --all          Process all markdown files in the repository
#   --dry-run      Show what would be changed without modifying files
#   --force        Overwrite existing TOCs
#   -h, --help     Show this help message

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# Default values
PROCESS_ALL=""
DRY_RUN=""
FORCE=""
TOC_MARKER="<!-- toc -->"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --all)
            PROCESS_ALL="true"
            shift
            ;;
        --dry-run)
            DRY_RUN="true"
            shift
            ;;
        --force)
            FORCE="true"
            shift
            ;;
        -h|--help)
            echo "GraphQL Cascade Table of Contents Generator"
            echo ""
            echo "Usage: $0 [file.md] [options]"
            echo ""
            echo "Options:"
            echo "  --all          Process all markdown files in the repository"
            echo "  --dry-run      Show what would be changed without modifying files"
            echo "  --force        Overwrite existing TOCs"
            echo "  -h, --help     Show this help message"
            exit 0
            ;;
        *)
            TARGET_FILE="$1"
            shift
            ;;
    esac
done

cd "$REPO_ROOT"

# Function to generate TOC for a single file
generate_toc() {
    local file="$1"
    local relative_path="${file#./}"

    echo "📝 Processing $relative_path..."

    # Check if file has TOC marker
    if ! grep -q "$TOC_MARKER" "$file"; then
        if [[ -z "$FORCE" ]]; then
            echo "  ⚠️ No TOC marker found in $relative_path (use --force to add one)"
            return
        else
            # Add TOC marker after the first heading
            sed -i '1{/^#/a\
<!-- toc -->
}' "$file"
            echo "  ✓ Added TOC marker to $relative_path"
        fi
    fi

    # Check if markdown-toc is available
    if command -v markdown-toc &> /dev/null; then
        if [[ -n "$DRY_RUN" ]]; then
            echo "  📋 Would generate TOC for $relative_path"
            markdown-toc "$file" | head -20
        else
            # Generate TOC and replace the marker
            markdown-toc -i "$file"
            echo "  ✓ Generated TOC for $relative_path"
        fi
    else
        echo "  ⚠️ markdown-toc not installed. Install with: npm install -g markdown-toc"
        # Fallback: simple TOC generation
        generate_simple_toc "$file"
    fi
}

# Fallback TOC generation using grep and sed
generate_simple_toc() {
    local file="$1"

    echo "  🔧 Generating simple TOC..."

    # Extract headings and create TOC
    local toc_content=""
    local level=0

    while IFS= read -r line; do
        if [[ $line =~ ^(#{1,6})\ (.+)$ ]]; then
            local heading_level="${#BASH_REMATCH[1]}"
            local heading_text="${BASH_REMATCH[2]}"
            local indent=""

            # Create indentation
            for ((i=1; i<heading_level; i++)); do
                indent+="  "
            done

            # Create anchor link
            local anchor=$(echo "$heading_text" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//')
            toc_content+="${indent}- [${heading_text}](#${anchor})"$'\n'
        fi
    done < <(grep "^#" "$file")

    if [[ -n "$DRY_RUN" ]]; then
        echo "  📋 Would insert TOC:"
        echo "$toc_content"
    else
        # Replace TOC marker with generated content
        local temp_file=$(mktemp)
        awk -v toc="$toc_content" -v marker="$TOC_MARKER" '
        $0 == marker {
            print marker
            print toc
            next
        }
        { print }
        ' "$file" > "$temp_file" && mv "$temp_file" "$file"

        echo "  ✓ Generated simple TOC for $file"
    fi
}

echo "📚 GraphQL Cascade Table of Contents Generator"
echo "============================================="

if [[ -n "$PROCESS_ALL" ]]; then
    echo "Processing all markdown files..."
    echo ""

    # Find all markdown files, excluding certain directories
    while IFS= read -r -d '' file; do
        generate_toc "$file"
    done < <(find . -name "*.md" -not -path "./node_modules/*" -not -path "./.git/*" -print0)

elif [[ -n "$TARGET_FILE" ]]; then
    if [[ ! -f "$TARGET_FILE" ]]; then
        echo "❌ File not found: $TARGET_FILE"
        exit 1
    fi

    generate_toc "$TARGET_FILE"

else
    echo "❌ No target file specified. Use --all or provide a file path."
    echo "Run '$0 --help' for usage information."
    exit 1
fi

echo ""
echo "✅ Table of contents generation complete!"