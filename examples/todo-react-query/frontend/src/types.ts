/**
 * Shared TypeScript types for the Todo application
 */

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTodoInput {
  title: string;
  completed?: boolean;
}

export interface UpdateTodoInput {
  title?: string;
  completed?: boolean;
}

export interface MutationResponse<T> {
  success: boolean;
  errors?: Array<{
    message: string;
    code: string;
  }>;
  data: T;
}

/**
 * Cascade metadata types
 * These mirror the GraphQL Cascade specification
 */

export interface CascadeData {
  updated?: UpdatedEntity[];
  deleted?: DeletedEntity[];
  invalidations?: QueryInvalidation[];
  metadata?: CascadeMetadata;
}

export interface UpdatedEntity {
  __typename: string;
  id: string;
  operation: 'CREATE' | 'UPDATE';
  entity: any;
}

export interface DeletedEntity {
  __typename: string;
  id: string;
  deletedAt: string;
}

export interface QueryInvalidation {
  queryName: string;
  strategy: 'INVALIDATE' | 'REFETCH' | 'REMOVE';
  scope: 'EXACT' | 'PREFIX' | 'PATTERN' | 'ALL';
  arguments?: Record<string, any>;
  queryPattern?: string;
}

export interface CascadeMetadata {
  timestamp: string;
  affectedCount: number;
  version?: string;
}
