# @graphql-cascade/cli

Command-line tools for GraphQL Cascade development, debugging, and project management.

## Installation

```bash
# Global installation
npm install -g @graphql-cascade/cli

# Or local installation (recommended)
npm install --save-dev @graphql-cascade/cli
```

## Commands

### `cascade init`

Initialize GraphQL Cascade in your project. Creates a `cascade.config.ts` configuration file.

```bash
# Interactive mode
cascade init

# Skip prompts with defaults
cascade init -y

# Specify options directly
cascade init --client apollo --schema ./schema.graphql
```

**Options:**
- `-y, --yes`: Skip prompts and use defaults
- `--client <type>`: GraphQL client (apollo, react-query, relay, urql)
- `--schema <path>`: Path to GraphQL schema

**Example output:**
```
Detected package.json ✓
Configuration file created: cascade.config.ts ✓

🎉 GraphQL Cascade initialized successfully!

Next steps:
  1. Review and customize cascade.config.ts
  2. Install GraphQL Cascade: npm install @graphql-cascade/client
  3. Run cascade doctor to verify your setup
```

### `cascade validate`

Validate your GraphQL schema for Cascade compatibility.

```bash
# Validate default schema (./schema.graphql)
cascade validate

# Validate specific schema
cascade validate ./path/to/schema.graphql

# Strict mode (treat warnings as errors)
cascade validate --strict
```

**Options:**
- `--strict`: Treat warnings as errors (useful for CI/CD)

**Example output:**
```
Validating schema: ./schema.graphql

✓ No issues found

Cascade Compatibility: 100%
Schema is fully compatible with GraphQL Cascade!
```

### `cascade doctor`

Diagnose common GraphQL Cascade issues in your project.

```bash
cascade doctor
```

**Checks for:**
- Installed cascade packages
- Package version compatibility
- Configuration file existence
- Schema file detection
- Client library setup

**Example output:**
```
Running diagnostics...

✓ Checks passed:
  - @graphql-cascade/client is installed
  - Package versions can be resolved
  - Configuration file found: cascade.config.ts
  - Schema file found: schema.graphql

Health Score: 100/100
```

## Configuration File

The `cascade.config.ts` file controls how GraphQL Cascade works in your project:

```typescript
import { CascadeConfig } from '@graphql-cascade/core';

const config: CascadeConfig = {
  client: 'apollo',           // GraphQL client type
  schema: './schema.graphql', // Path to schema
  output: {
    directory: './src/generated',
    typescript: true
  },
  features: {
    dataFetching: true,
    caching: true,
    optimisticUpdates: true
  }
};

export default config;
```

## CI/CD Integration

### GitHub Actions

```yaml
- name: Validate Schema
  run: npx cascade validate --strict

- name: Run Doctor
  run: npx cascade doctor
```

### Pre-commit Hook

Add to your `package.json`:

```json
{
  "scripts": {
    "cascade:check": "cascade validate && cascade doctor"
  }
}
```

## Exit Codes

| Command | Code | Meaning |
|---------|------|---------|
| `validate` | 0 | Schema is valid |
| `validate` | 1 | Validation errors found |
| `validate --strict` | 1 | Errors or warnings found |
| `doctor` | 0 | All checks passed |
| `doctor` | 1 | Errors detected |

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Build
pnpm build

# Development mode
pnpm dev
```

## Related Packages

- [@graphql-cascade/server](../server-node) - Server implementation
- [@graphql-cascade/client-apollo](../client-apollo) - Apollo Client integration
- [@graphql-cascade/conformance](../conformance) - Conformance test suite

## License

MIT