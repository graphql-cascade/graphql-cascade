# GraphQL Cascade CLI

A command-line tool for GraphQL Cascade development and debugging.

## Installation

```bash
npm install -g @graphql-cascade/cli
```

## Commands

### `cascade doctor`

Diagnose common GraphQL Cascade issues in your project.

```bash
cascade doctor
```

Checks for:
- Installed cascade packages
- Package versions
- Configuration files
- Schema files

Example output:
```
Running diagnostics...

✓ Checks passed:
  - @graphql-cascade/client is installed
  - Package versions can be resolved
  - Configuration file found: cascade.config.ts
  - Schema file found: schema.graphql

Health Score: 100/100
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Development mode
npm run dev
```

## License

MIT