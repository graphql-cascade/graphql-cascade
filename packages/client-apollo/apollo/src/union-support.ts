import { CascadeUpdates } from "@graphql-cascade/client";

/**
 * Type guard to check if an object has a cascade field
 */
function hasCascadeField(obj: any): obj is { cascade: CascadeUpdates } {
  return obj && typeof obj === "object" && "cascade" in obj;
}

/**
 * Type guard to check if an object is a union type response
 * (has __typename field)
 */
function isUnionType(obj: any): obj is { __typename: string } {
  return obj && typeof obj === "object" && "__typename" in obj;
}

/**
 * Configuration for extracting cascade data from union responses
 */
export interface UnionCascadeConfig {
  /**
   * Union type names that contain cascade data (e.g., "CreateUserSuccess")
   * If not specified, will search all union members
   */
  successTypes?: string[];

  /**
   * Union type names that indicate errors (e.g., "CreateUserError")
   * These will be skipped when extracting cascade data
   */
  errorTypes?: string[];

  /**
   * Field name containing the actual data in success responses
   * Default: inferred from the first non-cascade, non-__typename field
   */
  dataField?: string;

  /**
   * Whether to throw an error if cascade data is not found
   * Default: false (returns null)
   */
  throwOnMissing?: boolean;
}

/**
 * Result of cascade extraction from a union type response
 */
export interface UnionCascadeResult<T = any> {
  /**
   * The cascade data extracted from the response
   */
  cascade: CascadeUpdates | null;

  /**
   * The actual data payload (e.g., the created/updated entity)
   */
  data: T | null;

  /**
   * The __typename of the union member that was matched
   */
  typename: string | null;

  /**
   * Whether this was an error response
   */
  isError: boolean;

  /**
   * Error information if this was an error response
   */
  errors?: Array<{ message: string; code?: string }>;
}

/**
 * Extract cascade data and payload from a GraphQL union type response.
 *
 * Handles responses like:
 * ```graphql
 * mutation CreateUser {
 *   createUser(input: {...}) {
 *     ... on CreateUserSuccess {
 *       user { id name }
 *       cascade { updated deleted invalidations }
 *     }
 *     ... on CreateUserError {
 *       errors { message code }
 *     }
 *   }
 * }
 * ```
 *
 * @param response - The mutation response object
 * @param config - Configuration for extraction behavior
 * @returns Extracted cascade data and payload, or null if not a union type
 *
 * @example
 * ```typescript
 * const result = await client.mutate(CREATE_USER_MUTATION, variables);
 * const mutationName = Object.keys(result.data)[0];
 * const extracted = extractCascadeFromUnion(result.data[mutationName], {
 *   successTypes: ['CreateUserSuccess'],
 *   errorTypes: ['CreateUserError'],
 * });
 *
 * if (extracted.isError) {
 *   console.error('Mutation failed:', extracted.errors);
 * } else {
 *   // Apply cascade updates
 *   if (extracted.cascade) {
 *     cascadeClient.applyCascade({ cascade: extracted.cascade, data: extracted.data });
 *   }
 *   // Use the data
 *   console.log('Created user:', extracted.data);
 * }
 * ```
 */
export function extractCascadeFromUnion<T = any>(
  response: any,
  config: UnionCascadeConfig = {},
): UnionCascadeResult<T> {
  // If response is null/undefined, return empty result
  if (!response) {
    return {
      cascade: null,
      data: null,
      typename: null,
      isError: true,
      errors: [{ message: "Response is null or undefined" }],
    };
  }

  // Check if this is a union type response
  if (!isUnionType(response)) {
    // Not a union type - check if it has cascade data directly
    if (hasCascadeField(response)) {
      // Extract data field (everything except cascade, __typename, and metadata fields like 'success')
      const { cascade, __typename, _success, ...dataFields } = response as any;

      let data: T | null = null;
      if (config.dataField) {
        data = (response as any)[config.dataField];
      } else {
        // Look for a field named 'data' first
        if ('data' in response) {
          data = (response as any).data as T;
        } else {
          // Otherwise, use the first remaining field after filtering out metadata
          const firstDataKey = Object.keys(dataFields)[0];
          data = firstDataKey ? (dataFields as any)[firstDataKey] as T : null;
        }
      }

      return {
        cascade,
        data,
        typename: (__typename as string) || null,
        isError: false,
      };
    }

    // No cascade data found
    if (config.throwOnMissing) {
      throw new Error(
        "Response is not a union type and does not contain cascade data",
      );
    }
    return {
      cascade: null,
      data: response,
      typename: null,
      isError: false,
    };
  }

  const typename = response.__typename;

  // Check if this is an error type
  const isErrorType =
    config.errorTypes?.includes(typename) ||
    typename.toLowerCase().includes("error") ||
    "errors" in response;

  if (isErrorType) {
    return {
      cascade: null,
      data: null,
      typename,
      isError: true,
      errors: (response as any).errors || [{ message: "Unknown error" }],
    };
  }

  // Check if this is a success type (if successTypes specified)
  if (config.successTypes && !config.successTypes.includes(typename)) {
    // Not in the allowed success types list
    return {
      cascade: null,
      data: null,
      typename,
      isError: true,
      errors: [{ message: `Unexpected response type: ${typename}` }],
    };
  }

  // Extract cascade data
  const cascade = hasCascadeField(response) ? response.cascade : null;

  // Extract data payload
  // Look for the first field that's not cascade, __typename, errors, or metadata fields like 'success'
  const dataKeys = Object.keys(response).filter(
    (key) => key !== "cascade" && key !== "__typename" && key !== "errors" && key !== "success",
  );

  let data: T | null = null;
  if (config.dataField) {
    data = (response as any)[config.dataField] || null;
  } else if (dataKeys.length > 0) {
    // Use the first available data field
    data = (response as any)[dataKeys[0]] as T;
  }

  if (!cascade && config.throwOnMissing) {
    throw new Error(`No cascade data found in response type: ${typename}`);
  }

  return {
    cascade,
    data,
    typename,
    isError: false,
  };
}

/**
 * Helper function to extract cascade data from a full mutation result.
 * Automatically extracts the first mutation field and processes it.
 *
 * @param mutationResult - The full mutation result from Apollo Client
 * @param config - Configuration for extraction behavior
 * @returns Extracted cascade data and payload
 *
 * @example
 * ```typescript
 * const result = await client.mutate({ mutation: CREATE_USER, variables });
 * const extracted = extractCascadeFromMutationResult(result.data, {
 *   successTypes: ['CreateUserSuccess'],
 *   errorTypes: ['CreateUserError'],
 * });
 * ```
 */
export function extractCascadeFromMutationResult<T = any>(
  mutationResult: any,
  config: UnionCascadeConfig = {},
): UnionCascadeResult<T> {
  if (!mutationResult || typeof mutationResult !== "object") {
    return {
      cascade: null,
      data: null,
      typename: null,
      isError: true,
      errors: [{ message: "Invalid mutation result" }],
    };
  }

  // Get the first (and typically only) mutation field
  const mutationName = Object.keys(mutationResult)[0];
  if (!mutationName) {
    return {
      cascade: null,
      data: null,
      typename: null,
      isError: true,
      errors: [{ message: "No mutation field found in result" }],
    };
  }

  return extractCascadeFromUnion<T>(mutationResult[mutationName], config);
}

/**
 * Type for mutation responses that use the union pattern
 */
export type UnionMutationResponse<TSuccess, TError = { errors: Array<{ message: string; code?: string }> }> =
  | (TSuccess & { __typename: string })
  | (TError & { __typename: string });

/**
 * Type guard to check if a union response is a success type
 */
export function isSuccessResponse<TSuccess>(
  response: any,
  successTypes: string[],
): response is TSuccess & { __typename: string } {
  return Boolean(
    response &&
    typeof response === "object" &&
    "__typename" in response &&
    successTypes.includes(response.__typename)
  );
}

/**
 * Type guard to check if a union response is an error type
 */
export function isErrorResponse<TError>(
  response: any,
  errorTypes: string[],
): response is TError & { __typename: string } {
  return Boolean(
    response &&
    typeof response === "object" &&
    "__typename" in response &&
    (errorTypes.includes(response.__typename) ||
      response.__typename.toLowerCase().includes("error"))
  );
}
