#!/usr/bin/env python3
"""
Setup script for GraphQL Cascade Compliance Test Suite.
"""

from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="graphql-cascade-compliance",
    version="0.1.0",
    author="GraphQL Cascade Team",
    author_email="team@graphql-cascade.dev",
    description="Compliance test suite for GraphQL Cascade implementations",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/graphql-cascade/graphql-cascade",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Topic :: Software Development :: Testing",
    ],
    python_requires=">=3.8",
    install_requires=[
        "requests>=2.25.0",
        "pyyaml>=5.4.0",
        "jinja2>=3.0.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-cov>=4.0.0",
            "black>=23.0.0",
            "isort>=5.12.0",
            "mypy>=1.0.0",
            "ruff>=0.1.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "cascade-compliance=cli:main",
        ],
    },
    include_package_data=True,
    zip_safe=False,
)