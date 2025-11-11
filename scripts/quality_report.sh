#!/bin/bash
# GraphQL Cascade Quality Report Generator
#
# This script generates a comprehensive quality report for the repository.
# It combines results from all validation scripts and provides metrics.
#
# Usage:
#   ./scripts/quality_report.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

OUTPUT_FILE="QUALITY_REPORT.md"

echo "📊 Generating Quality Report"
echo "============================"

cd "$REPO_ROOT"

# Initialize report
cat > "$OUTPUT_FILE" << 'EOF'
# GraphQL Cascade Quality Report

**Generated:** $(date)
**Repository:** GraphQL Cascade

## Executive Summary

This report provides a comprehensive assessment of documentation and code quality for the GraphQL Cascade project.

---

## Quality Metrics

EOF

# Run validation checks and collect results
echo "Running validation checks..."

# Documentation validation
echo "  ✓ Running documentation validation..."
DOC_RESULTS=$(python3 scripts/validate_docs.py 2>&1 | tail -10)
DOC_ERRORS=$(echo "$DOC_RESULTS" | grep -o "Errors: [0-9]*" | cut -d' ' -f2)
DOC_WARNINGS=$(echo "$DOC_RESULTS" | grep -o "Warnings: [0-9]*" | cut -d' ' -f2)

# Example testing
echo "  ✓ Running example validation..."
EXAMPLE_RESULTS=$(bash scripts/test_examples.sh 2>&1 | grep -E "(✓|⚠|✗)" | wc -l)

# Spell checking
echo "  ✓ Running spell check..."
SPELL_RESULTS=$(bash scripts/spellcheck.sh 2>&1 | grep -c "⚠")

# File counts
MD_FILES=$(find . -name "*.md" -not -path "./node_modules/*" -not -path "./.git/*" | wc -l)
TOTAL_FILES=$(find . -type f -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./__pycache__/*" | wc -l)
TOTAL_SIZE=$(find . -type f -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./__pycache__/*" -exec stat -f%z {} + 2>/dev/null | awk '{sum += $1} END {print sum/1024/1024 " MB"}' 2>/dev/null || echo "N/A")

# Add metrics to report
cat >> "$OUTPUT_FILE" << EOF

### Documentation Quality
- **Markdown files:** $MD_FILES
- **Total files:** $TOTAL_FILES
- **Repository size:** $TOTAL_SIZE
- **Link validation errors:** ${DOC_ERRORS:-0}
- **Link validation warnings:** ${DOC_WARNINGS:-0}

### Code Quality
- **Example validation issues:** $EXAMPLE_RESULTS
- **Spelling issues:** $SPELL_RESULTS

---

## Detailed Results

EOF

# Add detailed sections
echo "### Documentation Validation" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "\`\`\`" >> "$OUTPUT_FILE"
python3 scripts/validate_docs.py | head -20 >> "$OUTPUT_FILE"
echo "\`\`\`" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "### Example Testing" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "\`\`\`" >> "$OUTPUT_FILE"
bash scripts/test_examples.sh 2>&1 | head -20 >> "$OUTPUT_FILE"
echo "\`\`\`" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "### Spell Check" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "\`\`\`" >> "$OUTPUT_FILE"
bash scripts/spellcheck.sh 2>&1 | head -20 >> "$OUTPUT_FILE"
echo "\`\`\`" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Add recommendations
cat >> "$OUTPUT_FILE" << 'EOF'

---

## Recommendations

### High Priority
1. **Fix broken links** - Address all broken internal links identified in validation
2. **Complete missing documentation** - Create stub files for referenced but missing guides
3. **Fix code examples** - Resolve syntax errors in example code

### Medium Priority
1. **Improve link validation** - Enhance the validation script to catch more issues
2. **Add spell check to CI** - Integrate automated spell checking
3. **Standardize formatting** - Ensure consistent markdown formatting across files

### Low Priority
1. **Add visual diagrams** - Include architecture diagrams and flow charts
2. **Enhance examples** - Add more comprehensive working examples
3. **Performance testing** - Add benchmarks for cascade operations

---

## Quality Gates

- [ ] **Zero broken internal links**
- [ ] **All code examples execute successfully**
- [ ] **No spelling errors in documentation**
- [ ] **Consistent formatting across all files**
- [ ] **All required documentation exists**

EOF

echo "✅ Quality report generated: $OUTPUT_FILE"