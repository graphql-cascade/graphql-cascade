import { buildSchema } from 'graphql';
import { validateSchema } from './schema';

describe('validateSchema', () => {
  const BASIC_SCHEMA = `
    interface Node {
      id: ID!
    }

    enum CascadeOperation {
      CREATED
      UPDATED
      DELETED
    }

    enum InvalidationStrategy {
      INVALIDATE
      REFETCH
      REMOVE
    }

    enum InvalidationScope {
      EXACT
      PREFIX
      PATTERN
      ALL
    }

    type UpdatedEntity {
      __typename: String!
      id: ID!
      operation: CascadeOperation!
      entity: Node
    }

    type DeletedEntity {
      __typename: String!
      id: ID!
      deletedAt: String!
    }

    type QueryInvalidation {
      queryName: String!
      strategy: InvalidationStrategy!
      scope: InvalidationScope!
    }

    type CascadeMetadata {
      timestamp: String!
      depth: Int!
      affectedCount: Int!
    }

    type CascadeUpdates {
      updated: [UpdatedEntity!]!
      deleted: [DeletedEntity!]!
      invalidations: [QueryInvalidation!]!
      metadata: CascadeMetadata!
    }

    type Query {
      placeholder: String
    }
  `;

  it('schema with all required types passes Basic', () => {
    const schema = buildSchema(BASIC_SCHEMA);
    const result = validateSchema(schema);
    expect(result.valid).toBe(true);
    expect(result.level).toBe('standard'); // Has depth in metadata
    expect(result.errors).toHaveLength(0);
  });

  it('schema missing Node interface fails', () => {
    const schema = buildSchema(`
      type Query { placeholder: String }
    `);
    const result = validateSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'MISSING_NODE',
        message: 'Schema must have Node interface',
      })
    );
  });

  it('schema missing CascadeUpdates fails', () => {
    const schema = buildSchema(`
      interface Node { id: ID! }
      type Query { placeholder: String }
    `);
    const result = validateSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'MISSING_TYPE',
        message: 'Schema must have CascadeUpdates type',
      })
    );
  });

  it('schema missing CascadeOperation enum fails', () => {
    const schema = buildSchema(`
      interface Node { id: ID! }
      type Query { placeholder: String }
    `);
    const result = validateSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'MISSING_ENUM',
        message: 'Schema must have CascadeOperation enum',
      })
    );
  });

  it('empty schema returns level none', () => {
    const schema = buildSchema(`
      type Query { placeholder: String }
    `);
    const result = validateSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.level).toBe('none');
  });

  it('partial schema returns level none with errors', () => {
    const schema = buildSchema(`
      interface Node { id: ID! }
      enum CascadeOperation { CREATED UPDATED DELETED }
      type Query { placeholder: String }
    `);
    const result = validateSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.level).toBe('none');
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('validates CascadeOperation enum values', () => {
    const schema = buildSchema(`
      interface Node { id: ID! }
      enum CascadeOperation { ONLY_ONE }
      type Query { placeholder: String }
    `);
    const result = validateSchema(schema);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'MISSING_ENUM_VALUE',
        path: 'CascadeOperation.CREATED',
      })
    );
  });
});
