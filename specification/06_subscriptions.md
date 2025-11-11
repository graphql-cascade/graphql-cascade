# Real-Time Subscriptions

This document defines how GraphQL Cascade integrates with GraphQL subscriptions for real-time updates.

## Overview

Subscriptions allow clients to receive real-time updates when data changes. GraphQL Cascade provides a standardized way to deliver cascade updates through subscriptions, ensuring that real-time updates are consistent with mutation responses.

## Subscription Schema

### Cascade Update Subscription
```graphql
type Subscription {
  """
  Subscribe to cascade updates for specific entity types.
  """
  cascadeUpdates(
    """Entity types to subscribe to (e.g., ["User", "Company"])."""
    entityTypes: [String!]

    """Optional filter by entity IDs."""
    entityIds: [ID!]

    """Optional filter by operations."""
    operations: [CascadeOperation!]
  ): CascadeUpdateEvent!
}
```

### Cascade Update Event
```graphql
"""
Real-time cascade update event.
"""
type CascadeUpdateEvent {
  """Type of event."""
  eventType: CascadeEventType!

  """The updated entity (for CREATED/UPDATED events)."""
  entity: UpdatedEntity

  """The deleted entity (for DELETED events)."""
  deletedEntity: DeletedEntity

  """Timestamp of the event."""
  timestamp: DateTime!

  """Transaction that caused this update."""
  transactionId: ID

  """Source of the event."""
  source: EventSource!
}
```

### Event Types
```graphql
enum CascadeEventType {
  ENTITY_CREATED
  ENTITY_UPDATED
  ENTITY_DELETED
}

enum EventSource {
  MUTATION     # Event from a mutation
  SUBSCRIPTION # Event from another subscription
  SYSTEM       # System-generated event
}
```

## Subscription Flow

### 1. Client Subscribes
```graphql
subscription OnUserUpdates {
  cascadeUpdates(entityTypes: ["User"]) {
    eventType
    entity {
      __typename
      id
      operation
      entity {
        ... on User {
          id
          name
          email
          updatedAt
        }
      }
    }
    timestamp
    transactionId
  }
}
```

### 2. Mutation Executes
When a mutation runs, it:
1. Tracks all affected entities
2. Applies changes to database
3. Publishes cascade events to subscribers
4. Returns cascade response to mutating client

### 3. Subscribers Receive Updates
```json
{
  "data": {
    "cascadeUpdates": {
      "eventType": "ENTITY_UPDATED",
      "entity": {
        "__typename": "User",
        "id": "123",
        "operation": "UPDATED",
        "entity": {
          "id": "123",
          "name": "Updated Name",
          "email": "user@example.com",
          "updatedAt": "2023-11-11T10:30:00Z"
        }
      },
      "timestamp": "2023-11-11T10:30:00Z",
      "transactionId": "txn_abc123"
    }
  }
}
```

## Consistency Guarantees

### Mutation-Subscription Consistency
- Subscription events MUST reflect the same data as mutation cascade responses
- Events MUST be published after the mutation transaction commits
- Subscribers MUST receive events in the correct order

### Event Ordering
- Events from the same transaction MUST be delivered in sequence
- Clients MAY receive events out of order between different transactions
- Use `transactionId` to group related events

## Filtering and Scoping

### Entity Type Filtering
Subscribe to specific entity types:

```graphql
# Subscribe to User and Company updates
cascadeUpdates(entityTypes: ["User", "Company"])

# Subscribe to all entity types
cascadeUpdates(entityTypes: [])
```

### Entity ID Filtering
Subscribe to specific entities:

```graphql
# Subscribe to updates for specific users
cascadeUpdates(
  entityTypes: ["User"],
  entityIds: ["123", "456"]
)
```

### Operation Filtering
Subscribe to specific operations:

```graphql
# Only creation events
cascadeUpdates(
  entityTypes: ["User"],
  operations: [CREATED]
)

# All operations
cascadeUpdates(entityTypes: ["User"])
```

## Server Implementation

### Event Publishing
```python
class CascadeSubscriptionManager:
    def __init__(self, pubsub):
        self.pubsub = pubsub

    async def publish_cascade(self, cascade: CascadeUpdates, transaction_id: str):
        """Publish cascade updates to subscribers."""

        for updated_entity in cascade.updated:
            event = {
                "eventType": f"ENTITY_{updated_entity.operation}",
                "entity": updated_entity,
                "timestamp": cascade.metadata.timestamp,
                "transactionId": transaction_id,
                "source": "MUTATION"
            }

            # Publish to subscribers
            await self.pubsub.publish("cascadeUpdates", event)

        for deleted_entity in cascade.deleted:
            event = {
                "eventType": "ENTITY_DELETED",
                "deletedEntity": deleted_entity,
                "timestamp": deleted_entity.deletedAt,
                "transactionId": transaction_id,
                "source": "MUTATION"
            }

            await self.pubsub.publish("cascadeUpdates", event)
```

### Subscription Resolution
```python
def resolve_cascade_updates(self, info, entityTypes=None, entityIds=None, operations=None):
    """Resolve cascadeUpdates subscription."""

    async def event_generator():
        async for event in self.pubsub.subscribe("cascadeUpdates"):
            # Apply filters
            if entityTypes and event.entity.__typename not in entityTypes:
                continue

            if entityIds and event.entity.id not in entityIds:
                continue

            if operations and event.entity.operation not in operations:
                continue

            yield event

    return event_generator()
```

## Client Integration

### Automatic Cache Updates
Subscriptions can automatically update the cache:

```typescript
class RealtimeCascadeClient extends CascadeClient {
  constructor(cache: CascadeCache, subscriptionClient: any) {
    super(cache);

    // Subscribe to cascade updates
    subscriptionClient.subscribe({
      query: gql`
        subscription OnCascadeUpdates {
          cascadeUpdates {
            eventType
            entity { __typename id operation entity }
            deletedEntity { __typename id deletedAt }
            timestamp
            transactionId
          }
        }
      `
    }).subscribe({
      next: ({ data }) => {
        const event = data.cascadeUpdates;

        // Apply to cache like a mutation response
        if (event.entity) {
          this.applyEntityUpdate(event.entity);
        }

        if (event.deletedEntity) {
          this.applyEntityDeletion(event.deletedEntity);
        }
      }
    });
  }
}
```

### Conflict Resolution
Handle conflicts between mutation responses and subscription events:

```typescript
class ConflictResolvingClient extends RealtimeCascadeClient {
  private pendingMutations = new Set<string>();

  async mutate(mutation, variables) {
    const mutationId = generateId();

    // Track pending mutation
    this.pendingMutations.add(mutationId);

    try {
      const result = await super.mutate(mutation, variables);

      // Mark as completed
      this.pendingMutations.delete(mutationId);

      return result;
    } catch (error) {
      this.pendingMutations.delete(mutationId);
      throw error;
    }
  }

  handleSubscriptionEvent(event) {
    // Ignore events from our own mutations
    if (this.pendingMutations.has(event.transactionId)) {
      return;
    }

    // Apply subscription event
    super.handleSubscriptionEvent(event);
  }
}
```

## Performance Considerations

### Subscription Filtering
- Filter events server-side to reduce network traffic
- Use efficient indexing for entity type/ID filtering
- Support pattern matching for entity types

### Connection Management
- Limit concurrent subscriptions per client
- Implement connection pooling
- Handle reconnection gracefully

### Event Batching
- Batch related events from the same transaction
- Use efficient serialization
- Compress event payloads

## Security Considerations

### Authorization
- Check subscription permissions server-side
- Filter events based on user access controls
- Prevent information leakage through subscriptions

### Rate Limiting
- Limit subscription frequency per client
- Implement event rate limits
- Monitor for subscription abuse

### Authentication
- Require authentication for subscriptions
- Validate subscription tokens
- Handle authentication expiry

## Examples

### Basic User Updates
```graphql
subscription UserUpdates {
  cascadeUpdates(entityTypes: ["User"]) {
    eventType
    entity {
      __typename
      id
      operation
      entity {
        ... on User {
          id
          name
          email
          updatedAt
        }
      }
    }
    timestamp
  }
}
```

### Filtered Company Updates
```graphql
subscription CompanyUpdates {
  cascadeUpdates(
    entityTypes: ["Company"]
    entityIds: ["123", "456"]
    operations: [UPDATED]
  ) {
    eventType
    entity {
      __typename
      id
      operation
      entity {
        ... on Company {
          id
          name
          updatedAt
        }
      }
    }
    timestamp
  }
}
```

### Real-Time Dashboard
```graphql
subscription DashboardUpdates {
  cascadeUpdates(entityTypes: ["User", "Company", "Order"]) {
    eventType
    entity {
      __typename
      id
      operation
      entity {
        ... on User { id name }
        ... on Company { id name }
        ... on Order { id total status }
      }
    }
    deletedEntity {
      __typename
      id
    }
    timestamp
  }
}
```

## Integration with Existing Systems

### Apollo Client
```typescript
import { useSubscription } from '@apollo/client';

function useCascadeSubscription() {
  return useSubscription(
    gql`
      subscription OnCascadeUpdates {
        cascadeUpdates(entityTypes: ["User"]) {
          eventType
          entity { __typename id operation entity }
        }
      }
    `,
    {
      onData: ({ data }) => {
        // Apply to Apollo cache
        applyCascadeToApolloCache(data.data.cascadeUpdates);
      }
    }
  );
}
```

### Relay
```typescript
import { useSubscription } from 'react-relay';

function useCascadeSubscription() {
  return useSubscription({
    subscription: gql`
      subscription OnCascadeUpdates {
        cascadeUpdates(entityTypes: ["User"]) {
          eventType
          entity { __typename id operation entity }
        }
      }
    `,
    onNext: (data) => {
      // Apply to Relay store
      applyCascadeToRelayStore(data.cascadeUpdates);
    }
  });
}
```

## Testing

### Subscription Testing
```typescript
describe('Cascade Subscriptions', () => {
  it('publishes events on mutation', async () => {
    const subscription = subscribeToCascade(['User']);

    // Execute mutation
    await mutate(createUserMutation, { input: userData });

    // Check subscription received event
    const event = await subscription.next();
    expect(event.eventType).toBe('ENTITY_CREATED');
    expect(event.entity.__typename).toBe('User');
  });

  it('filters by entity type', async () => {
    const userSub = subscribeToCascade(['User']);
    const companySub = subscribeToCascade(['Company']);

    await mutate(createUserMutation, { input: userData });

    // User subscription should receive event
    await expect(userSub.next()).resolves.toBeDefined();

    // Company subscription should not
    await expect(companySub.next()).rejects.toThrow('timeout');
  });
});
```