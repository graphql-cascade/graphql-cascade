import { DocumentNode } from "graphql";
import { CascadeClient, cascadeEntryTypename } from "./client";
import { CascadeResponse, ConflictDetection } from "./types";

/**
 * Optimistic update manager for GraphQL Cascade.
 */
export class OptimisticCascadeClient extends CascadeClient {
  private optimisticUpdates = new Map<string, OptimisticUpdate>();

  /**
   * Execute a mutation with optimistic update.
   */
  async mutateOptimistic<T = any>(
    mutation: DocumentNode,
    variables: any,
    optimisticResponse: CascadeResponse<T>,
  ): Promise<T> {
    const mutationId = this.generateMutationId();
    this.applyOptimistic(mutationId, optimisticResponse);

    let outcome: Awaited<ReturnType<CascadeClient["runMutation"]>>;
    try {
      outcome = await this.runMutation<T>(mutation, variables);
    } catch (error) {
      this.rollbackOptimistic(mutationId);
      throw error;
    }

    // A failed payload commits nothing, so the optimistic changes go; on
    // success the server's cascade has replaced them.
    if (outcome.response?.success === false) {
      this.rollbackOptimistic(mutationId);
    } else {
      this.confirmOptimistic(mutationId);
    }
    return (
      outcome.response ? outcome.response.data : outcome.fieldResult
    ) as T;
  }

  private applyOptimistic(mutationId: string, response: CascadeResponse): void {
    // Store rollback information
    const rollback = this.captureRollbackInfo(response);
    this.optimisticUpdates.set(mutationId, { response, rollback });

    // Apply optimistic cascade
    this.applyCascade(response);
  }

  private confirmOptimistic(mutationId: string): void {
    // Remove rollback info (real data already applied)
    this.optimisticUpdates.delete(mutationId);
  }

  private rollbackOptimistic(mutationId: string): void {
    const optimistic = this.optimisticUpdates.get(mutationId);
    if (!optimistic) return;

    // Revert optimistic changes
    optimistic.rollback();

    this.optimisticUpdates.delete(mutationId);
  }

  private captureRollbackInfo(response: CascadeResponse): () => void {
    // The state before the optimistic cascade of every entity it touches
    const previous = [
      ...response.cascade.updated,
      ...response.cascade.deleted,
    ].map((entry) => {
      const typename = cascadeEntryTypename(entry);
      return {
        typename,
        id: entry.id,
        data: this.cache.read(typename, entry.id),
      };
    });

    return () => {
      for (const { typename, id, data } of previous) {
        if (data === null) {
          this.cache.evict(typename, id);
        } else {
          this.cache.write(typename, id, data);
        }
      }
    };
  }

  private generateMutationId(): string {
    return `optimistic_${Date.now()}_${Math.random()}`;
  }
}

/**
 * Conflict resolution for GraphQL Cascade.
 */
export class CascadeConflictResolver {
  /**
   * Detect conflicts between local and server versions.
   */
  detectConflicts(localEntity: any, serverEntity: any): ConflictDetection {
    // Version-based conflict detection
    if (localEntity.version && serverEntity.version) {
      if (localEntity.version !== serverEntity.version) {
        return {
          hasConflict: true,
          conflictType: "VERSION_MISMATCH",
          localEntity,
          serverEntity,
        };
      }
    }

    // Timestamp-based conflict detection
    if (localEntity.updatedAt && serverEntity.updatedAt) {
      const localTime = new Date(localEntity.updatedAt).getTime();
      const serverTime = new Date(serverEntity.updatedAt).getTime();

      if (localTime > serverTime) {
        return {
          hasConflict: true,
          conflictType: "TIMESTAMP_MISMATCH",
          localEntity,
          serverEntity,
        };
      }
    }

    // Field-level conflict detection
    const conflictingFields: string[] = [];
    for (const key in localEntity) {
      if (key in serverEntity && localEntity[key] !== serverEntity[key]) {
        // Skip metadata fields
        if (!["updatedAt", "version", "__typename", "id"].includes(key)) {
          conflictingFields.push(key);
        }
      }
    }

    if (conflictingFields.length > 0) {
      return {
        hasConflict: true,
        conflictType: "FIELD_CONFLICT",
        localEntity,
        serverEntity,
        conflictingFields,
      };
    }

    return { hasConflict: false };
  }

  /**
   * Resolve conflicts with different strategies.
   */
  resolveConflicts(
    conflict: ConflictDetection,
    strategy:
      | "SERVER_WINS"
      | "CLIENT_WINS"
      | "MERGE"
      | "MANUAL" = "SERVER_WINS",
  ): any {
    if (!conflict.hasConflict) {
      return conflict.serverEntity;
    }

    switch (strategy) {
      case "SERVER_WINS":
        return conflict.serverEntity;

      case "CLIENT_WINS":
        return conflict.localEntity;

      case "MERGE":
        return this.mergeEntities(conflict.localEntity, conflict.serverEntity);

      case "MANUAL":
        throw new Error("Manual conflict resolution required");

      default:
        return conflict.serverEntity;
    }
  }

  private mergeEntities(local: any, server: any): any {
    const merged = { ...server };

    // For simple cases, prefer non-null values
    for (const key in local) {
      if (merged[key] == null && local[key] != null) {
        merged[key] = local[key];
      }
    }

    return merged;
  }
}

interface OptimisticUpdate {
  response: CascadeResponse;
  rollback: () => void;
}
