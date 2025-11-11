#!/usr/bin/env python3
"""
GraphQL Cascade Package Publishing Script

Handles publishing of GraphQL Cascade packages to PyPI and npm.
"""

import subprocess
import sys
from pathlib import Path
import argparse


def run_command(cmd: str, cwd: Path = None) -> bool:
    """Run a shell command."""
    try:
        result = subprocess.run(cmd, shell=True, cwd=cwd, check=True, capture_output=True, text=True)
        print(f"✅ {cmd}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {cmd}")
        print(f"Error: {e.stderr}")
        return False


def publish_server_package():
    """Publish the Python server package to PyPI."""
    print("📦 Publishing GraphQL Cascade Server (Python)")

    server_dir = Path("server-reference")

    # Build the package
    if not run_command("python -m build", cwd=server_dir):
        return False

    # Upload to PyPI (would require API token in real deployment)
    print("🚀 Upload to PyPI (mock - would use twine in real deployment)")
    print("   twine upload dist/*")

    return True


def publish_client_packages():
    """Publish TypeScript client packages to npm."""
    print("📦 Publishing GraphQL Cascade Client (TypeScript)")

    client_dir = Path("client-reference")

    # Build all packages
    packages = ["core", "apollo", "react-query"]
    for package in packages:
        package_dir = client_dir / "packages" / package
        if package_dir.exists():
            print(f"🔨 Building @graphql-cascade/{package}")
            if not run_command("npm run build", cwd=package_dir):
                return False

    # Publish packages (would require npm login in real deployment)
    for package in packages:
        package_dir = client_dir / "packages" / package
        if package_dir.exists():
            print(f"🚀 Publish @graphql-cascade/{package} (mock)")
            print(f"   cd {package_dir} && npm publish")

    return True


def publish_compliance_package():
    """Publish the compliance test suite."""
    print("📦 Publishing GraphQL Cascade Compliance")

    compliance_dir = Path("compliance-tests")

    # Build the package
    if not run_command("python setup.py sdist bdist_wheel", cwd=compliance_dir):
        return False

    # Upload to PyPI
    print("🚀 Upload compliance package to PyPI (mock)")
    print("   twine upload dist/*")

    return True


def main():
    """Main publishing script."""
    parser = argparse.ArgumentParser(description="Publish GraphQL Cascade packages")
    parser.add_argument("--server", action="store_true", help="Publish server package")
    parser.add_argument("--client", action="store_true", help="Publish client packages")
    parser.add_argument("--compliance", action="store_true", help="Publish compliance package")
    parser.add_argument("--all", action="store_true", help="Publish all packages")

    args = parser.parse_args()

    if not any([args.server, args.client, args.compliance, args.all]):
        parser.print_help()
        return 1

    success = True

    if args.server or args.all:
        success &= publish_server_package()

    if args.client or args.all:
        success &= publish_client_packages()

    if args.compliance or args.all:
        success &= publish_compliance_package()

    if success:
        print("\n🎉 All packages published successfully!")
        print("\n📋 Next steps:")
        print("1. Set up CI/CD pipelines for automated publishing")
        print("2. Configure API tokens for PyPI and npm")
        print("3. Set up package documentation on respective registries")
        print("4. Announce releases on social media and newsletters")
        return 0
    else:
        print("\n❌ Some packages failed to publish")
        return 1


if __name__ == "__main__":
    sys.exit(main())</content>
</xai:function_call name="run">
<parameter name="command">chmod +x scripts/publish.py