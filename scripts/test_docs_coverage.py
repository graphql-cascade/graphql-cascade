#!/usr/bin/env python3
"""
Documentation Coverage Tests for GraphQL Cascade

This script tests that all required documentation exists and has required sections.
Run this to verify documentation completeness before public release.
"""

import os
import sys
from pathlib import Path

def test_file_exists(file_path, description):
    """Test that a file exists."""
    if not os.path.exists(file_path):
        print(f"FAIL: {description} - {file_path} does not exist")
        return False
    print(f"PASS: {description} - {file_path} exists")
    return True

def test_file_has_content(file_path, required_sections, description):
    """Test that a file exists and contains required sections."""
    if not os.path.exists(file_path):
        print(f"FAIL: {description} - {file_path} does not exist")
        return False

    with open(file_path, 'r') as f:
        content = f.read()

    missing_sections = []
    for section in required_sections:
        if section.lower() not in content.lower():
            missing_sections.append(section)

    if missing_sections:
        print(f"FAIL: {description} - Missing sections: {', '.join(missing_sections)}")
        return False

    print(f"PASS: {description} - All required sections present")
    return True

def test_directory_exists(dir_path, description):
    """Test that a directory exists."""
    if not os.path.exists(dir_path):
        print(f"FAIL: {description} - {dir_path} does not exist")
        return False
    print(f"PASS: {description} - {dir_path} exists")
    return True

def main():
    """Run all documentation coverage tests."""
    print("🧪 GraphQL Cascade Documentation Coverage Tests")
    print("=" * 50)

    repo_root = Path(__file__).parent.parent
    os.chdir(repo_root)

    tests_passed = 0
    total_tests = 0

    # Test root README.md
    total_tests += 1
    required_sections = [
        "GraphQL Cascade",
        "Overview",
        "Problem",
        "Solution",
        "Quick Start",
        "Getting Started",
        "Examples",
        "Specification",
        "Contributing"
    ]
    if test_file_has_content("README.md", required_sections, "Root README.md completeness"):
        tests_passed += 1

    # Test CONTRIBUTING.md
    total_tests += 1
    required_sections = [
        "Contributing",
        "Development Setup",
        "Testing",
        "Pull Request",
        "Code of Conduct"
    ]
    if test_file_has_content("CONTRIBUTING.md", required_sections, "CONTRIBUTING.md completeness"):
        tests_passed += 1

    # Test docs/getting-started/ directory
    total_tests += 1
    if test_directory_exists("docs/getting-started", "docs/getting-started/ directory"):
        tests_passed += 1

    # Test docs/getting-started/quick-start.md
    total_tests += 1
    required_sections = [
        "Quick Start",
        "5 minutes",
        "Setup",
        "Example",
        "Expected Output"
    ]
    if test_file_has_content("docs/getting-started/quick-start.md", required_sections, "Quick Start guide completeness"):
        tests_passed += 1

    # Test docs/guides/ directory
    total_tests += 1
    if test_directory_exists("docs/guides", "docs/guides/ directory"):
        tests_passed += 1

    # Test docs/guides/server-implementation.md
    total_tests += 1
    required_sections = [
        "Server Implementation",
        "Setup",
        "Cascade Tracking",
        "Testing",
        "Common Pitfalls"
    ]
    if test_file_has_content("docs/guides/server-implementation.md", required_sections, "Server implementation guide completeness"):
        tests_passed += 1

    # Test docs/guides/client-integration.md
    total_tests += 1
    required_sections = [
        "Client Integration",
        "Apollo",
        "Relay",
        "React Query",
        "URQL",
        "Configuration"
    ]
    if test_file_has_content("docs/guides/client-integration.md", required_sections, "Client integration guide completeness"):
        tests_passed += 1

    # Test docs/getting-started/README.md
    total_tests += 1
    if test_file_exists("docs/getting-started/README.md", "Getting Started README.md"):
        tests_passed += 1

    # Test docs/guides/README.md
    total_tests += 1
    if test_file_exists("docs/guides/README.md", "Guides README.md"):
        tests_passed += 1

    print("\n" + "=" * 50)
    print(f"Results: {tests_passed}/{total_tests} tests passed")

    if tests_passed == total_tests:
        print("✅ All documentation coverage tests PASSED")
        return 0
    else:
        print("❌ Some documentation coverage tests FAILED")
        print("Run this script again after implementing missing documentation.")
        return 1

if __name__ == "__main__":
    sys.exit(main())