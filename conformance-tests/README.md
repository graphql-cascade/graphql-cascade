# Conformance Test Cases

Executable test cases for the GraphQL Cascade specification. Each case tests one requirement, cited by its tag (`REQ-NNN`), and belongs to a conformance level. `pnpm run check:spec` keeps the cases and the specification in step: every case follows [`test-case-schema.json`](test-case-schema.json) and cites a defined requirement, every requirement has a case, and every server case's operation is valid against the conformance domain.

```
conformance-tests/
├── schema.graphql          # Conformance domain, for server cases
├── test-case-schema.json   # Case format
├── spec-version.json       # Specification version the cases target
├── client/                 # Cases for client caches
├── server/                 # Cases for servers, against the domain
└── transport/              # Cases for the extensions transport
```

## Server Cases

Server cases run against a server that implements the **conformance domain**, [`schema.graphql`](schema.graphql) merged with the [reference schema](../reference/cascade_base.graphql), with this behavior:

| Mutation | Behavior |
|----------|----------|
| `createUser(input)` | Creates a user with a new ID and no posts. |
| `updateUser(id, input)` | Sets the given fields. Unknown `id`: fails with `NOT_FOUND`. |
| `deleteUser(id)` | Deletes a user who manages no one and authors no posts. Unknown `id`: fails with `NOT_FOUND`. |
| `renameUser(id, name)` | Sets the name; returns `RenameUserPayload`, or a `CascadeFailure` with `NOT_FOUND` for an unknown `id`. |
| `createPost(input)` | Creates an unpublished post; the author's `postCount` grows by one. |
| `updatePost(id, input)` | Sets the given fields. Unknown `id`: fails with `NOT_FOUND`. |
| `publishPosts(authorId)` | Publishes every unpublished post of the author; returns the author. |

`User.postCount` is the number of posts the user authors. A failed mutation changes nothing.

A case's `input` gives the domain data to load before running (`state`: users and posts), the cascade limits to apply (`limits`), and the operation with its variables. `expected.fields` holds expectations for each mutation field, by response key:

- `success` and `errors` (by `code`) must match the payload. `typename` must match a result union's `__typename`.
- `cascade.updated`, `deleted`, `invalidations` and `typeInvalidations` list entries that must be present; the cascade may hold others. An entry pattern matches on the fields it gives, and `entity` on the entity fields it gives.
- `cascade.absent` lists entries that must not appear in `updated` or `deleted`; a pattern with only `typename` excludes every entity of the type.
- `cascade.noChanges` requires `updated`, `deleted` and `typeInvalidations` to be empty.
- `cascade.metadata` gives metadata values that must match.

Every server case also checks, for each cascade, the requirements that hold for every response: the cascade has `updated`, `deleted`, `invalidations`, `typeInvalidations` and `metadata` (REQ-010); each entity appears at most once in `updated` and once in `deleted` (REQ-005); no entity is in both (REQ-003); and `metadata.truncated` is never `true` with empty `typeInvalidations` (REQ-050).

Transport cases are server cases for servers that deliver cascades in `extensions.cascade`; `expected.extensions.cascade` uses the same patterns. They declare `requires: ["extensions"]` and run only against servers that support that transport.

## Client Cases

Client cases seed a cache and apply one mutation field's result to it. `input.state` lists the cached entities, and the cached queries by root field `name`, `arguments` and `result`. `input.result` is the field's result as received: a `CascadeResponse`, a `CascadePayload` or a `CascadeFailure`.

`expected.entities` gives, by `Type:id`, fields the cached entity must have, or `null` for an entity no longer cached. `expected.queries` gives each listed query's `state`: `fresh` if the cache still serves it as is, `invalidated` if it was marked stale, refetched or removed; a fresh query's `result` must contain the values given. Queries a case doesn't list may be in either state: a client that cannot tell which queries hold a type may invalidate all of them.

## Levels

Each case has the level of its requirement in the [Conformance](../specification/01_conformance.md) chapter: `basic`, `standard` or `complete`. An implementation achieves a level when it passes every case of that level and the levels below.

## Running the Cases

The cases are not yet executed by a runner: `@graphql-cascade/conformance` is being rebuilt to run them against a server endpoint or a client cache ([#65](https://github.com/graphql-cascade/graphql-cascade/issues/65)). Until then, run them in your implementation's own test suite.
