# Conflict Resolution

This section defines conflict detection and resolution strategies for GraphQL Cascade. Conflicts occur when client and server state diverge, requiring reconciliation.

## Table of Contents

- [Conflict Types](#conflict-types)
  - [Version Conflicts](#version-conflicts)
  - [Timestamp Conflicts](#timestamp-conflicts)
  - [Logical Conflicts](#logical-conflicts)
- [Conflict Detection](#conflict-detection)
  - [Client-Side Detection](#client-side-detection)
  - [Server-Side Detection](#server-side-detection)
  - [Hybrid Detection](#hybrid-detection)
- [Conflict Resolution Strategies](#conflict-resolution-strategies)
  - [Client Wins](#client-wins)
  - [Server Wins](#server-wins)
  - [Manual Resolution](#manual-resolution)
  - [Merge Resolution](#merge-resolution)
- [Conflict-Aware Cascade Client](#conflict-aware-cascade-client)
  - [Conflict Detection Integration](#conflict-detection-integration)
  - [Resolution Strategy Configuration](#resolution-strategy-configuration)
  - [Conflict Event Handling](#conflict-event-handling)
- [Server-Side Conflict Prevention](#server-side-conflict-prevention)
  - [Optimistic Locking](#optimistic-locking)
  - [Conflict-Free Replicated Data Types](#conflict-free-replicated-data-types)
  - [Operational Transforms](#operational-transforms)
- [Real-time Conflict Resolution](#real-time-conflict-resolution)
  - [Live Conflict Detection](#live-conflict-detection)
  - [Collaborative Editing](#collaborative-editing)
  - [Conflict Broadcasting](#conflict-broadcasting)
- [Performance Considerations](#performance-considerations)
  - [Conflict Detection Overhead](#conflict-detection-overhead)
  - [Resolution Strategy Performance](#resolution-strategy-performance)
  - [Scalability Considerations](#scalability-considerations)
- [Examples](#examples)
  - [Version-Based Resolution](#version-based-resolution)
  - [Timestamp-Based Resolution](#timestamp-based-resolution)
  - [Manual Resolution UI](#manual-resolution-ui)

## Conflict Types

### Version Conflicts

Version conflicts occur when entities have been modified since the client last saw them:

```typescript
interface VersionedEntity {
  id: string;
  version: number;  // Incremented on each update
  updatedAt: string;
}

// Client has version 1
const clientEntity: VersionedEntity = {
  id: 'user-123',
  version: 1,
  updatedAt: '2024-01-01T10:00:00Z'
};

// Server has version 2 (someone else updated it)
const serverEntity: VersionedEntity = {
  id: 'user-123',
  version: 2,
  updatedAt: '2024-01-01T11:00:00Z'
};
```

### Timestamp Conflicts

Timestamp conflicts use update timestamps for conflict detection:

```typescript
interface TimestampedEntity {
  id: string;
  updatedAt: string;
}

// Client last saw entity at 10:00
const clientTimestamp = '2024-01-01T10:00:00Z';

// Server entity was updated at 11:00
const serverEntity: TimestampedEntity = {
  id: 'user-123',
  updatedAt: '2024-01-01T11:00:00Z'
};
```

### Field-Level Conflicts

Field-level conflicts occur when specific fields have conflicting values:

```typescript
// Client optimistic update
const clientUpdate = {
  name: 'John Doe',
  email: 'john@example.com'
};

// Server actual state
const serverState = {
  name: 'Jane Doe',  // Different!
  email: 'john@example.com'  // Same
};

// Conflict on 'name' field
```

## Conflict Detection

### Generic Conflict Detector

```typescript
class CascadeConflictDetector {
  detectConflicts(
    localEntity: any,
    serverEntity: any,
    strategy: ConflictDetectionStrategy = 'VERSION_BASED'
  ): ConflictDetection {
    switch (strategy) {
      case 'VERSION_BASED':
        return this.detectVersionConflicts(localEntity, serverEntity);

      case 'TIMESTAMP_BASED':
        return this.detectTimestampConflicts(localEntity, serverEntity);

      case 'FIELD_BASED':
        return this.detectFieldConflicts(localEntity, serverEntity);

      case 'HYBRID':
        return this.detectHybridConflicts(localEntity, serverEntity);

      default:
        return { hasConflict: false };
    }
  }

  private detectVersionConflicts(local: any, server: any): ConflictDetection {
    if (local.version && server.version && local.version !== server.version) {
      return {
        hasConflict: true,
        conflictType: 'VERSION_MISMATCH',
        localEntity: local,
        serverEntity: server,
        details: {
          localVersion: local.version,
          serverVersion: server.version
        }
      };
    }
    return { hasConflict: false };
  }

  private detectTimestampConflicts(local: any, server: any): ConflictDetection {
    if (local.updatedAt && server.updatedAt) {
      const localTime = new Date(local.updatedAt).getTime();
      const serverTime = new Date(server.updatedAt).getTime();

      if (localTime < serverTime) {
        return {
          hasConflict: true,
          conflictType: 'TIMESTAMP_MISMATCH',
          localEntity: local,
          serverEntity: server,
          details: {
            localTimestamp: local.updatedAt,
            serverTimestamp: server.updatedAt
          }
        };
      }
    }
    return { hasConflict: false };
  }

  private detectFieldConflicts(local: any, server: any): ConflictDetection {
    const conflicts: FieldConflict[] = [];

    // Compare all fields
    for (const [field, localValue] of Object.entries(local)) {
      const serverValue = server[field];

      if (this.valuesDiffer(localValue, serverValue)) {
        conflicts.push({
          field,
          localValue,
          serverValue,
          conflictType: this.classifyFieldConflict(field, localValue, serverValue)
        });
      }
    }

    if (conflicts.length > 0) {
      return {
        hasConflict: true,
        conflictType: 'FIELD_CONFLICTS',
        localEntity: local,
        serverEntity: server,
        fieldConflicts: conflicts
      };
    }

    return { hasConflict: false };
  }

  private detectHybridConflicts(local: any, server: any): ConflictDetection {
    // Try version-based first
    let detection = this.detectVersionConflicts(local, server);
    if (detection.hasConflict) return detection;

    // Then timestamp-based
    detection = this.detectTimestampConflicts(local, server);
    if (detection.hasConflict) return detection;

    // Finally field-based
    return this.detectFieldConflicts(local, server);
  }

  private valuesDiffer(a: any, b: any): boolean {
    if (a === b) return false;
    if (a == null || b == null) return a !== b;
    if (typeof a !== typeof b) return true;

    if (Array.isArray(a) && Array.isArray(b)) {
      return a.length !== b.length || a.some((val, i) => this.valuesDiffer(val, b[i]));
    }

    if (typeof a === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return true;
      return keysA.some(key => this.valuesDiffer(a[key], b[key]));
    }

    return true;
  }

  private classifyFieldConflict(field: string, local: any, server: any): FieldConflictType {
    // Domain-specific conflict classification
    if (field === 'version' || field === 'updatedAt') {
      return 'METADATA_CONFLICT';
    }

    if (field.includes('email') || field.includes('phone')) {
      return 'CONTACT_INFO_CONFLICT';
    }

    if (field.includes('balance') || field.includes('amount')) {
      return 'FINANCIAL_CONFLICT';
    }

    return 'GENERAL_CONFLICT';
  }
}

interface ConflictDetection {
  hasConflict: boolean;
  conflictType?: 'VERSION_MISMATCH' | 'TIMESTAMP_MISMATCH' | 'FIELD_CONFLICTS';
  localEntity?: any;
  serverEntity?: any;
  fieldConflicts?: FieldConflict[];
  details?: any;
}

interface FieldConflict {
  field: string;
  localValue: any;
  serverValue: any;
  conflictType: FieldConflictType;
}

type FieldConflictType = 'METADATA_CONFLICT' | 'CONTACT_INFO_CONFLICT' | 'FINANCIAL_CONFLICT' | 'GENERAL_CONFLICT';

type ConflictDetectionStrategy = 'VERSION_BASED' | 'TIMESTAMP_BASED' | 'FIELD_BASED' | 'HYBRID';
```

## Conflict Resolution Strategies

### Built-in Resolution Strategies

```typescript
class CascadeConflictResolver {
  resolveConflict(
    detection: ConflictDetection,
    strategy: ConflictResolutionStrategy = 'SERVER_WINS',
    options: ResolutionOptions = {}
  ): ConflictResolution {
    switch (strategy) {
      case 'SERVER_WINS':
        return this.serverWinsResolution(detection);

      case 'CLIENT_WINS':
        return this.clientWinsResolution(detection);

      case 'MERGE':
        return this.mergeResolution(detection, options);

      case 'MANUAL':
        throw new ManualResolutionRequiredError(detection);

      case 'CUSTOM':
        return options.customResolver!(detection);

      default:
        return this.serverWinsResolution(detection);
    }
  }

  private serverWinsResolution(detection: ConflictDetection): ConflictResolution {
    return {
      resolvedEntity: detection.serverEntity,
      strategy: 'SERVER_WINS',
      explanation: 'Server state takes precedence'
    };
  }

  private clientWinsResolution(detection: ConflictDetection): ConflictResolution {
    return {
      resolvedEntity: detection.localEntity,
      strategy: 'CLIENT_WINS',
      explanation: 'Local changes take precedence'
    };
  }

  private mergeResolution(
    detection: ConflictDetection,
    options: ResolutionOptions
  ): ConflictResolution {
    if (detection.fieldConflicts) {
      const merged = { ...detection.serverEntity };

      for (const conflict of detection.fieldConflicts) {
        const resolution = options.fieldResolvers?.[conflict.field] || 'SERVER_WINS';

        switch (resolution) {
          case 'SERVER_WINS':
            merged[conflict.field] = conflict.serverValue;
            break;
          case 'CLIENT_WINS':
            merged[conflict.field] = conflict.localValue;
            break;
          case 'CONCATENATE':
            merged[conflict.field] = this.concatenateValues(conflict.localValue, conflict.serverValue);
            break;
          case 'CUSTOM':
            merged[conflict.field] = options.customFieldResolver!(conflict);
            break;
        }
      }

      return {
        resolvedEntity: merged,
        strategy: 'MERGE',
        explanation: 'Fields merged according to resolution rules',
        fieldResolutions: detection.fieldConflicts.map(c => ({
          field: c.field,
          resolution: options.fieldResolvers?.[c.field] || 'SERVER_WINS'
        }))
      };
    }

    return this.serverWinsResolution(detection);
  }

  private concatenateValues(local: any, server: any): any {
    if (typeof local === 'string' && typeof server === 'string') {
      return `${local} | ${server}`;
    }
    if (Array.isArray(local) && Array.isArray(server)) {
      return [...new Set([...local, ...server])];
    }
    return server; // Fallback
  }
}

interface ConflictResolution {
  resolvedEntity: any;
  strategy: string;
  explanation: string;
  fieldResolutions?: FieldResolution[];
}

interface FieldResolution {
  field: string;
  resolution: string;
}

interface ResolutionOptions {
  fieldResolvers?: Record<string, FieldResolutionStrategy>;
  customResolver?: (detection: ConflictDetection) => ConflictResolution;
  customFieldResolver?: (conflict: FieldConflict) => any;
}

type ConflictResolutionStrategy = 'SERVER_WINS' | 'CLIENT_WINS' | 'MERGE' | 'MANUAL' | 'CUSTOM';

type FieldResolutionStrategy = 'SERVER_WINS' | 'CLIENT_WINS' | 'CONCATENATE' | 'CUSTOM';

class ManualResolutionRequiredError extends Error {
  constructor(public detection: ConflictDetection) {
    super('Manual conflict resolution required');
  }
}
```

### Custom Resolution Logic

```typescript
class CustomConflictResolver extends CascadeConflictResolver {
  resolveBusinessLogicConflict(detection: ConflictDetection): ConflictResolution {
    // Business-specific resolution logic
    if (detection.conflictType === 'VERSION_MISMATCH') {
      // For version conflicts, always prefer server
      return this.serverWinsResolution(detection);
    }

    if (detection.fieldConflicts) {
      // Custom field-by-field resolution
      const resolved: any = { ...detection.serverEntity };

      for (const conflict of detection.fieldConflicts) {
        resolved[conflict.field] = this.resolveFieldConflict(conflict);
      }

      return {
        resolvedEntity: resolved,
        strategy: 'CUSTOM_BUSINESS_LOGIC',
        explanation: 'Resolved using business rules'
      };
    }

    return this.serverWinsResolution(detection);
  }

  private resolveFieldConflict(conflict: FieldConflict): any {
    switch (conflict.field) {
      case 'status':
        // Status conflicts: use priority order
        return this.resolveStatusConflict(conflict);

      case 'assignedTo':
        // Assignment conflicts: keep current assignment
        return conflict.serverValue;

      case 'tags':
        // Tag conflicts: merge arrays
        return this.mergeArrays(conflict.localValue, conflict.serverValue);

      default:
        return conflict.serverValue;
    }
  }

  private resolveStatusConflict(conflict: FieldConflict): string {
    const priority = ['draft', 'review', 'approved', 'published'];
    const localPriority = priority.indexOf(conflict.localValue);
    const serverPriority = priority.indexOf(conflict.serverValue);

    return localPriority > serverPriority ? conflict.localValue : conflict.serverValue;
  }

  private mergeArrays(local: any[], server: any[]): any[] {
    return [...new Set([...local, ...server])];
  }
}
```

## Conflict-Aware Cascade Client

### Implementation

```typescript
class ConflictAwareCascadeClient extends CascadeClient {
  private detector = new CascadeConflictDetector();
  private resolver = new CascadeConflictResolver();

  async mutateWithConflictResolution<T = any>(
    mutation: DocumentNode,
    variables: any,
    options: ConflictResolutionOptions = {}
  ): Promise<T> {
    try {
      const result = await this.mutate<T>(mutation, variables);

      // Check for conflicts with optimistic updates
      if (options.optimisticResult) {
        const conflicts = this.detector.detectConflicts(
          options.optimisticResult,
          result,
          options.detectionStrategy
        );

        if (conflicts.hasConflict) {
          const resolution = this.resolver.resolveConflict(
            conflicts,
            options.resolutionStrategy,
            options.resolutionOptions
          );

          // Apply resolved entity
          if (resolution.resolvedEntity.__typename && resolution.resolvedEntity.id) {
            this.cache.write(
              resolution.resolvedEntity.__typename,
              resolution.resolvedEntity.id,
              resolution.resolvedEntity
            );
          }

          // Notify about conflict resolution
          options.onConflictResolved?.(resolution, conflicts);

          return resolution.resolvedEntity as T;
        }
      }

      return result;

    } catch (error) {
      if (error instanceof ManualResolutionRequiredError) {
        // Handle manual resolution
        const resolution = await this.handleManualResolution(error.detection, options);
        return resolution.resolvedEntity as T;
      }
      throw error;
    }
  }

  private async handleManualResolution(
    detection: ConflictDetection,
    options: ConflictResolutionOptions
  ): Promise<ConflictResolution> {
    if (options.onManualResolution) {
      const strategy = await options.onManualResolution(detection);
      return this.resolver.resolveConflict(detection, strategy, options.resolutionOptions);
    }

    // Default fallback
    return this.resolver.resolveConflict(detection, 'SERVER_WINS');
  }
}

interface ConflictResolutionOptions {
  optimisticResult?: any;
  detectionStrategy?: ConflictDetectionStrategy;
  resolutionStrategy?: ConflictResolutionStrategy;
  resolutionOptions?: ResolutionOptions;
  onConflictResolved?: (resolution: ConflictResolution, conflicts: ConflictDetection) => void;
  onManualResolution?: (detection: ConflictDetection) => Promise<ConflictResolutionStrategy>;
}
```

## Server-Side Conflict Prevention

### Optimistic Locking

Servers can implement optimistic locking to prevent conflicts:

```python
class OptimisticLockingCascadeBuilder:
    def __init__(self, db_connection):
        self.db = db_connection

    def build_with_version_check(self, primary_result, expected_versions):
        # Check versions before proceeding
        for entity_type, entity_id, expected_version in expected_versions:
            current_version = self.db.get_version(entity_type, entity_id)
            if current_version != expected_version:
                raise VersionConflictError(entity_type, entity_id, expected_version, current_version)

        # Proceed with normal cascade building
        return self.build(primary_result)
```

### Conflict-Free Replication

Servers can implement conflict-free replicated data types (CRDTs):

```python
class CRDTSupportedCascadeBuilder:
    def merge_crdt_updates(self, local_updates, remote_updates):
        """Merge updates using CRDT rules."""
        merged = {}

        for key in set([...Object.keys(local_updates), ...Object.keys(remote_updates)]):
            local_value = local_updates[key]
            remote_value = remote_updates[key]

            if local_value && remote_value:
                merged[key] = self.merge_crdt_values(local_value, remote_value)
            else:
                merged[key] = local_value || remote_value
        }

        return merged

    def merge_crdt_values(self, local, remote):
        """Merge two CRDT values."""
        # Implement CRDT merge logic (last-writer-wins, etc.)
        if local.timestamp > remote.timestamp:
            return local
        else:
            return remote
```

## Real-time Conflict Resolution

### Subscription-Based Conflict Notification

```typescript
class RealTimeConflictResolver extends ConflictAwareCascadeClient {
  private subscriptionClient: SubscriptionClient;

  subscribeToConflicts(entityTypes: string[]): void {
    // Subscribe to conflict notifications
    this.subscriptionClient.subscribe(`
      subscription OnEntityConflicts($entityTypes: [String!]) {
        entityConflicts(entityTypes: $entityTypes) {
          entityType
          entityId
          conflictingVersions {
            clientVersion
            serverVersion
            timestamp
          }
        }
      }
    `, { entityTypes }, (data) => {
      this.handleRealTimeConflict(data.entityConflicts);
    });
  }

  private async handleRealTimeConflict(conflicts: any[]): Promise<void> {
    for (const conflict of conflicts) {
      // Notify user of real-time conflict
      const resolution = await this.promptRealTimeResolution(conflict);

      // Apply resolution
      this.applyConflictResolution(resolution);
    }
  }

  private async promptRealTimeResolution(conflict: any): Promise<ConflictResolution> {
    // Show real-time conflict UI
    return new Promise((resolve) => {
      showConflictModal(conflict, (resolution) => {
        resolve(resolution);
      });
    });
  }
}
```

## Performance Considerations

### Efficient Conflict Detection

```typescript
class EfficientConflictDetector extends CascadeConflictDetector {
  private fieldCache = new Map<string, Set<string>>();

  detectFieldConflicts(local: any, server: any): ConflictDetection {
    // Cache field names to avoid repeated reflection
    const entityType = local.__typename || 'Unknown';
    let relevantFields = this.fieldCache.get(entityType);

    if (!relevantFields) {
      relevantFields = this.getRelevantFields(local);
      this.fieldCache.set(entityType, relevantFields);
    }

    // Only check relevant fields
    const conflicts: FieldConflict[] = [];

    for (const field of relevantFields) {
      if (field in local && field in server) {
        if (this.valuesDiffer(local[field], server[field])) {
          conflicts.push({
            field,
            localValue: local[field],
            serverValue: server[field],
            conflictType: this.classifyFieldConflict(field, local[field], server[field])
          });
        }
      }
    }

    return conflicts.length > 0 ? {
      hasConflict: true,
      conflictType: 'FIELD_CONFLICTS',
      localEntity: local,
      serverEntity: server,
      fieldConflicts: conflicts
    } : { hasConflict: false };
  }

  private getRelevantFields(entity: any): Set<string> {
    // Only consider fields that can actually conflict
    const allFields = Object.keys(entity);
    return new Set(allFields.filter(field =>
      !field.startsWith('_') && // Skip private fields
      !field.endsWith('At') &&  // Skip timestamps (handled separately)
      field !== 'version'       // Skip version (handled separately)
    ));
  }
}
```

### Conflict Resolution Batching

```typescript
class BatchingConflictResolver extends CascadeConflictResolver {
  private pendingResolutions: ConflictDetection[] = [];

  resolveConflictsBatch(
    detections: ConflictDetection[],
    strategy: ConflictResolutionStrategy
  ): ConflictResolution[] {
    // Batch resolution for efficiency
    const resolutions: ConflictResolution[] = [];

    for (const detection of detections) {
      const resolution = this.resolveConflict(detection, strategy);
      resolutions.push(resolution);
    }

    return resolutions;
  }

  async resolveConflictsBatchAsync(
    detections: ConflictDetection[],
    strategy: ConflictResolutionStrategy
  ): Promise<ConflictResolution[]> {
    // Parallel resolution for better performance
    const promises = detections.map(detection =>
      Promise.resolve(this.resolveConflict(detection, strategy))
    );

    return Promise.all(promises);
  }
}
```

## Examples

### Complete Conflict Resolution System

```typescript
class CompleteConflictResolutionSystem {
  private detector = new EfficientConflictDetector();
  private resolver = new CustomConflictResolver();
  private cache: CascadeCache;

  async resolveEntityConflicts(
    localEntity: any,
    serverEntity: any,
    options: ConflictResolutionOptions = {}
  ): Promise<any> {
    // 1. Detect conflicts
    const conflicts = this.detector.detectConflicts(
      localEntity,
      serverEntity,
      options.detectionStrategy || 'HYBRID'
    );

    if (!conflicts.hasConflict) {
      return serverEntity; // No conflicts
    }

    // 2. Auto-resolve if possible
    if (options.autoResolveStrategy) {
      const resolution = this.resolver.resolveConflict(
        conflicts,
        options.autoResolveStrategy,
        options.resolutionOptions
      );

      // 3. Update cache with resolved entity
      this.cache.write(
        resolution.resolvedEntity.__typename,
        resolution.resolvedEntity.id,
        resolution.resolvedEntity
      );

      return resolution.resolvedEntity;
    }

    // 4. Manual resolution required
    const resolution = await this.promptManualResolution(conflicts, options);

    // 5. Apply manual resolution
    this.cache.write(
      resolution.resolvedEntity.__typename,
      resolution.resolvedEntity.id,
      resolution.resolvedEntity
    );

    return resolution.resolvedEntity;
  }

  private async promptManualResolution(
    conflicts: ConflictDetection,
    options: ConflictResolutionOptions
  ): Promise<ConflictResolution> {
    return new Promise((resolve) => {
      // Show conflict resolution UI
      const modal = new ConflictResolutionModal({
        conflicts,
        onResolve: (strategy) => {
          const resolution = this.resolver.resolveConflict(conflicts, strategy);
          modal.close();
          resolve(resolution);
        }
      });
      modal.show();
    });
  }
}

// Usage
const conflictSystem = new CompleteConflictResolutionSystem();

const resolvedEntity = await conflictSystem.resolveEntityConflicts(
  optimisticEntity,
  serverEntity,
  {
    detectionStrategy: 'HYBRID',
    autoResolveStrategy: 'MERGE',
    resolutionOptions: {
      fieldResolvers: {
        'status': 'CLIENT_WINS',
        'tags': 'CONCATENATE'
      }
    }
  }
);
```

### React Integration

```tsx
function useConflictResolvingMutation<T = any>(
  mutation: DocumentNode,
  options: ConflictResolutionOptions = {}
) {
  const conflictSystem = useConflictResolutionSystem();
  const cascadeClient = useCascadeClient();

  return useMutation({
    mutationFn: async (variables) => {
      // Execute mutation
      const result = await cascadeClient.mutate<T>(mutation, variables);

      // Check for conflicts if we had optimistic updates
      if (options.optimisticResult) {
        const resolved = await conflictSystem.resolveEntityConflicts(
          options.optimisticResult,
          result,
          options
        );

        return resolved;
      }

      return result;
    },
    onError: (error) => {
      if (error instanceof ManualResolutionRequiredError) {
        // Handle manual resolution in UI
        showConflictResolutionDialog(error.detection);
      }
    }
  });
}

// Usage in component
function TaskItem({ task }: { task: Task }) {
  const [updateTask, { loading }] = useConflictResolvingMutation(UPDATE_TASK, {
    optimisticResult: task,
    detectionStrategy: 'TIMESTAMP_BASED',
    autoResolveStrategy: 'MERGE',
    resolutionOptions: {
      fieldResolvers: {
        'title': 'CLIENT_WINS',
        'description': 'CONCATENATE',
        'status': 'SERVER_WINS'
      }
    }
  });

  const handleUpdate = (updates: Partial<Task>) => {
    updateTask({
      variables: {
        id: task.id,
        input: updates
      }
    });
  };

  return (
    <div>
      <input
        value={task.title}
        onChange={(e) => handleUpdate({ title: e.target.value })}
        disabled={loading}
      />
      <select
        value={task.status}
        onChange={(e) => handleUpdate({ status: e.target.value })}
        disabled={loading}
      >
        <option value="todo">Todo</option>
        <option value="in-progress">In Progress</option>
        <option value="done">Done</option>
      </select>
    </div>
  );
}
```</content>
</xai:function_call">The file has been written successfully.