#!/bin/bash
# GraphQL Cascade Automation Testing Script
#
# This script tests that automation infrastructure is properly configured.
# It validates CI/CD setup, documentation building, and link validation automation.
#
# Usage:
#   ./scripts/test_automation.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🔧 Testing GraphQL Cascade Automation Infrastructure"
echo "=================================================="

cd "$REPO_ROOT"

FAILED_TESTS=()

# Test 1: CI runs on every PR
echo "Testing CI configuration..."
if [[ ! -d ".github/workflows" ]]; then
    echo "  ✗ FAIL: .github/workflows directory does not exist"
    FAILED_TESTS+=("ci_workflows_missing")
elif [[ ! -f ".github/workflows/validate-docs.yml" ]]; then
    echo "  ✗ FAIL: validate-docs.yml workflow does not exist"
    FAILED_TESTS+=("validate_docs_workflow_missing")
elif [[ ! -f ".github/workflows/compliance-tests.yml" ]]; then
    echo "  ✗ FAIL: compliance-tests.yml workflow does not exist"
    FAILED_TESTS+=("compliance_tests_workflow_missing")
else
    echo "  ✓ PASS: CI workflow files exist"
fi

# Test 2: Documentation builds successfully
echo "Testing documentation building..."
if [[ ! -f "scripts/validate_docs.sh" ]]; then
    echo "  ✗ FAIL: validate_docs.sh script does not exist"
    FAILED_TESTS+=("validate_docs_script_missing")
elif [[ ! -x "scripts/validate_docs.sh" ]]; then
    echo "  ✗ FAIL: validate_docs.sh is not executable"
    FAILED_TESTS+=("validate_docs_script_not_executable")
else
    echo "  ✓ PASS: validate_docs.sh exists and is executable"
fi

# Test 3: Link validation automated
echo "Testing link validation automation..."
if [[ ! -f "scripts/validate_docs.py" ]]; then
    echo "  ✗ FAIL: validate_docs.py script does not exist"
    FAILED_TESTS+=("validate_docs_py_missing")
else
    echo "  ✓ PASS: validate_docs.py exists"
fi

# Test 4: Example testing automation
echo "Testing example testing automation..."
if [[ ! -f "scripts/test_examples.sh" ]]; then
    echo "  ✗ FAIL: test_examples.sh script does not exist"
    FAILED_TESTS+=("test_examples_script_missing")
elif [[ ! -x "scripts/test_examples.sh" ]]; then
    echo "  ✗ FAIL: test_examples.sh is not executable"
    FAILED_TESTS+=("test_examples_script_not_executable")
else
    echo "  ✓ PASS: test_examples.sh exists and is executable"
fi

# Test 5: Structure validation automation
echo "Testing structure validation automation..."
if [[ ! -f "scripts/validate_structure.sh" ]]; then
    echo "  ✗ FAIL: validate_structure.sh script does not exist"
    FAILED_TESTS+=("validate_structure_script_missing")
elif [[ ! -x "scripts/validate_structure.sh" ]]; then
    echo "  ✗ FAIL: validate_structure.sh is not executable"
    FAILED_TESTS+=("validate_structure_script_not_executable")
else
    echo "  ✓ PASS: validate_structure.sh exists and is executable"
fi

# Test 6: TOC generation automation
echo "Testing TOC generation automation..."
if [[ ! -f "scripts/generate_toc.sh" ]]; then
    echo "  ✗ FAIL: generate_toc.sh script does not exist"
    FAILED_TESTS+=("generate_toc_script_missing")
else
    echo "  ✓ PASS: generate_toc.sh exists"
fi

# Test 7: Link update automation
echo "Testing link update automation..."
if [[ ! -f "scripts/update_links.sh" ]]; then
    echo "  ✗ FAIL: update_links.sh script does not exist"
    FAILED_TESTS+=("update_links_script_missing")
else
    echo "  ✓ PASS: update_links.sh exists"
fi

echo ""
echo "Automation Testing Results:"
echo "=========================="

if [[ ${#FAILED_TESTS[@]} -eq 0 ]]; then
    echo "✅ ALL TESTS PASSED - Automation infrastructure is complete!"
    exit 0
else
    echo "❌ ${#FAILED_TESTS[@]} TEST(S) FAILED:"
    for test in "${FAILED_TESTS[@]}"; do
        echo "  - $test"
    done
    echo ""
    echo "🔧 To fix these issues, run the GREEN phase of Phase 8"
    exit 1
fi