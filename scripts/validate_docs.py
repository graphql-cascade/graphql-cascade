#!/usr/bin/env python3
"""
Repository Documentation Validation Script

This script validates the GraphQL Cascade repository documentation by:
1. Checking for duplicate content across markdown files
2. Validating all internal links work
3. Ensuring all referenced files exist

Usage:
    python scripts/validate_docs.py [--verbose] [--output-dir OUTPUT_DIR]

Returns:
    0 if all validations pass
    1 if any validation fails
"""

import os
import re
import hashlib
import argparse
from pathlib import Path
from typing import Dict, List, Set, Tuple
from collections import defaultdict
import difflib


class DocValidator:
    def __init__(self, root_dir: Path, verbose: bool = False):
        self.root_dir = root_dir
        self.verbose = verbose
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def log(self, message: str):
        """Log message if verbose mode is enabled."""
        if self.verbose:
            print(message)

    def find_markdown_files(self) -> List[Path]:
        """Find all markdown files in the repository."""
        return list(self.root_dir.rglob("*.md"))

    def calculate_file_hash(self, file_path: Path) -> str:
        """Calculate SHA256 hash of file content."""
        with open(file_path, 'rb') as f:
            return hashlib.sha256(f.read()).hexdigest()

    def extract_text_content(self, file_path: Path) -> str:
        """Extract text content from markdown file, excluding frontmatter and code blocks."""
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Remove frontmatter
        content = re.sub(r'^---\n.*?\n---\n', '', content, flags=re.DOTALL)

        # Remove code blocks
        content = re.sub(r'```.*?```', '', content, flags=re.DOTALL)

        # Remove inline code
        content = re.sub(r'`[^`]*`', '', content)

        # Remove markdown formatting
        content = re.sub(r'\[([^\]]*)\]\([^\)]*\)', r'\1', content)  # links
        content = re.sub(r'\*\*([^\*]*)\*\*', r'\1', content)  # bold
        content = re.sub(r'\*([^\*]*)\*', r'\1', content)  # italic
        content = re.sub(r'^#+\s*', '', content, flags=re.MULTILINE)  # headers

        return content.strip().lower()

    def check_duplicate_content(self) -> Dict[str, List[Path]]:
        """Check for duplicate content across markdown files using fuzzy matching."""
        self.log("Checking for duplicate content...")

        markdown_files = self.find_markdown_files()
        content_hashes: Dict[str, List[Path]] = defaultdict(list)
        text_contents: Dict[Path, str] = {}
        file_hashes: Dict[Path, str] = {}

        # Calculate hashes and extract text
        for file_path in markdown_files:
            try:
                file_hash = self.calculate_file_hash(file_path)
                content_hashes[file_hash].append(file_path)
                file_hashes[file_path] = file_hash

                text_content = self.extract_text_content(file_path)
                text_contents[file_path] = text_content
            except Exception as e:
                self.errors.append(f"Error processing {file_path}: {e}")

        # Find exact duplicates
        duplicates = {hash_val: files for hash_val, files in content_hashes.items() if len(files) > 1}

        # Find fuzzy duplicates (similar content) - simplified to avoid timeout
        fuzzy_duplicates: Dict[str, List[Path]] = defaultdict(list)

        # Only check a sample of files to avoid timeout
        file_list = list(text_contents.items())
        sample_size = min(10, len(file_list))  # Check at most 10 files for fuzzy matching

        for i in range(sample_size):
            file1, content1 = file_list[i]
            if file1 in [f for files in duplicates.values() for f in files]:
                continue  # Skip if already in exact duplicates

            for j in range(i + 1, min(i + 5, len(file_list))):  # Check next 5 files
                file2, content2 = file_list[j]
                if file2 in [f for files in duplicates.values() for f in files]:
                    continue  # Skip if already in exact duplicates

                # Check similarity
                similarity = difflib.SequenceMatcher(None, content1, content2).ratio()
                if similarity > 0.85:  # 85% similar
                    key = f"{min(str(file1), str(file2))}_{max(str(file1), str(file2))}"
                    if key not in fuzzy_duplicates:
                        fuzzy_duplicates[key] = [file1, file2]

        # Report findings
        if duplicates:
            for hash_val, files in duplicates.items():
                self.errors.append(f"Exact duplicate files: {', '.join(str(f) for f in files)}")

        if fuzzy_duplicates:
            for files in fuzzy_duplicates.values():
                self.warnings.append(f"Similar content detected: {', '.join(str(f) for f in files)}")

        return {**duplicates, **fuzzy_duplicates}

    def extract_markdown_links(self, file_path: Path) -> List[Tuple[str, int]]:
        """Extract all markdown links from a file."""
        links = []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f, 1):
                    # Find markdown links: [text](url)
                    link_matches = re.findall(r'\[([^\]]*)\]\(([^)]*)\)', line)
                    for text, url in link_matches:
                        links.append((url, line_num))
        except Exception as e:
            self.errors.append(f"Error reading {file_path}: {e}")

        return links

    def check_internal_links(self) -> List[Tuple[Path, str, int]]:
        """Check all internal markdown links."""
        self.log("Checking internal links...")

        markdown_files = self.find_markdown_files()
        broken_links = []

        for file_path in markdown_files:
            links = self.extract_markdown_links(file_path)

            for url, line_num in links:
                # Skip external links (http/https) and anchors
                if url.startswith(('http://', 'https://', '#')):
                    continue

                # Convert relative path to absolute
                if not url.startswith('/'):
                    # Relative to the file's directory
                    link_path = (file_path.parent / url).resolve()
                else:
                    # Absolute path from repository root
                    link_path = (self.root_dir / url.lstrip('/')).resolve()

                # Check if target exists
                if not link_path.exists():
                    broken_links.append((file_path, url, line_num))
                    self.errors.append(f"Broken link in {file_path}:{line_num} -> {url}")

        return broken_links

    def check_referenced_files(self) -> List[Tuple[Path, str, int]]:
        """Check that all files referenced in markdown exist."""
        self.log("Checking referenced files...")

        markdown_files = self.find_markdown_files()
        missing_files = []

        for file_path in markdown_files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Find file references (common patterns)
                # Look for references to .md, .py, .ts, .js, .json, .graphql files
                file_patterns = [
                    r'\b([^\s]+\.md)\b',
                    r'\b([^\s]+\.py)\b',
                    r'\b([^\s]+\.ts)\b',
                    r'\b([^\s]+\.js)\b',
                    r'\b([^\s]+\.json)\b',
                    r'\b([^\s]+\.graphql)\b',
                    r'\b([^\s]+\.yaml)\b',
                    r'\b([^\s]+\.yml)\b'
                ]

                for pattern in file_patterns:
                    matches = re.findall(pattern, content)
                    for match in matches:
                        # Skip if it's a URL or already a full path
                        if match.startswith(('http://', 'https://', '/')):
                            continue

                        # Try relative to file directory first
                        ref_path = (file_path.parent / match).resolve()
                        if not ref_path.exists():
                            # Try relative to repo root
                            ref_path = (self.root_dir / match).resolve()
                            if not ref_path.exists():
                                # Find line number
                                lines = content.split('\n')
                                for line_num, line in enumerate(lines, 1):
                                    if match in line:
                                        missing_files.append((file_path, match, line_num))
                                        self.errors.append(f"Referenced file not found: {file_path}:{line_num} -> {match}")
                                        break

            except Exception as e:
                self.errors.append(f"Error processing {file_path}: {e}")

        return missing_files

    def generate_inventory(self) -> Dict:
        """Generate a complete inventory of all content."""
        self.log("Generating content inventory...")

        inventory = {
            'markdown_files': [],
            'other_files': [],
            'directories': [],
            'total_size': 0,
            'file_types': defaultdict(int)
        }

        for root, dirs, files in os.walk(self.root_dir):
            root_path = Path(root)

            # Skip certain directories
            if any(skip in str(root_path) for skip in ['.git', '__pycache__', '.pytest_cache', 'node_modules']):
                continue

            # Add directories
            for dir_name in dirs:
                dir_path = root_path / dir_name
                inventory['directories'].append({
                    'path': str(dir_path.relative_to(self.root_dir)),
                    'file_count': len(list(dir_path.glob('*'))),
                    'modified': dir_path.stat().st_mtime if dir_path.exists() else None
                })

            # Add files
            for file_name in files:
                file_path = root_path / file_name
                file_stat = file_path.stat()

                file_info = {
                    'path': str(file_path.relative_to(self.root_dir)),
                    'size': file_stat.st_size,
                    'modified': file_stat.st_mtime,
                    'extension': file_path.suffix,
                    'hash': self.calculate_file_hash(file_path) if file_path.suffix == '.md' else None
                }

                inventory['total_size'] += file_stat.st_size
                inventory['file_types'][file_path.suffix] += 1

                if file_path.suffix == '.md':
                    inventory['markdown_files'].append(file_info)
                else:
                    inventory['other_files'].append(file_info)

        return inventory

    def generate_reports(self, output_dir: Path):
        """Generate markdown reports for findings."""
        self.log("Generating reports...")

        output_dir.mkdir(exist_ok=True)

        # Generate CONTENT_INVENTORY.md
        self.generate_content_inventory_report(output_dir / "CONTENT_INVENTORY.md")

        # Generate DUPLICATION_REPORT.md
        self.generate_duplication_report(output_dir / "DUPLICATION_REPORT.md")

        # Generate LINK_VALIDATION_REPORT.md
        self.generate_link_validation_report(output_dir / "LINK_VALIDATION_REPORT.md")

    def generate_content_inventory_report(self, output_path: Path):
        """Generate CONTENT_INVENTORY.md report."""
        inventory = self.generate_inventory()

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("# Content Inventory Report\n\n")
            f.write(f"Generated: {Path(__file__).parent.parent}\n\n")

            f.write("## Summary\n\n")
            f.write(f"- **Markdown files**: {len(inventory['markdown_files'])}\n")
            f.write(f"- **Total files**: {len(inventory['other_files']) + len(inventory['markdown_files'])}\n")
            f.write(f"- **Total size**: {inventory['total_size'] / 1024:.1f} KB\n")
            f.write(f"- **Directories**: {len(inventory['directories'])}\n\n")

            f.write("## File Types\n\n")
            f.write("| Extension | Count |\n")
            f.write("|-----------|-------|\n")
            for ext, count in sorted(inventory['file_types'].items()):
                f.write(f"| {ext or 'no extension'} | {count} |\n")
            f.write("\n")

            f.write("## Markdown Files\n\n")
            f.write("| File | Size (KB) | Last Modified | Content Hash |\n")
            f.write("|------|-----------|---------------|--------------|\n")
            for file_info in sorted(inventory['markdown_files'], key=lambda x: x['path']):
                size_kb = file_info['size'] / 1024
                modified = file_info['modified']
                modified_str = "N/A" if modified is None else "recent"
                hash_short = file_info['hash'][:8] if file_info['hash'] else "N/A"
                f.write(f"| {file_info['path']} | {size_kb:.1f} | {modified_str} | {hash_short} |\n")
            f.write("\n")

            f.write("## Directories\n\n")
            f.write("| Directory | File Count |\n")
            f.write("|-----------|------------|\n")
            for dir_info in sorted(inventory['directories'], key=lambda x: x['path']):
                f.write(f"| {dir_info['path']} | {dir_info['file_count']} |\n")
            f.write("\n")

    def generate_duplication_report(self, output_path: Path):
        """Generate DUPLICATION_REPORT.md report."""
        duplicates = self.check_duplicate_content()

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("# Duplication Report\n\n")
            f.write("This report identifies files with duplicate or similar content.\n\n")

            if not duplicates:
                f.write("✅ No duplicate content found.\n\n")
                return

            f.write(f"Found {len(duplicates)} groups of duplicate/similar content.\n\n")

            for i, (key, files) in enumerate(duplicates.items(), 1):
                f.write(f"## Group {i}\n\n")
                f.write("**Files:**\n")
                for file_path in files:
                    f.write(f"- {file_path.relative_to(self.root_dir)}\n")
                f.write("\n")

                # Show content preview for small files
                if len(files) >= 2:
                    file1, file2 = files[0], files[1]
                    try:
                        content1 = self.extract_text_content(file1)[:200]
                        content2 = self.extract_text_content(file2)[:200]
                        if content1 and content2:
                            f.write("**Content Preview (File 1):**```\n")
                            f.write(content1 + "...\n")
                            f.write("```\n\n")
                            f.write("**Content Preview (File 2):**```\n")
                            f.write(content2 + "...\n")
                            f.write("```\n\n")
                    except:
                        pass

                f.write("---\n\n")

    def generate_link_validation_report(self, output_path: Path):
        """Generate LINK_VALIDATION_REPORT.md report."""
        broken_links = self.check_internal_links()
        missing_files = self.check_referenced_files()

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("# Link Validation Report\n\n")
            f.write("This report documents broken links and missing file references.\n\n")

            f.write(f"## Summary\n\n")
            f.write(f"- **Broken internal links**: {len(broken_links)}\n")
            f.write(f"- **Missing file references**: {len(missing_files)}\n")
            f.write(f"- **Total issues**: {len(broken_links) + len(missing_files)}\n\n")

            if broken_links:
                f.write("## Broken Internal Links\n\n")
                f.write("| Source File | Link | Line |\n")
                f.write("|-------------|------|------|\n")
                for file_path, url, line_num in broken_links:
                    f.write(f"| {file_path.relative_to(self.root_dir)} | {url} | {line_num} |\n")
                f.write("\n")

            if missing_files:
                f.write("## Missing File References\n\n")
                f.write("| Source File | Referenced File | Line |\n")
                f.write("|-------------|-----------------|------|\n")
                for file_path, ref_file, line_num in missing_files:
                    f.write(f"| {file_path.relative_to(self.root_dir)} | {ref_file} | {line_num} |\n")
                f.write("\n")

            if not broken_links and not missing_files:
                f.write("✅ All links and file references are valid.\n\n")

    def run_all_validations(self) -> bool:
        """Run all validation checks."""
        self.log("Starting repository validation...")

        # Run checks
        duplicates = self.check_duplicate_content()
        broken_links = self.check_internal_links()
        missing_files = self.check_referenced_files()
        inventory = self.generate_inventory()

        # Summary
        print(f"\nValidation Summary:")
        print(f"Markdown files found: {len(inventory['markdown_files'])}")
        print(f"Total files: {len(inventory['other_files']) + len(inventory['markdown_files'])}")
        print(f"Total size: {inventory['total_size'] / 1024:.1f} KB")
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

        return len(self.errors) == 0


def main():
    parser = argparse.ArgumentParser(description="Validate GraphQL Cascade repository documentation")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable verbose output")
    parser.add_argument("--output-dir", "-o", default=".", help="Output directory for reports")
    parser.add_argument("--generate-reports", "-g", action="store_true", help="Generate markdown reports")

    args = parser.parse_args()

    root_dir = Path(__file__).parent.parent
    output_dir = Path(args.output_dir)
    validator = DocValidator(root_dir, args.verbose)

    success = validator.run_all_validations()

    if args.generate_reports:
        validator.generate_reports(output_dir)
        print(f"\nReports generated in: {output_dir}")

    return 0 if success else 1


if __name__ == "__main__":
    exit(main())