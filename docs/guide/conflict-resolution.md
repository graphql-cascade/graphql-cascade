# Conflict Resolution

Handle concurrent updates and data conflicts in distributed systems.

## Overview

In real-world applications, multiple users may update the same data concurrently. GraphQL Cascade provides patterns for detecting and resolving these conflicts.

## Types of Conflicts

### 1. Optimistic Update Conflicts

When the optimistic update doesn't match the server response:

```typescript
// Optimistic: User sets todo to completed
optimisticResponse: {
  updateTodo: {
    todo: { id: '123', completed: true }
  }
}

// Server: Another user deleted the todo
serverResponse: {
  updateTodo: null,
  errors: [{ message: 'Todo not found' }]
}
```

### 2. Concurrent Modification Conflicts

Two users modify the same entity simultaneously:

```typescript
// User A: Updates title
{ id: '123', title: 'New title', completed: false }

// User B: Marks as completed
{ id: '123', title: 'Old title', completed: true }

// Which version wins?
```

### 3. Deletion Conflicts

One user updates while another deletes:

```typescript
// User A: Updates todo
mutation UpdateTodo { updateTodo(id: "123", title: "Updated") }

// User B: Deletes todo
mutation DeleteTodo { deleteTodo(id: "123") }
```

## Resolution Strategies

### Last Write Wins (Default)

The most recent server response takes precedence:

```typescript
// Time T0: Initial state
{ id: '123', title: 'Todo', version: 1 }

// Time T1: User A updates
{ id: '123', title: 'Updated by A', version: 2 }

// Time T2: User B updates
{ id: '123', title: 'Updated by B', version: 3 }

// Final state: User B's update wins
```

GraphQL Cascade applies this by default - the server's response always replaces optimistic updates.

### Optimistic Locking

Use version numbers to detect conflicts:

```typescript
type Todo {
  id: ID!
  title: String!
  version: Int!
}

mutation UpdateTodo($id: ID!, $version: Int!, $input: UpdateTodoInput!) {
  updateTodo(id: $id, version: $version, input: $input) {
    todo {
      id
      title
      version
    }
    __cascade {
      updated { __typename id }
    }
  }
}
```

Server logic:
```typescript
async function updateTodo(id, expectedVersion, input) {
  const todo = await db.getTodo(id);

  if (todo.version !== expectedVersion) {
    throw new Error('Conflict: Todo was modified by another user');
  }

  todo.title = input.title;
  todo.version += 1;

  await db.saveTodo(todo);

  return {
    todo,
    __cascade: { updated: [{ __typename: 'Todo', id }] }
  };
}
```

Client handling:
```typescript
const [updateTodo] = useMutation(UPDATE_TODO, {
  onError: (error) => {
    if (error.message.includes('Conflict')) {
      // Show conflict resolution UI
      showConflictDialog({
        localVersion: optimisticTodo,
        serverVersion: latestTodo,
        onResolve: (resolved) => {
          // Retry with new version
          updateTodo({
            variables: {
              id: todo.id,
              version: latestTodo.version,
              input: resolved
            }
          });
        }
      });
    }
  }
});
```

### Merge Strategies

For complex objects, merge changes instead of replacing:

```typescript
// Server tracks field-level changes
type UpdateMetadata {
  field: String!
  oldValue: String
  newValue: String
  userId: ID!
  timestamp: DateTime!
}

mutation UpdateUser($id: ID!, $changes: [FieldChange!]!) {
  updateUser(id: $id, changes: $changes) {
    user {
      id
      name
      email
      bio
    }
    metadata {
      changes {
        field
        oldValue
        newValue
      }
    }
    __cascade {
      updated { __typename id }
    }
  }
}
```

Client merge logic:
```typescript
function mergeChanges(local, server, metadata) {
  const merged = { ...server };

  // If local changed a field that server didn't touch, keep local change
  for (const [field, value] of Object.entries(local)) {
    const serverChanged = metadata.changes.some(c => c.field === field);
    if (!serverChanged && value !== server[field]) {
      merged[field] = value;
    }
  }

  return merged;
}
```

### Conflict Detection UI

Show users when conflicts occur:

```typescript
function TodoEditor({ todo }) {
  const [updateTodo, { error }] = useMutation(UPDATE_TODO);
  const [showConflict, setShowConflict] = useState(false);

  useEffect(() => {
    if (error?.message.includes('Conflict')) {
      setShowConflict(true);
    }
  }, [error]);

  if (showConflict) {
    return (
      <ConflictDialog
        localVersion={localTodo}
        serverVersion={serverTodo}
        onResolve={(choice) => {
          if (choice === 'local') {
            // Force update with local version
            updateTodo({ variables: { ...localTodo, force: true } });
          } else {
            // Accept server version
            setLocalTodo(serverTodo);
          }
          setShowConflict(false);
        }}
      />
    );
  }

  return <TodoForm todo={todo} onSave={updateTodo} />;
}
```

## Real-time Conflict Prevention

Use subscriptions to prevent conflicts before they happen:

```typescript
// Subscribe to entity updates
const ENTITY_UPDATED = gql`
  subscription OnEntityUpdated($id: ID!) {
    entityUpdated(id: $id) {
      __typename
      id
      version
      updatedBy {
        id
        name
      }
    }
  }
`;

function CollaborativeEditor({ entityId }) {
  const { data } = useSubscription(ENTITY_UPDATED, {
    variables: { id: entityId }
  });

  useEffect(() => {
    if (data?.entityUpdated) {
      // Show warning: "User X is editing this"
      showEditingWarning(data.entityUpdated.updatedBy.name);
    }
  }, [data]);

  // ... editor UI
}
```

## Testing Conflict Scenarios

```typescript
describe('Conflict Resolution', () => {
  test('handles version conflict', async () => {
    const { getByText } = render(<TodoEditor todo={todo} />);

    // Simulate another user updating
    await updateTodoOnServer(todo.id, { version: 2 });

    // Try to update with old version
    const saveButton = getByText('Save');
    fireEvent.click(saveButton);

    // Should show conflict dialog
    await waitFor(() => {
      expect(getByText('Conflict detected')).toBeInTheDocument();
    });
  });

  test('merges non-conflicting changes', async () => {
    const localChanges = { title: 'New title' };
    const serverChanges = { completed: true };

    const merged = mergeChanges(localChanges, serverChanges);

    expect(merged).toEqual({
      title: 'New title',
      completed: true
    });
  });
});
```

## Best Practices

### 1. Use Optimistic Locking for Critical Data
```typescript
// Financial data, inventory, etc.
mutation UpdateBalance($version: Int!, $amount: Float!) {
  updateBalance(version: $version, amount: $amount)
}
```

### 2. Show Edit Conflicts Prominently
```typescript
<Alert severity="warning">
  This item was modified by {otherUser.name} while you were editing.
  Please review the changes before saving.
</Alert>
```

### 3. Auto-save with Conflict Detection
```typescript
// Save every 5 seconds, but handle conflicts gracefully
useInterval(() => {
  saveDraft({ onConflict: 'merge' });
}, 5000);
```

### 4. Log Conflicts for Analysis
```typescript
analytics.track('Conflict Detected', {
  entityType: 'Todo',
  entityId: todo.id,
  conflictType: 'version-mismatch',
  resolution: 'server-wins'
});
```

## Next Steps

- **[Performance](/guide/performance)** - Optimize cascade processing
- **[Client Integration](/clients/)** - Framework-specific patterns
- **[Server Implementation](/server/)** - Server-side conflict handling
