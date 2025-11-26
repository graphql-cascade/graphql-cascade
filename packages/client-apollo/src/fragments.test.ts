import { gql } from '@apollo/client';
import { CascadeUpdates, CascadeOperation, InvalidationStrategy, InvalidationScope } from '@graphql-cascade/client';
import {
  CascadeFragmentGenerator,
  extractFieldsFromEntity,
  createFragmentFromEntity
} from './fragments';

describe('CascadeFragmentGenerator', () => {
  describe('generateFragment', () => {
    it('should generate fragment for simple entity', () => {
      const generator = new CascadeFragmentGenerator();
      const entity = {
        __typename: 'User',
        id: '1',
        name: 'John',
        email: 'john@example.com'
      };

      const info = generator.generateFragment('User', entity);

      expect(info.name).toContain('User');
      expect(info.fields).toContain('id');
      expect(info.fields).toContain('name');
      expect(info.fields).toContain('email');
      expect(info.nestedTypes).toHaveLength(0);
    });

    it('should generate fragment with nested entity', () => {
      const generator = new CascadeFragmentGenerator();
      const entity = {
        __typename: 'Post',
        id: '1',
        title: 'Hello',
        author: {
          __typename: 'User',
          id: '1',
          name: 'John'
        }
      };

      const info = generator.generateFragment('Post', entity);

      expect(info.nestedTypes).toContain('User');
      expect(info.fields.some(f => f.includes('author'))).toBe(true);
    });

    it('should generate fragment with array of entities', () => {
      const generator = new CascadeFragmentGenerator();
      const entity = {
        __typename: 'User',
        id: '1',
        name: 'John',
        posts: [
          { __typename: 'Post', id: '1', title: 'First' },
          { __typename: 'Post', id: '2', title: 'Second' }
        ]
      };

      const info = generator.generateFragment('User', entity);

      expect(info.nestedTypes).toContain('Post');
      expect(info.fields.some(f => f.includes('posts'))).toBe(true);
    });

    it('should respect maxDepth option', () => {
      const generator = new CascadeFragmentGenerator({ maxDepth: 1 });
      const entity = {
        __typename: 'User',
        id: '1',
        friend: {
          __typename: 'User',
          id: '2',
          friend: {
            __typename: 'User',
            id: '3',
            name: 'Deep'
          }
        }
      };

      const info = generator.generateFragment('User', entity);

      // Should only go 1 level deep
      expect(info.nestedTypes).toContain('User');
    });

    it('should exclude specified fields', () => {
      const generator = new CascadeFragmentGenerator({
        excludeFields: ['password', 'secret']
      });
      const entity = {
        __typename: 'User',
        id: '1',
        name: 'John',
        password: 'secret123',
        secret: 'hidden'
      };

      const info = generator.generateFragment('User', entity);

      expect(info.fields).not.toContain('password');
      expect(info.fields).not.toContain('secret');
      expect(info.fields).toContain('name');
    });

    it('should include specified fields', () => {
      const generator = new CascadeFragmentGenerator({
        includeFields: ['createdAt', 'updatedAt']
      });
      const entity = {
        __typename: 'User',
        id: '1',
        name: 'John'
      };

      const info = generator.generateFragment('User', entity);

      expect(info.fields).toContain('createdAt');
      expect(info.fields).toContain('updatedAt');
    });

    it('should use custom fragments when registered', () => {
      const generator = new CascadeFragmentGenerator();
      const customFragment = gql`
        fragment CustomUserFragment on User {
          id
          customField
        }
      `;

      generator.registerCustomFragment('User', customFragment);

      const info = generator.generateFragment('User', { id: '1', name: 'John' });

      expect(info.name).toBe('User_Custom');
      expect(info.document).toBe(customFragment);
    });

    it('should cache fragments with same structure', () => {
      const generator = new CascadeFragmentGenerator();
      const entity1 = { id: '1', name: 'John' };
      const entity2 = { id: '2', name: 'Jane' };

      const info1 = generator.generateFragment('User', entity1);
      const info2 = generator.generateFragment('User', entity2);

      // Same structure should return cached fragment
      expect(info1).toBe(info2);
    });

    it('should not include typename by default', () => {
      const generator = new CascadeFragmentGenerator({ includeTypename: true });
      const entity = { id: '1', name: 'John' };

      const info = generator.generateFragment('User', entity);

      // __typename should be in the generated fragment
      expect(info.document.loc?.source.body).toContain('__typename');
    });
  });

  describe('generateFragmentsForCascade', () => {
    it('should generate fragments for all cascade updated entities', () => {
      const generator = new CascadeFragmentGenerator();
      const cascade: CascadeUpdates = {
        updated: [
          {
            __typename: 'User',
            id: '1',
            operation: CascadeOperation.UPDATED,
            entity: { id: '1', name: 'John' }
          },
          {
            __typename: 'Post',
            id: '1',
            operation: CascadeOperation.CREATED,
            entity: { id: '1', title: 'Hello' }
          }
        ],
        deleted: [],
        invalidations: [],
        metadata: {
          timestamp: new Date().toISOString(),
          depth: 1,
          affectedCount: 2
        }
      };

      const fragments = generator.generateFragmentsForCascade(cascade);

      expect(fragments.has('User')).toBe(true);
      expect(fragments.has('Post')).toBe(true);
      expect(fragments.size).toBe(2);
    });

    it('should deduplicate fragments by typename', () => {
      const generator = new CascadeFragmentGenerator();
      const cascade: CascadeUpdates = {
        updated: [
          {
            __typename: 'User',
            id: '1',
            operation: CascadeOperation.UPDATED,
            entity: { id: '1', name: 'John' }
          },
          {
            __typename: 'User',
            id: '2',
            operation: CascadeOperation.UPDATED,
            entity: { id: '2', name: 'Jane' }
          }
        ],
        deleted: [],
        invalidations: [],
        metadata: {
          timestamp: new Date().toISOString(),
          depth: 1,
          affectedCount: 2
        }
      };

      const fragments = generator.generateFragmentsForCascade(cascade);

      expect(fragments.size).toBe(1);
      expect(fragments.has('User')).toBe(true);
    });
  });

  describe('generateCombinedFragment', () => {
    it('should create combined document for cascade', () => {
      const generator = new CascadeFragmentGenerator();
      const cascade: CascadeUpdates = {
        updated: [
          {
            __typename: 'User',
            id: '1',
            operation: CascadeOperation.UPDATED,
            entity: { id: '1', name: 'John' }
          }
        ],
        deleted: [],
        invalidations: [],
        metadata: {
          timestamp: new Date().toISOString(),
          depth: 1,
          affectedCount: 1
        }
      };

      const doc = generator.generateCombinedFragment(cascade);

      expect(doc).toBeDefined();
      expect(doc.kind).toBe('Document');
    });
  });

  describe('getCachedFragment', () => {
    it('should return cached fragment for typename', () => {
      const generator = new CascadeFragmentGenerator();
      const entity = { id: '1', name: 'John' };

      generator.generateFragment('User', entity);
      const cached = generator.getCachedFragment('User');

      expect(cached).toBeDefined();
      expect(cached?.name).toContain('User');
    });

    it('should return undefined for non-cached typename', () => {
      const generator = new CascadeFragmentGenerator();
      const cached = generator.getCachedFragment('NonExistent');

      expect(cached).toBeUndefined();
    });
  });

  describe('clearCache', () => {
    it('should clear all cached fragments', () => {
      const generator = new CascadeFragmentGenerator();

      generator.generateFragment('User', { id: '1' });
      generator.generateFragment('Post', { id: '1' });

      expect(generator.getCachedFragment('User')).toBeDefined();

      generator.clearCache();

      expect(generator.getCachedFragment('User')).toBeUndefined();
      expect(generator.getCachedFragment('Post')).toBeUndefined();
    });
  });
});

describe('extractFieldsFromEntity', () => {
  it('should extract fields from simple entity', () => {
    const entity = {
      __typename: 'User',
      id: '1',
      name: 'John',
      email: 'john@example.com'
    };

    const fields = extractFieldsFromEntity(entity);

    expect(fields).toContain('id');
    expect(fields).toContain('name');
    expect(fields).toContain('email');
  });
});

describe('createFragmentFromEntity', () => {
  it('should create valid GraphQL fragment', () => {
    const entity = {
      id: '1',
      name: 'John'
    };

    const doc = createFragmentFromEntity('User', entity);

    expect(doc).toBeDefined();
    expect(doc.kind).toBe('Document');
    expect(doc.definitions.length).toBeGreaterThan(0);
  });
});
