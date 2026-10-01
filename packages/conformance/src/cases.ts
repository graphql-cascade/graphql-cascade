/**
 * The conformance cases of conformance-tests/, as test-case-schema.json
 * defines them.
 */

export type ConformanceLevel = "basic" | "standard" | "complete";

interface CaseHeader {
  id: string;
  name: string;
  description: string;
  requirement: string;
  level: ConformanceLevel;
  subcategory?: string;
  priority?: "critical" | "high" | "medium" | "low";
  tags?: string[];
}

/** Fields an entry must match; `entity` matches the entity fields it gives. */
export interface EntryPattern {
  typename: string;
  id?: string;
  operation?: "CREATED" | "UPDATED" | "DELETED";
  entity?: Record<string, unknown>;
}

export interface CascadeExpectation {
  updated?: EntryPattern[];
  deleted?: EntryPattern[];
  absent?: EntryPattern[];
  invalidations?: Record<string, unknown>[];
  typeInvalidations?: { typename: string; affectedCount?: number }[];
  noChanges?: true;
  metadata?: Record<string, unknown>;
}

export interface FieldExpectation {
  typename?: string;
  success?: boolean;
  errors?: { code: string }[];
  cascade?: CascadeExpectation;
}

export interface ServerState {
  users?: {
    id: string;
    name: string;
    email: string;
    managerId?: string | null;
  }[];
  posts?: { id: string; title: string; published: boolean; authorId: string }[];
}

export interface CascadeLimits {
  maxUpdatedEntities?: number;
  maxDeletedEntities?: number;
}

export interface ServerCase extends CaseHeader {
  category: "server" | "transport";
  requires?: "extensions"[];
  input: {
    state: ServerState;
    limits?: CascadeLimits;
    operation: string;
    variables?: Record<string, unknown>;
  };
  expected: {
    fields?: Record<string, FieldExpectation>;
    extensions?: { cascade: CascadeExpectation };
  };
}

export interface CachedQuery {
  /** The query's root field */
  name: string;
  arguments?: Record<string, unknown>;
  /** The root field's cached value */
  result: unknown;
}

export interface ClientState {
  entities?: Record<string, unknown>[];
  queries?: CachedQuery[];
}

export type QueryState = "fresh" | "invalidated";

export interface ClientCase extends CaseHeader {
  category: "client";
  cache?: "normalized" | "document";
  input: {
    state: ClientState;
    /** A mutation field's result: CascadeResponse, CascadePayload or CascadeFailure */
    result: Record<string, unknown>;
  };
  expected: {
    entities?: Record<string, Record<string, unknown> | null>;
    queries?: {
      name: string;
      arguments?: Record<string, unknown>;
      state: QueryState;
      result?: unknown;
    }[];
  };
}

export type ConformanceCase = ServerCase | ClientCase;
