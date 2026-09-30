# cascade validate

Checks a schema file for problems that keep clients from updating their caches.

```bash
npx cascade validate schema.graphql
```

It reports:

- **Errors:** object types without an `id` field, which clients cannot key in their caches.
- **Warnings:** mutations returning `Boolean`, which give clients nothing to update, and types referencing themselves, whose traversal the server should bound with `maxDepth`.

The command exits with a non-zero status when it finds errors.

It does not yet check a schema against the specification's reference types and payload rules ([#67](https://github.com/graphql-cascade/graphql-cascade/issues/67)); see [Schema Conventions](/server/schema-conventions) for those.

## Options

| Option | Description |
|--------|-------------|
| `--strict` | Treat warnings as errors |
