#!/bin/bash
set -e

echo "🔍 Verifying GraphQL Cascade build process..."

# Step 1: Clean
echo "📦 Cleaning build artifacts..."
pnpm run clean || true
find . -name "dist" -type d -prune -exec rm -rf {} +

# Step 2: Install dependencies
echo "📥 Installing dependencies..."
pnpm install

# Step 3: Build all packages
echo "🔨 Building all packages..."
pnpm run -r build

# Step 4: Run tests
echo "🧪 Running tests..."
pnpm run -r test

# Step 5: Verify outputs
echo "✅ Verifying build outputs..."
for pkg in packages/*/dist; do
  if [ -d "$pkg" ]; then
    echo "  ✓ $pkg exists"
  else
    echo "  ✗ $pkg missing"
    exit 1
  fi
done

echo "✅ Build verification complete!"