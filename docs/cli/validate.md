# cascade validate

Checks a schema against the specification.

```bash
npx cascade validate schema.graphql
```

Pass several SDL files to validate a schema split across files; they are merged into one schema, for example the reference types kept in their own file:

```bash
npx cascade validate schema/cascade.graphql schema/app.graphql
```

A JSON introspection result (`schema.json`) works too.

## Checks

**Errors**, for what the specification requires:

- The schema has none of `CascadeResponse`, `CascadePayload` or `CascadeFailure`, so no mutation can return a cascade.
- A Cascade type or directive differs from the [reference schema](https://github.com/graphql-cascade/graphql-cascade/blob/main/reference/cascade_base.graphql). Descriptions and the order of fields don't matter; fields, arguments, types and defaults do.
- A type with an `id` field doesn't implement `Node`. Cascades carry entities as `Node`, so an entity that doesn't implement it cannot be selected in a cascade.

**Warnings**, for mutations whose results carry no cascade: their return type implements neither `CascadeResponse` nor `CascadePayload`, and is not a union with a `CascadePayload` member. The specification allows such mutations alongside Cascade ones, but clients cannot update their caches from them.

The command prints a compatibility score, the share of checks passed, and exits with a non-zero status when it finds errors.

## Options

| Option | Description |
|--------|-------------|
| `--strict` | Treat warnings as errors |
