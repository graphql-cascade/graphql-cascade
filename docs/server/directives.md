# Cascade Directives

The [reference schema](https://github.com/graphql-cascade/graphql-cascade/blob/main/reference/cascade_base.graphql) defines two directives that describe cascade behavior in the schema itself. The specification's [Directives](https://github.com/graphql-cascade/graphql-cascade/blob/main/specification/08_directives.md) chapter defines their meaning.

## `@cascade`

Configures the cascade of a mutation:

```graphql
type Mutation {
  updateCompany(id: ID!, input: UpdateCompanyInput!): UpdateCompanyCascade!
    @cascade(maxDepth: 2, excludeTypes: ["AuditLog"])
}
```

| Argument | Default | Meaning |
|----------|---------|---------|
| `maxDepth` | `3` | Levels of related entities to include |
| `includeRelated` | `true` | Whether related entities are included at all |
| `autoInvalidate` | `true` | Whether the server computes invalidation hints |
| `excludeTypes` | none | Entity types never included |

## `@cascadeInvalidates`

Declares which queries go stale when a field changes:

```graphql
type User implements Node {
  id: ID!
  email: String! @cascadeInvalidates(queries: ["searchUsers"])
  role: Role! @cascadeInvalidates(queries: ["listAdmins"], strategy: REFETCH)
}
```

## Using the Directives with `@graphql-cascade/server`

`@graphql-cascade/server` does not read directives from the schema; you apply the same settings in code.

`@cascade` arguments map to tracker options:

```typescript
const tracker = new CascadeTracker({
  maxDepth: 2,                        // maxDepth
  enableRelationshipTracking: true,   // includeRelated
  excludeTypes: ["AuditLog"],         // excludeTypes
});
```

`@cascadeInvalidates` rules become an invalidator that reads the fields each update changed (`updatedFields`):

```typescript
import {
  InvalidationScope,
  InvalidationStrategy,
  type Invalidator,
} from "@graphql-cascade/server";

// Mirrors the @cascadeInvalidates declarations above
const rules: Record<string, Record<string, { queries: string[]; strategy: InvalidationStrategy }>> = {
  User: {
    email: { queries: ["searchUsers"], strategy: InvalidationStrategy.INVALIDATE },
    role: { queries: ["listAdmins"], strategy: InvalidationStrategy.REFETCH },
  },
};

const invalidator: Invalidator = {
  computeInvalidations(updated) {
    return updated.flatMap((entry) =>
      (entry.updatedFields ?? []).flatMap((field) => {
        const rule = rules[entry.typename]?.[field];
        return (rule?.queries ?? []).map((queryName) => ({
          queryName,
          strategy: rule!.strategy,
          scope: InvalidationScope.EXACT,
        }));
      }),
    );
  },
};
```

Track updates with their changed fields for these rules to apply: `tracker.trackUpdate(user, { updatedFields: ["email"] })`.

## Next Steps

- **[Node.js](/server/node)**: tracker options in full
- **[Schema Conventions](/server/schema-conventions)**: payloads and naming
