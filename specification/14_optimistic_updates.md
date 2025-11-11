# Optimistic Updates

This section defines the optimistic updates protocol for GraphQL Cascade. Optimistic updates allow clients to immediately apply changes to the UI before receiving server confirmation, improving perceived performance.

## Table of Contents

- [Optimistic Update Protocol](#optimistic-update-protocol)
  - [Protocol Overview](#protocol-overview)
  - [Optimistic Response Format](#optimistic-response-format)
  - [Rollback Mechanism](#rollback-mechanism)
  - [State Management](#state-management)
- [Optimistic Cascade Client](#optimistic-cascade-client)
  - [Client Architecture](#client-architecture)
  - [Mutation Integration](#mutation-integration)
  - [State Synchronization](#state-synchronization)
- [Conflict Resolution](#conflict-resolution)
  - [Conflict Detection](#conflict-detection)
  - [Resolution Strategies](#resolution-strategies)
  - [User Experience](#user-experience)
- [Server-Side Optimistic Support](#server-side-optimistic-support)
  - [Server Validation](#server-validation)
  - [Optimistic Hints](#optimistic-hints)
  - [Fallback Strategies](#fallback-strategies)
- [Performance Considerations](#performance-considerations)
  - [Memory Management](#memory-management)
  - [Network Efficiency](#network-efficiency)
  - [Scalability](#scalability)
- [Error Handling](#error-handling)
  - [Network Failures](#network-failures)
  - [Server Rejections](#server-rejections)
  - [Recovery Strategies](#recovery-strategies)
- [Examples](#examples)
  - [Basic Optimistic Update](#basic-optimistic-update)
  - [Conflict Resolution](#conflict-resolution-1)
  - [Advanced Patterns](#advanced-patterns)

## Optimistic Update Protocol

### Protocol Overview

The optimistic updates protocol allows clients to:

1. **Predict mutation results** before server response
2. **Apply optimistic cascade** immediately to cache
3. **Rollback on failure** or **confirm on success**

```typescript
interface OptimisticCascadeResponse<T = any> extends CascadeResponse<T> {
  optimistic: true;
  rollback?: () => void;  // Function to undo optimistic changes
}
```

### Optimistic Cascade Generation

Clients generate optimistic responses based on mutation input:

```typescript
class OptimisticCascadeGenerator {
  generateOptimisticResponse<T>(
    mutation: DocumentNode,
    variables: any,
    currentCache: CascadeCache
  ): OptimisticCascadeResponse<T> {
    // 1. Predict the mutation result
    const predictedResult = this.predictMutationResult(mutation, variables);

    // 2. Generate optimistic cascade
    const optimisticCascade = this.generateOptimisticCascade(predictedResult, currentCache);

    // 3. Create rollback function
    const rollback = this.createRollbackFunction(optimisticCascade, currentCache);

    return {
      success: true,
      data: predictedResult,
      cascade: optimisticCascade,
      optimistic: true,
      rollback
    };
  }

  private predictMutationResult(mutation: DocumentNode, variables: any): any {
    // Extract mutation name and predict result based on input
    const mutationDef = getMutationDefinition(mutation);
    const mutationName = mutationDef.name.value;

    switch (mutationName) {
      case 'createUser':
        return {
          __typename: 'User',
          id: `temp_${Date.now()}`,  // Temporary ID
          ...variables.input,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

      case 'updateUser':
        // Read current user from cache and apply updates
        const currentUser = this.cache.read('User', variables.id);
        return {
          ...currentUser,
          ...variables.input,
          updatedAt: new Date().toISOString()
        };

      case 'deleteUser':
        return { id: variables.id };

      default:
        throw new Error(`No optimistic prediction for ${mutationName}`);
    }
  }

  private generateOptimisticCascade(
    predictedResult: any,
    cache: CascadeCache
  ): CascadeUpdates {
    const cascade: CascadeUpdates = {
      updated: [],
      deleted: [],
      invalidations: [],
      metadata: {
        timestamp: new Date().toISOString(),
        optimistic: true,
        affectedCount: 0
      }
    };

    // Add the primary result
    if (predictedResult.__typename && predictedResult.id) {
      cascade.updated.push({
        __typename: predictedResult.__typename,
        id: predictedResult.id,
        operation: 'CREATED',  // Assume created for optimistic
        entity: predictedResult
      });
      cascade.metadata.affectedCount++;
    }

    // Predict related entity updates (simplified)
    const relatedUpdates = this.predictRelatedUpdates(predictedResult, cache);
    cascade.updated.push(...relatedUpdates);
    cascade.metadata.affectedCount += relatedUpdates.length;

    // Generate optimistic invalidations
    cascade.invalidations = this.generateOptimisticInvalidations(predictedResult);

    return cascade;
  }

  private predictRelatedUpdates(result: any, cache: CascadeCache): UpdatedEntity[] {
    // Simplified: predict some related updates based on domain knowledge
    const updates: UpdatedEntity[] = [];

    if (result.__typename === 'User' && result.companyId) {
      // If user was added to company, update company employee count
      const company = cache.read('Company', result.companyId);
      if (company) {
        updates.push({
          __typename: 'Company',
          id: result.companyId,
          operation: 'UPDATED',
          entity: {
            ...company,
            employeeCount: company.employeeCount + 1,
            updatedAt: new Date().toISOString()
          }
        });
      }
    }

    return updates;
  }

  private generateOptimisticInvalidations(result: any): QueryInvalidation[] {
    // Generate invalidations that would occur on success
    const invalidations: QueryInvalidation[] = [];

    if (result.__typename === 'User') {
      invalidations.push({
        queryName: 'listUsers',
        strategy: 'INVALIDATE',
        scope: 'PREFIX'
      });
    }

    return invalidations;
  }

  private createRollbackFunction(
    cascade: CascadeUpdates,
    cache: CascadeCache
  ): () => void {
    // Capture current state for rollback
    const rollbackState: Array<{ type: string, id: string, data: any }> = [];

    for (const entity of cascade.updated) {
      const current = cache.read(entity.__typename, entity.id);
      rollbackState.push({
        type: entity.__typename,
        id: entity.id,
        data: current
      });
    }

    return () => {
      // Restore previous state
      for (const state of rollbackState) {
        if (state.data === null) {
          cache.evict(state.type, state.id);
        } else {
          cache.write(state.type, state.id, state.data);
        }
      }
    };
  }
}
```

## Optimistic Cascade Client

### Implementation

```typescript
class OptimisticCascadeClient extends CascadeClient {
  private optimisticGenerator = new OptimisticCascadeGenerator();
  private pendingOptimisticUpdates = new Map<string, OptimisticUpdate>();

  async mutateOptimistic<T = any>(
    mutation: DocumentNode,
    variables?: any,
    options: OptimisticOptions = {}
  ): Promise<T> {
    const mutationId = this.generateMutationId();

    // 1. Generate optimistic response
    const optimisticResponse = this.optimisticGenerator.generateOptimisticResponse<T>(
      mutation,
      variables,
      this.cache
    );

    // 2. Store rollback information
    this.pendingOptimisticUpdates.set(mutationId, {
      response: optimisticResponse,
      timestamp: Date.now()
    });

    // 3. Apply optimistic cascade immediately
    this.applyCascade(optimisticResponse);

    // 4. Trigger UI updates (optional callback)
    options.onOptimisticUpdate?.(optimisticResponse.data);

    try {
      // 5. Execute real mutation
      const realResult = await this.mutate<T>(mutation, variables);

      // 6. Confirm optimistic update
      this.confirmOptimisticUpdate(mutationId);

      // 7. Trigger success callback
      options.onSuccess?.(realResult);

      return realResult;

    } catch (error) {
      // 8. Rollback on failure
      this.rollbackOptimisticUpdate(mutationId);

      // 9. Trigger error callback
      options.onError?.(error);

      throw error;
    }
  }

  private confirmOptimisticUpdate(mutationId: string): void {
    const optimistic = this.pendingOptimisticUpdates.get(mutationId);
    if (optimistic) {
      // Clear rollback function (no longer needed)
      optimistic.response.rollback = undefined;
      this.pendingOptimisticUpdates.delete(mutationId);
    }
  }

  private rollbackOptimisticUpdate(mutationId: string): void {
    const optimistic = this.pendingOptimisticUpdates.get(mutationId);
    if (optimistic && optimistic.response.rollback) {
      // Execute rollback
      optimistic.response.rollback();

      this.pendingOptimisticUpdates.delete(mutationId);
    }
  }

  private generateMutationId(): string {
    return `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

interface OptimisticOptions {
  onOptimisticUpdate?: (data: any) => void;
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}

interface OptimisticUpdate {
  response: OptimisticCascadeResponse;
  timestamp: number;
}
```

### Usage Example

```typescript
const optimisticClient = new OptimisticCascadeClient(cache, executor);

// Optimistic mutation
const updatedUser = await optimisticClient.mutateOptimistic(
  UPDATE_USER_MUTATION,
  { id: '123', input: { name: 'New Name' } },
  {
    onOptimisticUpdate: (optimisticData) => {
      // UI immediately shows optimistic update
      setUserName(optimisticData.name);
      showSavingIndicator();
    },
    onSuccess: (realData) => {
      // Confirm with real data
      setUserName(realData.name);
      hideSavingIndicator();
      showSuccessMessage();
    },
    onError: (error) => {
      // Handle error
      hideSavingIndicator();
      showErrorMessage(error.message);
    }
  }
);
```

## Conflict Resolution

### Optimistic Conflicts

Conflicts occur when optimistic updates don't match server reality:

```typescript
class OptimisticConflictResolver {
  detectConflicts(
    optimisticResult: any,
    serverResult: any
  ): ConflictDetection {
    // Compare optimistic vs server results
    const conflicts: ConflictField[] = [];

    for (const field of Object.keys(optimisticResult)) {
      if (optimisticResult[field] !== serverResult[field]) {
        conflicts.push({
          field,
          optimisticValue: optimisticResult[field],
          serverValue: serverResult[field]
        });
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
      optimisticResult,
      serverResult
    };
  }

  resolveConflict(
    detection: ConflictDetection,
    strategy: ConflictResolutionStrategy = 'SERVER_WINS'
  ): any {
    switch (strategy) {
      case 'SERVER_WINS':
        return detection.serverResult;

      case 'CLIENT_WINS':
        return detection.optimisticResult;

      case 'MERGE':
        return this.mergeResults(detection.optimisticResult, detection.serverResult);

      case 'MANUAL':
        throw new OptimisticConflictError(detection);

      default:
        return detection.serverResult;
    }
  }

  private mergeResults(optimistic: any, server: any): any {
    // Simple merge: server wins for conflicts, keep optimistic for non-conflicts
    const merged = { ...server };

    for (const [key, value] of Object.entries(optimistic)) {
      if (!(key in server)) {
        merged[key] = value;
      }
    }

    return merged;
  }
}

interface ConflictDetection {
  hasConflicts: boolean;
  conflicts: ConflictField[];
  optimisticResult: any;
  serverResult: any;
}

interface ConflictField {
  field: string;
  optimisticValue: any;
  serverValue: any;
}

type ConflictResolutionStrategy = 'SERVER_WINS' | 'CLIENT_WINS' | 'MERGE' | 'MANUAL';

class OptimisticConflictError extends Error {
  constructor(public detection: ConflictDetection) {
    super('Optimistic update conflict detected');
  }
}
```

### Conflict-Aware Optimistic Client

```typescript
class ConflictAwareOptimisticClient extends OptimisticCascadeClient {
  private conflictResolver = new OptimisticConflictResolver();

  async mutateOptimistic<T = any>(
    mutation: DocumentNode,
    variables?: any,
    options: OptimisticOptions & { conflictStrategy?: ConflictResolutionStrategy } = {}
  ): Promise<T> {
    const mutationId = this.generateMutationId();

    // Generate and apply optimistic update
    const optimisticResponse = this.optimisticGenerator.generateOptimisticResponse<T>(
      mutation,
      variables,
      this.cache
    );

    this.pendingOptimisticUpdates.set(mutationId, {
      response: optimisticResponse,
      timestamp: Date.now()
    });

    this.applyCascade(optimisticResponse);
    options.onOptimisticUpdate?.(optimisticResponse.data);

    try {
      // Execute real mutation
      const realResult = await this.mutate<T>(mutation, variables);

      // Check for conflicts
      const conflicts = this.conflictResolver.detectConflicts(
        optimisticResponse.data,
        realResult
      );

      if (conflicts.hasConflicts) {
        // Resolve conflicts
        const resolvedResult = this.conflictResolver.resolveConflict(
          conflicts,
          options.conflictStrategy || 'SERVER_WINS'
        );

        // Update with resolved result
        this.applyResolvedResult(resolvedResult);
        options.onConflictResolved?.(resolvedResult, conflicts);
      }

      this.confirmOptimisticUpdate(mutationId);
      options.onSuccess?.(realResult);

      return realResult;

    } catch (error) {
      this.rollbackOptimisticUpdate(mutationId);
      options.onError?.(error);
      throw error;
    }
  }

  private applyResolvedResult(resolvedResult: any): void {
    if (resolvedResult.__typename && resolvedResult.id) {
      this.cache.write(resolvedResult.__typename, resolvedResult.id, resolvedResult);
    }
  }
}
```

## Server-Side Optimistic Support

### Optimistic Response Hints

Servers can provide hints for better optimistic updates:

```python
class OptimisticHintBuilder:
    def generate_optimistic_hints(self, mutation_name, variables, current_user):
        """Generate hints to help clients create better optimistic responses."""

        hints = {
            'predicted_id': None,
            'predicted_fields': {},
            'related_updates': [],
            'invalidations': []
        }

        if mutation_name == 'createUser':
            hints['predicted_id'] = f'temp_{uuid.uuid4()}'
            hints['predicted_fields'] = {
                'createdAt': datetime.utcnow().isoformat(),
                'updatedAt': datetime.utcnow().isoformat(),
                'createdBy': current_user.id
            }

        elif mutation_name == 'updateUser':
            # Predict version increment for optimistic locking
            current_version = self.get_current_version('User', variables['id'])
            hints['predicted_fields']['version'] = current_version + 1

        return hints
```

### Optimistic Cascade Schema

```graphql
"""
Hints for optimistic updates.
"""
type OptimisticHints {
  """Predicted ID for newly created entities."""
  predictedId: ID

  """Predicted values for fields."""
  predictedFields: JSON

  """Predicted updates to related entities."""
  relatedUpdates: [OptimisticRelatedUpdate!]

  """Predicted query invalidations."""
  invalidations: [QueryInvalidation!]
}

type OptimisticRelatedUpdate {
  __typename: String!
  id: ID!
  operation: CascadeOperation!
  predictedFields: JSON!
}

type Mutation {
  createUser(input: CreateUserInput!): CreateUserCascade!
    @optimistic(hints: true)
}
```

## Performance Considerations

### Optimistic Update Limits

Clients should limit optimistic updates to prevent excessive memory usage:

```typescript
class BoundedOptimisticClient extends OptimisticCascadeClient {
  private maxPendingOptimistic = 10;

  async mutateOptimistic<T = any>(
    mutation: DocumentNode,
    variables?: any,
    options: OptimisticOptions = {}
  ): Promise<T> {
    // Check limits
    if (this.pendingOptimisticUpdates.size >= this.maxPendingOptimistic) {
      // Reject or wait for pending updates to complete
      throw new Error('Too many pending optimistic updates');
    }

    // Clean up old pending updates (timeout protection)
    this.cleanupExpiredOptimisticUpdates();

    return super.mutateOptimistic(mutation, variables, options);
  }

  private cleanupExpiredOptimisticUpdates(): void {
    const now = Date.now();
    const timeoutMs = 30000; // 30 seconds

    for (const [id, update] of this.pendingOptimisticUpdates) {
      if (now - update.timestamp > timeoutMs) {
        // Auto-rollback expired optimistic updates
        this.rollbackOptimisticUpdate(id);
      }
    }
  }
}
```

### Memory Management

Optimistic updates should not accumulate indefinitely:

```typescript
class MemoryManagedOptimisticClient extends OptimisticCascadeClient {
  private maxMemoryUsage = 50 * 1024 * 1024; // 50MB
  private currentMemoryUsage = 0;

  private trackMemoryUsage(response: OptimisticCascadeResponse): void {
    const size = this.calculateResponseSize(response);
    this.currentMemoryUsage += size;
  }

  private calculateResponseSize(response: any): number {
    return JSON.stringify(response).length * 2; // Rough estimate
  }

  private checkMemoryLimits(): void {
    if (this.currentMemoryUsage > this.maxMemoryUsage) {
      // Rollback oldest optimistic updates
      this.rollbackOldestOptimisticUpdates();
    }
  }

  private rollbackOldestOptimisticUpdates(): void {
    // Sort by timestamp and rollback oldest
    const sorted = Array.from(this.pendingOptimisticUpdates.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    for (const [id] of sorted) {
      if (this.currentMemoryUsage <= this.maxMemoryUsage * 0.8) break;
      this.rollbackOptimisticUpdate(id);
    }
  }
}
```

## Error Handling

### Optimistic Update Errors

Handle cases where optimistic updates fail:

```typescript
class RobustOptimisticClient extends OptimisticCascadeClient {
  async mutateOptimistic<T = any>(
    mutation: DocumentNode,
    variables?: any,
    options: OptimisticOptions = {}
  ): Promise<T> {
    try {
      return await super.mutateOptimistic(mutation, variables, options);
    } catch (error) {
      // Enhanced error handling
      if (error instanceof OptimisticConflictError) {
        // Handle conflict resolution
        const resolved = await this.handleConflictResolution(error.detection, options);
        return resolved;
      }

      if (error.message.includes('Too many pending optimistic updates')) {
        // Handle rate limiting
        await this.waitForPendingUpdates();
        return this.mutateOptimistic(mutation, variables, options);
      }

      throw error;
    }
  }

  private async handleConflictResolution(
    detection: ConflictDetection,
    options: OptimisticOptions
  ): Promise<any> {
    if (options.onConflict) {
      // Let user decide resolution
      const strategy = await options.onConflict(detection);
      return this.conflictResolver.resolveConflict(detection, strategy);
    }

    // Default: server wins
    return detection.serverResult;
  }

  private async waitForPendingUpdates(): Promise<void> {
    // Wait for some pending updates to complete
    const pendingCount = this.pendingOptimisticUpdates.size;
    if (pendingCount > 5) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}
```

## Examples

### Complete Optimistic Client

```typescript
class CompleteOptimisticCascadeClient extends CascadeClient {
  private generator = new OptimisticCascadeGenerator();
  private resolver = new OptimisticConflictResolver();
  private pending = new Map<string, PendingOptimisticUpdate>();

  async mutateWithOptimistic<T = any>(
    mutation: DocumentNode,
    variables: any,
    config: OptimisticConfig = {}
  ): Promise<T> {
    const id = this.generateId();

    // Generate optimistic response
    const optimistic = this.generator.generate(mutation, variables, this.cache);

    // Store for rollback
    this.pending.set(id, {
      optimistic,
      applied: false,
      timestamp: Date.now()
    });

    // Apply optimistic update
    this.applyOptimistic(optimistic);
    config.onOptimistic?.(optimistic.data);

    try {
      // Execute real mutation
      const real = await this.mutate<T>(mutation, variables);

      // Check for conflicts
      const conflicts = this.resolver.detect(optimistic.data, real);

      if (conflicts.hasConflicts) {
        const resolved = await this.resolveConflicts(conflicts, config);
        this.applyResolved(resolved);
        config.onConflictResolved?.(resolved, conflicts);
      }

      // Confirm
      this.confirm(id);
      config.onSuccess?.(real);

      return real;

    } catch (error) {
      // Rollback
      this.rollback(id);
      config.onError?.(error);
      throw error;
    }
  }

  private applyOptimistic(response: OptimisticCascadeResponse): void {
    this.applyCascade(response);
  }

  private async resolveConflicts(
    conflicts: ConflictDetection,
    config: OptimisticConfig
  ): Promise<any> {
    if (config.conflictStrategy === 'MANUAL' && config.onConflictPrompt) {
      const strategy = await config.onConflictPrompt(conflicts);
      return this.resolver.resolve(conflicts, strategy);
    }

    return this.resolver.resolve(conflicts, config.conflictStrategy || 'SERVER_WINS');
  }

  private applyResolved(resolved: any): void {
    if (resolved.__typename && resolved.id) {
      this.cache.write(resolved.__typename, resolved.id, resolved);
    }
  }

  private confirm(id: string): void {
    this.pending.delete(id);
  }

  private rollback(id: string): void {
    const pending = this.pending.get(id);
    if (pending?.optimistic.rollback) {
      pending.optimistic.rollback();
    }
    this.pending.delete(id);
  }

  private generateId(): string {
    return `opt_${Date.now()}_${Math.random()}`;
  }
}

interface OptimisticConfig {
  conflictStrategy?: 'SERVER_WINS' | 'CLIENT_WINS' | 'MERGE' | 'MANUAL';
  onOptimistic?: (data: any) => void;
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
  onConflictPrompt?: (conflicts: ConflictDetection) => Promise<string>;
  onConflictResolved?: (resolved: any, conflicts: ConflictDetection) => void;
}

interface PendingOptimisticUpdate {
  optimistic: OptimisticCascadeResponse;
  applied: boolean;
  timestamp: number;
}
```

### React Hook Integration

```typescript
function useOptimisticCascadeMutation<T = any>(
  mutation: DocumentNode,
  config: OptimisticConfig = {}
) {
  const client = useOptimisticCascadeClient();

  return useMutation({
    mutationFn: (variables: any) =>
      client.mutateWithOptimistic<T>(mutation, variables, config)
  });
}

// Usage
function UserProfile({ userId }: { userId: string }) {
  const [updateUser] = useOptimisticCascadeMutation(UPDATE_USER, {
    conflictStrategy: 'MERGE',
    onOptimistic: (data) => {
      // Immediate UI update
      setUser(data);
      setSaving(true);
    },
    onSuccess: (data) => {
      setUser(data);
      setSaving(false);
      toast.success('Updated!');
    },
    onError: (error) => {
      setSaving(false);
      toast.error('Failed to update');
    },
    onConflictPrompt: async (conflicts) => {
      // Show conflict resolution UI
      return await showConflictDialog(conflicts);
    }
  });

  return (
    <button
      onClick={() => updateUser({ id: userId, input: { name: 'New Name' } })}
      disabled={saving}
    >
      {saving ? 'Saving...' : 'Update Name'}
    </button>
  );
}
```</content>
</xai:function_call">The file has been written successfully.