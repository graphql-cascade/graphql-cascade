#!/usr/bin/env python3
"""
Repository Structure Validation Script

This script validates that the GraphQL Cascade repository follows the target documentation
structure for open-source specification projects.

Usage:
    python scripts/validate_structure.py [--verbose] [--create-stubs]

Returns:
    0 if structure is valid
    1 if structure validation fails
"""

import os
import argparse
from pathlib import Path
from typing import Dict, List, Set


class StructureValidator:
    def __init__(self, root_dir: Path, verbose: bool = False):
        self.root_dir = root_dir
        self.verbose = verbose
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def log(self, message: str):
        """Log message if verbose mode is enabled."""
        if self.verbose:
            print(message)

    def validate_root_files(self) -> bool:
        """Validate required root-level files exist."""
        self.log("Validating root-level files...")

        required_files = [
            "README.md",
            "CONTRIBUTING.md",
            "CODE_OF_CONDUCT.md",
            "CHANGELOG.md",
            "LICENSE"
        ]

        missing_files = []
        for file in required_files:
            if not (self.root_dir / file).exists():
                missing_files.append(file)
                self.errors.append(f"Missing required root file: {file}")

        return len(missing_files) == 0

    def validate_directory_structure(self) -> bool:
        """Validate required directory structure exists."""
        self.log("Validating directory structure...")

        required_dirs = [
            "specification",
            "docs",
            "examples",
            "packages",
            "reference",
            "research",
            "design",
            ".github"
        ]

        missing_dirs = []
        for dir_name in required_dirs:
            dir_path = self.root_dir / dir_name
            if not dir_path.exists() or not dir_path.is_dir():
                missing_dirs.append(dir_name)
                self.errors.append(f"Missing required directory: {dir_name}")

        return len(missing_dirs) == 0

    def validate_specification_structure(self) -> bool:
        """Validate specification directory structure."""
        self.log("Validating specification structure...")

        spec_dir = self.root_dir / "specification"
        if not spec_dir.exists():
            return False

        # Required specification files
        required_spec_files = [
            "README.md",
            "00_introduction.md",
            "01_conformance.md",
            "02_cascade_model.md",
            "03_entity_identification.md",
            "04_mutation_responses.md",
            "05_invalidation.md",
            "06_subscriptions.md",
            "07_schema_conventions.md",
            "08_directives.md",
            "09_server_requirements.md",
            "10_tracking_algorithm.md",
            "11_invalidation_algorithm.md",
            "12_performance_requirements.md",
            "13_client_integration.md",
            "14_optimistic_updates.md",
            "15_conflict_resolution.md",
            "16_security.md",
            "17_performance.md"
        ]

        missing_spec_files = []
        for file in required_spec_files:
            if not (spec_dir / file).exists():
                missing_spec_files.append(file)
                self.errors.append(f"Missing specification file: specification/{file}")

        # Required appendices
        appendices_dir = spec_dir / "appendices"
        if not appendices_dir.exists():
            self.errors.append("Missing specification appendices directory")
            return False

        required_appendices = [
            "A_comparison_with_relay.md",
            "B_comparison_with_apollo.md",
            "C_migration_guide.md",
            "D_glossary.md",
            "E_examples.md"
        ]

        missing_appendices = []
        for file in required_appendices:
            if not (appendices_dir / file).exists():
                missing_appendices.append(file)
                self.errors.append(f"Missing specification appendix: specification/appendices/{file}")

        return len(missing_spec_files) == 0 and len(missing_appendices) == 0

    def validate_docs_structure(self) -> bool:
        """Validate docs directory structure."""
        self.log("Validating docs structure...")

        docs_dir = self.root_dir / "docs"
        if not docs_dir.exists():
            return False

        # Required docs subdirectories
        required_subdirs = [
            "getting-started",
            "guides",
            "tutorials",
            "api",
            "architecture"
        ]

        missing_subdirs = []
        for subdir in required_subdirs:
            subdir_path = docs_dir / subdir
            if not subdir_path.exists():
                missing_subdirs.append(subdir)
                self.errors.append(f"Missing docs subdirectory: docs/{subdir}")

        # Check for README.md in docs
        if not (docs_dir / "README.md").exists():
            self.errors.append("Missing docs/README.md")

        return len(missing_subdirs) == 0

    def validate_examples_structure(self) -> bool:
        """Validate examples directory structure."""
        self.log("Validating examples structure...")

        examples_dir = self.root_dir / "examples"
        if not examples_dir.exists():
            return False

        # Check for README.md
        if not (examples_dir / "README.md").exists():
            self.errors.append("Missing examples/README.md")

        # Should have at least some example directories
        example_dirs = [d for d in examples_dir.iterdir() if d.is_dir() and d.name != "__pycache__"]
        if len(example_dirs) == 0:
            self.warnings.append("No example directories found in examples/")

        return True

    def validate_packages_structure(self) -> bool:
        """Validate packages directory structure."""
        self.log("Validating packages structure...")

        packages_dir = self.root_dir / "packages"
        if not packages_dir.exists():
            return False

        # Required package types (warnings for missing ones during development)
        expected_packages = [
            "server",
            "client-core",
            "client-apollo",
            "client-relay",
            "client-react-query",
            "client-urql"
        ]

        missing_packages = []
        for package in expected_packages:
            package_dir = packages_dir / package
            if not package_dir.exists():
                missing_packages.append(package)
                self.warnings.append(f"Missing package directory: packages/{package}")

        return True  # Don't fail on missing packages during development

    def validate_reference_structure(self) -> bool:
        """Validate reference directory structure."""
        self.log("Validating reference structure...")

        reference_dir = self.root_dir / "reference"
        if not reference_dir.exists():
            return False

        # Required reference implementations
        required_refs = [
            "server-python",
            "server-node",
            "compliance-suite"
        ]

        missing_refs = []
        for ref in required_refs:
            ref_dir = reference_dir / ref
            if not ref_dir.exists():
                missing_refs.append(ref)
                self.errors.append(f"Missing reference directory: reference/{ref}")

        return len(missing_refs) == 0

    def validate_github_structure(self) -> bool:
        """Validate .github directory structure."""
        self.log("Validating .github structure...")

        github_dir = self.root_dir / ".github"
        if not github_dir.exists():
            self.errors.append("Missing .github directory")
            return False

        # Check for workflows directory
        workflows_dir = github_dir / "workflows"
        if not workflows_dir.exists():
            self.errors.append("Missing .github/workflows directory")

        # Check for issue and PR templates
        issue_templates = github_dir / "ISSUE_TEMPLATE"
        if not issue_templates.exists():
            self.warnings.append("Missing .github/ISSUE_TEMPLATE directory")

        pr_template = github_dir / "PULL_REQUEST_TEMPLATE.md"
        if not pr_template.exists():
            self.warnings.append("Missing .github/PULL_REQUEST_TEMPLATE.md")

        return True

    def create_stub_files(self):
        """Create stub files and directories for the target structure."""
        self.log("Creating stub files and directories...")

        # Create directories
        dirs_to_create = [
            "specification/appendices",
            "docs/getting-started",
            "docs/guides",
            "docs/tutorials",
            "docs/api",
            "docs/architecture",
            "examples",
            "packages/server/src",
            "packages/client-core/src",
            "packages/client-apollo/src",
            "packages/client-relay/src",
            "packages/client-react-query/src",
            "packages/client-urql/src",
            "reference/server-python",
            "reference/server-node/src",
            "reference/compliance-suite/tests",
            "research",
            "design",
            ".github/workflows",
            ".github/ISSUE_TEMPLATE"
        ]

        for dir_path in dirs_to_create:
            full_path = self.root_dir / dir_path
            full_path.mkdir(parents=True, exist_ok=True)
            self.log(f"Created directory: {dir_path}")

        # Create stub files
        stub_files = {
            "README.md": "# GraphQL Cascade\n\nCascading cache updates for GraphQL.\n\n## Overview\n\n[Project description to be added]\n",
            "CONTRIBUTING.md": "# Contributing to GraphQL Cascade\n\n[Contribution guidelines to be added]\n",
            "CODE_OF_CONDUCT.md": "# Code of Conduct\n\n[Code of conduct to be added]\n",
            "CHANGELOG.md": "# Changelog\n\n[Version history to be added]\n",
            "specification/README.md": "# GraphQL Cascade Specification\n\n[Specification overview to be added]\n",
            "docs/README.md": "# Documentation\n\n[Documentation overview to be added]\n",
            "examples/README.md": "# Examples\n\n[Examples overview to be added]\n",
            "reference/README.md": "# Reference Implementations\n\n[Reference implementations overview to be added]\n",
            "research/README.md": "# Research\n\n[Research overview to be added]\n",
            "design/README.md": "# Design Documents\n\n[Design documents overview to be added]\n",
            ".github/PULL_REQUEST_TEMPLATE.md": "# Pull Request Template\n\n[PR template to be added]\n"
        }

        for file_path, content in stub_files.items():
            full_path = self.root_dir / file_path
            if not full_path.exists():
                full_path.write_text(content)
                self.log(f"Created stub file: {file_path}")

    def run_all_validations(self) -> bool:
        """Run all structure validations."""
        self.log("Starting structure validation...")

        # Run all validation checks
        checks = [
            self.validate_root_files,
            self.validate_directory_structure,
            self.validate_specification_structure,
            self.validate_docs_structure,
            self.validate_examples_structure,
            self.validate_packages_structure,
            self.validate_reference_structure,
            self.validate_github_structure
        ]

        all_passed = True
        for check in checks:
            if not check():
                all_passed = False

        # Summary
        print(f"\nStructure Validation Summary:")
        print(f"Errors: {len(self.errors)}")
        print(f"Warnings: {len(self.warnings)}")

        if self.errors:
            print("\nErrors:")
            for error in self.errors[:10]:  # Show first 10
                print(f"  - {error}")
            if len(self.errors) > 10:
                print(f"  ... and {len(self.errors) - 10} more")

        if self.warnings:
            print("\nWarnings:")
            for warning in self.warnings[:10]:  # Show first 10
                print(f"  - {warning}")
            if len(self.warnings) > 10:
                print(f"  ... and {len(self.warnings) - 10} more")

        return all_passed


def main():
    parser = argparse.ArgumentParser(description="Validate GraphQL Cascade repository structure")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable verbose output")
    parser.add_argument("--create-stubs", "-c", action="store_true", help="Create stub files and directories")

    args = parser.parse_args()

    root_dir = Path(__file__).parent.parent
    validator = StructureValidator(root_dir, args.verbose)

    if args.create_stubs:
        validator.create_stub_files()
        print("Stub files and directories created.")
        return 0

    success = validator.run_all_validations()

    return 0 if success else 1


if __name__ == "__main__":
    exit(main())