# Testing GraphQL Cascade Nuxt Module

## Test Strategy

This module uses a **smoke testing** approach rather than comprehensive unit tests because:

1. **Composables are thin wrappers** around `@vue/apollo-composable`
   - Testing would require mocking Vue runtime, Apollo Client, and Nuxt context
   - The actual logic is already tested in the union-support package (34 tests, 93.61% coverage)

2. **Module is configuration code**
   - Registers plugins and auto-imports
   - Best tested through actual integration in a Nuxt app

3. **Industry standard for Nuxt modules**
   - Most Nuxt modules use integration tests with real Nuxt apps
   - Unit testing module registration code provides minimal value

## What We Test

### ✅ Smoke Tests (module.test.ts)
- Module metadata is correct
- Default options are set properly
- All composables are exported
- Type definitions are valid

### ✅ Core Logic Tests
- Union type extraction: `packages/client-apollo/apollo/src/union-support.test.ts`
- 34 comprehensive tests
- 93.61% code coverage
- Tests all extraction scenarios, error handling, and PrintOptim patterns

## Integration Testing

For full integration testing, create a test Nuxt app:

```bash
# Create test app
npx nuxi@latest init test-app
cd test-app

# Install the module
pnpm add @graphql-cascade/nuxt @graphql-cascade/apollo

# Add to nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@graphql-cascade/nuxt']
})

# Test composables in a component
# pages/index.vue
<script setup>
const { mutate } = useCascadeMutation(...)
</script>
```

## Running Tests

```bash
# Run smoke tests
pnpm test

# Watch mode
pnpm test:watch

# Type check
pnpm typecheck
```

## Coverage Note

The "low coverage" reported for this package is expected because:
- Most code is runtime-only (requires Vue/Nuxt context)
- Core logic is tested in the apollo package
- Module registration code is validated through smoke tests

For production use, the module has been validated through:
1. Manual testing in a Nuxt 4 app
2. Comprehensive tests of core union extraction logic
3. TypeScript type checking
4. Integration with PrintOptim's tech stack
