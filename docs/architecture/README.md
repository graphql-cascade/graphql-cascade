# Architecture Documentation

This directory contains architectural documentation, design decisions, and technical deep-dives for GraphQL Cascade.

## Core Architecture

- **[Design Decisions](design-decisions.md)** - Architectural Decision Records (ADRs) explaining key design choices
- **[Internals](internals.md)** - How GraphQL Cascade works under the hood
- **[Comparison](comparison.md)** - Technical comparison with Relay, Apollo, and other cache solutions

## Language & Specification

- **[Language Extension Approach](language-extension-approach.md)** - How frontend concepts are integrated into the SpecQL language

## Diagrams

- **[Cache Update Sequence](cache_update_sequence.mmd)** - Sequence diagram showing cache update flow
- **[Entity Relationship Tracking](entity_relationship_tracking.mmd)** - How entities and relationships are tracked
- **[Invalidation Decision Tree](invalidation_decision_tree.mmd)** - Logic for determining what to invalidate
- **[Mutation Flow](mutation_flow.mmd)** - Complete mutation processing flow

## Key Design Principles

### 1. **Automatic Cache Updates**
GraphQL Cascade automatically updates your cache based on mutation responses, eliminating manual cache management.

### 2. **Entity-Based Tracking**
All cache updates are based on entity identity, ensuring consistency across different queries and mutations.

### 3. **Framework Agnostic**
Works with any GraphQL client that supports cache manipulation.

### 4. **Server-Driven**
Cache update logic is defined on the server, ensuring consistency between client and server.

## For Contributors

When making architectural changes:

1. Document the decision in [Design Decisions](design-decisions.md)
2. Update relevant diagrams
3. Ensure the change aligns with our core principles
4. Update this README if new documentation is added

## Related Documentation

- **[Specification](../../specification/)** - Formal specification of the GraphQL Cascade protocol
- **[Implementation Strategy](../../design/implementation-strategy.md)** - How to implement GraphQL Cascade