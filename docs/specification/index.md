# Specification

The GraphQL Cascade specification defines what servers return from mutations and what clients do with it. It is maintained in the repository's [`specification/`](https://github.com/graphql-cascade/graphql-cascade/tree/main/specification) directory; this page is a map of it. For a practical introduction, read the [guide](/guide/) first.

## Chapters

| Chapter | Covers |
|---------|--------|
| [00 Introduction](https://github.com/graphql-cascade/graphql-cascade/blob/main/specification/00_introduction.md) | The problem and the approach |
| [01 Conformance](https://github.com/graphql-cascade/graphql-cascade/blob/main/specification/01_conformance.md) | Conformance levels and what each requires |
| [02 Cascade Model](https://github.com/graphql-cascade/graphql-cascade/blob/main/specification/02_cascade_model.md) | Updated, deleted and invalidated data, and metadata |
| [03 Entity Identification](https://github.com/graphql-cascade/graphql-cascade/blob/main/specification/03_entity_identification.md) | `Node`, IDs, and refetching by ID |
| [04 Mutation Responses](https://github.com/graphql-cascade/graphql-cascade/blob/main/specification/04_mutation_responses.md) | Payload shapes, result unions, errors, transport, size limits |
| [05 Invalidation](https://github.com/graphql-cascade/graphql-cascade/blob/main/specification/05_invalidation.md) | Hint strategies and scopes, type invalidation |
| [06 Subscriptions](https://github.com/graphql-cascade/graphql-cascade/blob/main/specification/06_subscriptions.md) | Cascades delivered through subscriptions |
| [07 Schema Conventions](https://github.com/graphql-cascade/graphql-cascade/blob/main/specification/07_schema_conventions.md) | Naming and schema structure |
| [08 Directives](https://github.com/graphql-cascade/graphql-cascade/blob/main/specification/08_directives.md) | `@cascade` and `@cascadeInvalidates` |
| [09 Server Requirements](https://github.com/graphql-cascade/graphql-cascade/blob/main/specification/09_server_requirements.md) | What servers must track and return |
| [10 Tracking Algorithm](https://github.com/graphql-cascade/graphql-cascade/blob/main/specification/10_tracking_algorithm.md) | Collecting affected entities |
| [11 Invalidation Algorithm](https://github.com/graphql-cascade/graphql-cascade/blob/main/specification/11_invalidation_algorithm.md) | Computing hints |
| [12 Performance Requirements](https://github.com/graphql-cascade/graphql-cascade/blob/main/specification/12_performance_requirements.md) | Limits implementations must respect |
| [13 Client Integration](https://github.com/graphql-cascade/graphql-cascade/blob/main/specification/13_client_integration.md) | How clients apply cascades |
| [14 Optimistic Updates](https://github.com/graphql-cascade/graphql-cascade/blob/main/specification/14_optimistic_updates.md) | Applying cascades before the server answers |
| [15 Conflict Resolution](https://github.com/graphql-cascade/graphql-cascade/blob/main/specification/15_conflict_resolution.md) | When local and server data disagree |
| [16 Security](https://github.com/graphql-cascade/graphql-cascade/blob/main/specification/16_security.md) | Authorization and data exposure |
| [17 Performance](https://github.com/graphql-cascade/graphql-cascade/blob/main/specification/17_performance.md) | Optimization guidance |

The [appendices](https://github.com/graphql-cascade/graphql-cascade/tree/main/specification/appendices) compare Cascade with Relay and Apollo, and hold a glossary, examples and the grammar.

## Normative Artifacts

- **[Reference schema](https://github.com/graphql-cascade/graphql-cascade/blob/main/reference/cascade_base.graphql)**: the GraphQL types every Cascade schema includes. The specification's type definitions match it exactly.
- **[JSON Schemas](https://github.com/graphql-cascade/graphql-cascade/tree/main/specification/schemas)**: the response structures, for validating responses outside GraphQL.
- **Requirement tags**: normative statements carry tags such as `[REQ-103]`, which conformance test cases cite. A requirement is defined once and tested by at least one case.

## Versions

The specification follows semantic versioning: minor versions only add, and a change that could break a conforming implementation waits for a major version. [`VERSIONING.md`](https://github.com/graphql-cascade/graphql-cascade/blob/main/specification/VERSIONING.md) records every version with its changes and migration notes, and [`releases/`](https://github.com/graphql-cascade/graphql-cascade/tree/main/releases) holds the release notes.

## Changing the Specification

Propose changes in a GitHub issue. Larger changes, such as the next major version, are designed in RFCs under [`design/`](https://github.com/graphql-cascade/graphql-cascade/tree/main/design) first. A change to a requirement comes with the conformance test cases that check it.

## Next Steps

- **[Conformance](/specification/conformance)**: testing an implementation
- **[Guide](/guide/)**: Cascade in practice
