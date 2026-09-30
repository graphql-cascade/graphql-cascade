# RFC 0001: GraphQL Cascade 2.0

**Status:** Proposed

**Date:** 2026-09-30

**Related:** #36 (entity selections), #38 (Relay adapter record keys), fraiseql/fraiseql#1398 (`node(id:)` round trip)

## Summary

Cascade 2.0 combines the strongest choices of the specification (1.7) and of FraiseQL, the largest server implementation:

- **Identity follows Relay's Global Object Identification.** Entities implement `Node` with globally unique IDs, so every Relay-compliant schema already satisfies Cascade, and standard clients merge most of a cascade into their store without a Cascade library.
- **Typed entities.** `UpdatedEntity.entity` stays `Node!`. A codegen fragment, derived from the client's own queries, removes the cost of selecting each type's fields by hand.
- **Failures are a union member.** `<Mutation>Result = <Mutation>Payload | CascadeFailure`: a success always carries a cascade, a failure never does. Non-critical problems travel as `warnings` on the success payload.
- **Every entry names its type and its changed fields.** `typename` on updated and deleted entries, `updatedFields` on updated ones.

Most of it can ship in 1.x as additions; the result union and the removal of the 1.x payload fields need 2.0.

## Motivation

The 1.x specification and FraiseQL each got some things right that the other did not:

| Topic | Spec 1.7 | FraiseQL | Problem |
|-------|----------|----------|---------|
| Entity identity | `interface Node { id: ID! }`, identity `typename:id` | `CascadeNode { id: ID! }` over UUIDs | The spec's `Node` shares Relay's name and shape without Relay's meaning (global IDs), so a Relay schema cannot adopt both; FraiseQL's separate interface duplicates `Node` |
| Entry type | `typename` on every entry | none | Without `typename`, a deleted entry cannot be keyed in Apollo or urql caches |
| Failure | `success` + `errors` + an empty cascade on every payload | `Result = Payload \| MutationError` | The spec's form lets clients read a result that does not exist; the union has no place for partial success |
| Primary result | `data` (convention since 1.6) | `entity` | Reference clients read `data`, so FraiseQL results are lost |
| Changed fields | not carried | `updatedFields` on the payload | Chapter 05's per-field invalidation rules have no data; FraiseQL's covers only the primary entity |
| Entity selection | examples select `entity` without a selection set, which is invalid (#36) | inline fragments | Spelling out a fragment per type in every mutation is verbose, and a missing type loses its data |

Two findings make identity the priority:

1. **Our Relay adapter updates records no query reads.** It writes to `"User:1"` records, but Relay keys records by the `id` value alone, and the adapter never configures `getDataID`. Relay-style global IDs remove the mismatch.
2. **Relay compatibility is the cheapest path to adoption.** Hasura, PostGraphile, Hot Chocolate, Strawberry, Graphene and Pothos can all generate `Node` with global IDs. A schema that already follows Global Object Identification should satisfy Cascade's identity rules unchanged.

## Design

### Identity

```graphql
"""
An object with a globally unique ID (GraphQL Global Object Identification).
"""
interface Node {
  """Unique across every type in the schema: a UUID, or an encoded "Type:key"."""
  id: ID!
}

type Query {
  """RECOMMENDED. When present, node(id: x.id) MUST return x."""
  node(id: ID!): Node
}
```

- Cascade entities MUST implement `Node`, and their `id` MUST be unique across all types. UUIDs qualify as they are; per-type keys qualify once encoded (for example `base64("User:123")`).
- `Query.node` is RECOMMENDED, not required: Cascade needs global identity, not refetch. When a server provides it, `node(id: x.id)` MUST return `x`, Relay's own invariant, stated so a conformance case can test it.
- Entries keep `typename` (below). Apollo and urql key caches by type and ID, and a deleted entry has no entity to read the type from.

Globally unique IDs are a stricter form of the 1.x `typename:id` identity, so Apollo and urql keep working unchanged, and Relay's store now matches the IDs cascades carry.

### Payloads and failures

```graphql
"""Implemented by every successful mutation payload."""
interface CascadePayload {
  cascade: CascadeUpdates!
  """Non-critical problems of a mutation that succeeded (partial success)."""
  warnings: [CascadeError!]!
}

type CreatePostPayload implements CascadePayload {
  """The primary result, typed as what the mutation returns."""
  data: Post!
  cascade: CascadeUpdates!
  warnings: [CascadeError!]!
}

"""A mutation that failed. Nothing was committed, so there is no cascade."""
type CascadeFailure {
  errors: [CascadeError!]!
}

union CreatePostResult = CreatePostPayload | CascadeFailure

type Mutation {
  createPost(input: CreatePostInput!): CreatePostResult!
}
```

- A client cannot read `data` or `cascade` from a failure; the union's `__typename` says which branch it has.
- `CascadeError` is unchanged (`message`, `code`, `domainCode`, `field`, `path`, `extensions`).
- `CascadePayload` declares no `data`: GraphQL cannot type "any result" as an interface field (the 1.6 finding). Payloads SHOULD name their primary result `data`.
- Generic clients detect a cascade by the payload implementing `CascadePayload`, or, over JSON, by the presence of `cascade`.

### Cascade entries

```graphql
type UpdatedEntity {
  typename: String!
  id: ID!
  operation: CascadeOperation!
  entity: Node!
  """Fields whose values changed; null when the entity was created."""
  updatedFields: [String!]
}

type DeletedEntity {
  typename: String!
  id: ID!
  deletedAt: DateTime!
}
```

`CascadeUpdates` (`updated`, `deleted`, `invalidations`, `typeInvalidations`, `metadata`), the completeness rule, truncation, invalidation hints, delivery rules and `cascadeInfo` discovery are unchanged from 1.x.

`updatedFields` gives chapter 05's per-field invalidation rules the data they need, for every entity rather than only the primary one, and lets user interfaces highlight what changed.

### Selecting entities: the generated fragment

Typed entities need a selection per type. Instead of spelling it out in each mutation, `@graphql-cascade/codegen` generates one fragment per client:

```graphql
fragment CascadeEntity on Node {
  id
  ... on User { name postCount }
  ... on Post { title authorId }
}
```

For each type, the fragment selects the union of the fields the client's own queries read on it. It is:

- **complete** for the cache: every field a cached query shows is refreshed, and a new query regenerates the fragment;
- **minimal**: no bytes for fields nothing displays;
- **typed** and validated against the schema.

Mutations write `entity { ...CascadeEntity }`.

### What standard clients do without a Cascade library

Relay, Apollo and urql's Graphcache normalize every response object that carries identity. With typed entities and global IDs:

| Cascade part | Relay | Apollo | urql Graphcache |
|--------------|-------|--------|-----------------|
| `updated[].entity` | merged into the store | merged into the cache | merged into the cache |
| `deleted[]` | `deleted { id @deleteRecord }` | needs `cache.evict` | needs `cache.invalidate` |
| `invalidations`, `typeInvalidations` | need a Cascade client | need a Cascade client | need a Cascade client |

So adopting Cascade on the server improves standard clients before they add anything; the Cascade client libraries handle deletions and invalidations.

## Migration

### 1.x (additive, no breaking change)

1. Give `Node` its Relay meaning: IDs MUST be globally unique; `Query.node` RECOMMENDED with the `node(id: x.id)` invariant.
2. Add optional `UpdatedEntity.updatedFields`.
3. Fix the specification's `entity` selections to select through fragments (#36), and let `check:spec` validate the specification's operations against the reference and example schemas.
4. Add the codegen `CascadeEntity` fragment.
5. Allow the result union: a payload that implements the 2.0 `CascadePayload` inside a `Result` union is conforming alongside the 1.x `CascadeResponse`. Clients accept both.
6. Fix the Relay adapter to use the record IDs Relay uses (#38).

### 2.0 (breaking)

- `CascadeResponse`, its `success` and `errors` fields, and REQ-020 (a failed mutation returns an empty cascade) are replaced by `CascadePayload` and `CascadeFailure`.
- The `__typename` pseudo-field on entries, deprecated since 1.3.0, is removed.

Deprecations follow VERSIONING.md: announced in 1.x with migration guides, removed in 2.0.

### FraiseQL

- Add `typename` to its `UpdatedEntity` and `DeletedEntity`; emit `typename` instead of `__typename` from its SQL cascade helpers.
- Name the payload's primary result `data` (keeping `entity` as a deprecated alias), and move `updatedFields` onto each `UpdatedEntity`.
- Replace `CascadeNode` with `Node`: its UUID IDs already meet the global-uniqueness requirement.
- Make `node(id:)` accept the IDs its objects return (fraiseql/fraiseql#1398). Today `node` decodes `base64("TypeName:uuid")`, but `id` fields return the bare UUID, so `node(id: x.id)` fails.
- Align `MutationError` with `CascadeFailure`.

## Alternatives Considered

### `entity: JSON!`

The server sends each entity's full serialized data; clients select `entity` with no selection set.

- **For:** no type can be forgotten, small query documents, natural for database-derived tracking.
- **Against:** loses GraphQL typing; standard clients no longer normalize entities; field-level authorization would have to decide on its own which fields to hide. Rejected in favor of typed entities with a generated fragment.

### A Cascade-specific `CascadeNode` interface

- **For:** no dependency on Relay's semantics.
- **Against:** Relay-compliant schemas would need a second interface meaning almost the same thing, and Relay's store would still not match Cascade's IDs. Rejected.

### Keeping `success` and `errors` on every payload

- **For:** no breaking change.
- **Against:** clients can read results that do not exist, and every failure carries an empty cascade. Kept only as the 1.x form during the transition.

## Open Questions

1. Should `CascadeFailure` be one shared type, or per-mutation error types in the union (`CreatePostResult = CreatePostPayload | ValidationFailure | ConflictFailure`)? A shared type keeps generic clients simple; per-mutation members type each failure precisely.
2. Should the codegen fragment be one per client, or one per mutation (selecting only the types that mutation can affect)? Per-mutation is smaller but needs to know which types a mutation can touch, which only the server knows.
3. Does `updatedFields` name GraphQL fields or database columns when a column backs several fields? Proposed: GraphQL field names, as FraiseQL does.
