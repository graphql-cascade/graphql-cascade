import { gql, DocumentNode } from '@apollo/client';
import { CascadeUpdates, UpdatedEntity } from '@graphql-cascade/client';

/**
 * Fragment generation options
 */
export interface FragmentGeneratorOptions {
  /**
   * Maximum depth for nested entity fragments
   * @default 3
   */
  maxDepth?: number;

  /**
   * Fields to always exclude from generated fragments
   */
  excludeFields?: string[];

  /**
   * Fields to always include in generated fragments
   */
  includeFields?: string[];

  /**
   * Custom fragment definitions to use instead of auto-generating
   */
  customFragments?: Map<string, DocumentNode>;

  /**
   * Whether to include __typename in generated fragments
   * @default true
   */
  includeTypename?: boolean;
}

/**
 * Fragment information for a type
 */
export interface FragmentInfo {
  name: string;
  document: DocumentNode;
  fields: string[];
  nestedTypes: string[];
}

// Counter for unique fragment names
let fragmentCounter = 0;

/**
 * Generate a unique fragment name
 */
function getUniqueFragmentName(typename: string, suffix?: string): string {
  const name = suffix
    ? `${typename}_${suffix}_${++fragmentCounter}`
    : `${typename}_CascadeGen_${++fragmentCounter}`;
  return name;
}

/**
 * Fragment generator for cascade entities.
 * Automatically generates GraphQL fragments for cascade updates,
 * including nested entity handling.
 */
export class CascadeFragmentGenerator {
  private fragmentCache = new Map<string, FragmentInfo>();
  private options: Required<FragmentGeneratorOptions>;

  constructor(options: FragmentGeneratorOptions = {}) {
    this.options = {
      maxDepth: options.maxDepth ?? 3,
      excludeFields: options.excludeFields ?? [],
      includeFields: options.includeFields ?? [],
      customFragments: options.customFragments ?? new Map(),
      includeTypename: options.includeTypename ?? true
    };
  }

  /**
   * Generate a fragment for an entity based on its data.
   *
   * @param typename - The GraphQL typename
   * @param entity - The entity data to generate fragment for
   * @param depth - Current depth (for recursion limiting)
   * @returns Fragment document and info
   */
  generateFragment(
    typename: string,
    entity: Record<string, unknown>,
    depth = 0
  ): FragmentInfo {
    // Check custom fragments first
    if (this.options.customFragments.has(typename)) {
      const customDoc = this.options.customFragments.get(typename)!;
      return {
        name: `${typename}_Custom`,
        document: customDoc,
        fields: [],
        nestedTypes: []
      };
    }

    // Check cache for existing fragment with same structure
    const cacheKey = this.getCacheKey(typename, entity);
    if (this.fragmentCache.has(cacheKey)) {
      return this.fragmentCache.get(cacheKey)!;
    }

    const fields: string[] = [];
    const nestedTypes: string[] = [];
    const nestedFragments: string[] = [];

    // Analyze entity fields
    for (const [key, value] of Object.entries(entity)) {
      // Skip excluded fields
      if (this.options.excludeFields.includes(key)) continue;

      // Skip __typename (handled separately)
      if (key === '__typename') continue;

      // Handle nested entities
      if (this.isNestedEntity(value) && depth < this.options.maxDepth) {
        const nestedEntity = value as Record<string, unknown>;
        const nestedTypename = nestedEntity.__typename as string;

        if (nestedTypename) {
          nestedTypes.push(nestedTypename);

          // Generate nested fragment
          const nestedInfo = this.generateFragment(nestedTypename, nestedEntity, depth + 1);
          nestedFragments.push(nestedInfo.name);

          fields.push(`${key} { ...${nestedInfo.name} }`);
        } else {
          // Object without typename - include as inline
          const inlineFields = this.generateInlineFields(nestedEntity, depth + 1);
          fields.push(`${key} { ${inlineFields} }`);
        }
      }
      // Handle arrays of entities
      else if (Array.isArray(value) && value.length > 0 && this.isNestedEntity(value[0])) {
        if (depth < this.options.maxDepth) {
          const firstItem = value[0] as Record<string, unknown>;
          const itemTypename = firstItem.__typename as string;

          if (itemTypename) {
            nestedTypes.push(itemTypename);

            const nestedInfo = this.generateFragment(itemTypename, firstItem, depth + 1);
            nestedFragments.push(nestedInfo.name);

            fields.push(`${key} { ...${nestedInfo.name} }`);
          } else {
            const inlineFields = this.generateInlineFields(firstItem, depth + 1);
            fields.push(`${key} { ${inlineFields} }`);
          }
        }
      }
      // Scalar fields
      else {
        fields.push(key);
      }
    }

    // Add always-included fields
    for (const field of this.options.includeFields) {
      if (!fields.includes(field) && !this.options.excludeFields.includes(field)) {
        fields.push(field);
      }
    }

    // Generate fragment name
    const fragmentName = getUniqueFragmentName(typename);

    // Build fragment body
    const fragmentFields = [
      ...(this.options.includeTypename ? ['__typename'] : []),
      ...fields
    ].join('\n    ');

    // Build the full fragment document with nested fragments
    const nestedDefs = nestedFragments
      .map(name => {
        const info = Array.from(this.fragmentCache.values()).find(f => f.name === name);
        return info ? info.document.loc?.source.body : '';
      })
      .filter(Boolean)
      .join('\n');

    const document = gql`
      fragment ${fragmentName} on ${typename} {
        ${fragmentFields}
      }
      ${nestedDefs}
    `;

    const info: FragmentInfo = {
      name: fragmentName,
      document,
      fields,
      nestedTypes
    };

    // Cache the fragment
    this.fragmentCache.set(cacheKey, info);

    return info;
  }

  /**
   * Generate fragments for all entities in a cascade update.
   *
   * @param cascade - The cascade updates
   * @returns Map of typename to fragment info
   */
  generateFragmentsForCascade(cascade: CascadeUpdates): Map<string, FragmentInfo> {
    const fragments = new Map<string, FragmentInfo>();

    for (const updated of cascade.updated) {
      const { __typename, entity } = updated;

      if (!fragments.has(__typename)) {
        const info = this.generateFragment(__typename, entity);
        fragments.set(__typename, info);
      }
    }

    return fragments;
  }

  /**
   * Generate a combined fragment document for multiple types.
   *
   * @param cascade - The cascade updates
   * @returns A single document with all required fragments
   */
  generateCombinedFragment(cascade: CascadeUpdates): DocumentNode {
    const fragments = this.generateFragmentsForCascade(cascade);
    const fragmentDefs: string[] = [];

    fragments.forEach((info) => {
      const body = info.document.loc?.source.body;
      if (body) {
        fragmentDefs.push(body);
      }
    });

    // Deduplicate fragments (in case of shared nested types)
    const uniqueFragments = [...new Set(fragmentDefs)];

    return gql`${uniqueFragments.join('\n')}`;
  }

  /**
   * Get a cached fragment for a typename.
   *
   * @param typename - The GraphQL typename
   * @returns Cached fragment info or undefined
   */
  getCachedFragment(typename: string): FragmentInfo | undefined {
    for (const [key, info] of this.fragmentCache) {
      if (key.startsWith(`${typename}:`)) {
        return info;
      }
    }
    return undefined;
  }

  /**
   * Clear the fragment cache.
   */
  clearCache(): void {
    this.fragmentCache.clear();
  }

  /**
   * Register a custom fragment for a type.
   *
   * @param typename - The GraphQL typename
   * @param fragment - The fragment document
   */
  registerCustomFragment(typename: string, fragment: DocumentNode): void {
    this.options.customFragments.set(typename, fragment);
  }

  /**
   * Check if a value is a nested entity (object with potential GraphQL fields).
   */
  private isNestedEntity(value: unknown): value is Record<string, unknown> {
    return (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    );
  }

  /**
   * Generate inline field selections for objects without typename.
   */
  private generateInlineFields(obj: Record<string, unknown>, depth: number): string {
    if (depth >= this.options.maxDepth) {
      return 'id';
    }

    const fields: string[] = [];

    for (const [key, value] of Object.entries(obj)) {
      if (this.options.excludeFields.includes(key)) continue;

      if (this.isNestedEntity(value)) {
        const nested = this.generateInlineFields(value, depth + 1);
        fields.push(`${key} { ${nested} }`);
      } else if (Array.isArray(value) && value.length > 0 && this.isNestedEntity(value[0])) {
        const nested = this.generateInlineFields(value[0], depth + 1);
        fields.push(`${key} { ${nested} }`);
      } else {
        fields.push(key);
      }
    }

    return fields.join(' ');
  }

  /**
   * Generate a cache key based on typename and field structure.
   */
  private getCacheKey(typename: string, entity: Record<string, unknown>): string {
    const fieldKeys = Object.keys(entity).sort().join(',');
    return `${typename}:${fieldKeys}`;
  }
}

/**
 * Utility function to extract fields from an entity for fragment generation.
 *
 * @param entity - The entity data
 * @param maxDepth - Maximum depth for nested fields
 * @returns Array of field strings suitable for a GraphQL fragment
 */
export function extractFieldsFromEntity(
  entity: Record<string, unknown>,
  maxDepth = 3
): string[] {
  const generator = new CascadeFragmentGenerator({ maxDepth });
  const typename = (entity.__typename as string) || 'Unknown';
  const info = generator.generateFragment(typename, entity);
  return info.fields;
}

/**
 * Create a simple fragment from an entity.
 *
 * @param typename - The GraphQL typename
 * @param entity - The entity data
 * @returns A GraphQL fragment document
 */
export function createFragmentFromEntity(
  typename: string,
  entity: Record<string, unknown>
): DocumentNode {
  const generator = new CascadeFragmentGenerator();
  const info = generator.generateFragment(typename, entity);
  return info.document;
}
