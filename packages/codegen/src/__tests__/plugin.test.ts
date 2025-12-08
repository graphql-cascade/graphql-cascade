import { buildSchema, parse } from 'graphql';
import { plugin } from '../plugin';
import { Types } from '@graphql-codegen/plugin-helpers';

describe('GraphQL Cascade Codegen Plugin', () => {
  const schema = buildSchema(`
    type Query {
      getTodo(id: ID!): Todo
    }

    type Mutation {
      createTodo(title: String!): CreateTodoResponse!
      updateTodo(id: ID!, title: String!): UpdateTodoResponse
    }

    type Todo {
      id: ID!
      title: String!
      completed: Boolean!
    }

    type CreateTodoResponse {
      success: Boolean!
      data: Todo
      cascade: CascadeUpdates
    }

    union UpdateTodoResponse = UpdateTodoSuccess | UpdateTodoError

    type UpdateTodoSuccess {
      data: Todo
      cascade: CascadeUpdates
    }

    type UpdateTodoError {
      errors: [String!]!
    }

    type CascadeUpdates {
      updated: [UpdatedEntity!]!
      deleted: [DeletedEntity!]!
      invalidations: [QueryInvalidation!]!
    }

    type UpdatedEntity {
      __typename: String!
      id: ID!
      operation: String!
      entity: String
      timestamp: String!
    }

    type DeletedEntity {
      __typename: String!
      id: ID!
      timestamp: String!
    }

    type QueryInvalidation {
      query: String!
      strategy: String!
      scope: String!
    }
  `);

  const createMutationDoc: Types.DocumentFile = {
    location: 'test.graphql',
    document: parse(`
      mutation CreateTodo($title: String!) {
        createTodo(title: $title) {
          success
          data {
            id
            title
            completed
          }
          cascade {
            updated {
              __typename
              id
              operation
            }
          }
        }
      }
    `),
  };

  const updateMutationDoc: Types.DocumentFile = {
    location: 'test.graphql',
    document: parse(`
      mutation UpdateTodo($id: ID!, $title: String!) {
        updateTodo(id: $id, title: $title) {
          __typename
          ... on UpdateTodoSuccess {
            data {
              id
              title
            }
            cascade {
              updated {
                __typename
                id
              }
            }
          }
          ... on UpdateTodoError {
            errors
          }
        }
      }
    `),
  };

  describe('Basic Type Generation', () => {
    it('should generate helper types', () => {
      const result = plugin(schema, [createMutationDoc], {}) as { prepend?: string[]; content: string };

      expect(result.content).toContain('CascadeOf<T>');
      expect(result.content).toContain('DataOf<T>');
      expect(result.content).toContain('UpdatedEntitiesOf<T>');
      expect(result.content).toContain('DeletedEntitiesOf<T>');
      expect(result.content).toContain('InvalidationsOf<T>');
    });

    it('should include cascade imports', () => {
      const result = plugin(schema, [createMutationDoc], {}) as { prepend?: string[]; content: string };

      const imports = result.prepend?.join('\n') || '';
      expect(imports).toContain('CascadeResponse');
      expect(imports).toContain('CascadeUpdates');
      expect(imports).toContain('UpdatedEntity');
      expect(imports).toContain('DeletedEntity');
      expect(imports).toContain('QueryInvalidation');
    });

    it('should use custom import path when configured', () => {
      const result = plugin(schema, [createMutationDoc], {
        cascadeImportFrom: '@my-custom/cascade',
      }) as { prepend?: string[]; content: string };

      const imports = result.prepend?.join('\n') || '';
      expect(imports).toContain('@my-custom/cascade');
    });
  });

  describe('Union Type Guards', () => {
    it('should generate type guards for union types', () => {
      const result = plugin(schema, [updateMutationDoc], {
        generateTypeGuards: true,
      }) as { prepend?: string[]; content: string };

      expect(result.content).toContain('isUpdateTodoSuccess');
      expect(result.content).toContain('isUpdateTodoError');
      expect(result.content).toContain('__typename');
    });

    it('should not generate type guards when disabled', () => {
      const result = plugin(schema, [updateMutationDoc], {
        generateTypeGuards: false,
      }) as { prepend?: string[]; content: string };

      expect(result.content).not.toContain('isUpdateTodoSuccess');
      expect(result.content).not.toContain('isUpdateTodoError');
    });
  });

  describe('Union Cascade Config', () => {
    it('should generate UnionCascadeConfig for union types with cascade', () => {
      const result = plugin(schema, [updateMutationDoc], {
        generateUnionHelpers: true,
      }) as { prepend?: string[]; content: string };

      expect(result.content).toContain('UpdateTodoCascadeConfig');
      expect(result.content).toContain('successTypes');
      expect(result.content).toContain('errorTypes');
      expect(result.content).toContain('UpdateTodoSuccess');
      expect(result.content).toContain('UpdateTodoError');
    });

    it('should not generate UnionCascadeConfig when disabled', () => {
      const result = plugin(schema, [updateMutationDoc], {
        generateUnionHelpers: false,
      }) as { prepend?: string[]; content: string };

      expect(result.content).not.toContain('UpdateTodoCascadeConfig');
    });
  });

  describe('Multiple Operations', () => {
    it('should handle multiple mutations', () => {
      const result = plugin(schema, [createMutationDoc, updateMutationDoc], {
        generateTypeGuards: true,
        generateUnionHelpers: true,
      }) as { prepend?: string[]; content: string };

      // Should contain helpers
      expect(result.content).toContain('CascadeOf<T>');

      // Should contain type guards for union operation
      expect(result.content).toContain('isUpdateTodoSuccess');

      // Should contain config for union operation
      expect(result.content).toContain('UpdateTodoCascadeConfig');
    });
  });

  describe('Edge Cases', () => {
    it('should handle operations without cascade field', () => {
      const queryDoc: Types.DocumentFile = {
        location: 'test.graphql',
        document: parse(`
          query GetTodo($id: ID!) {
            getTodo(id: $id) {
              id
              title
            }
          }
        `),
      };

      const result = plugin(schema, [queryDoc], {}) as { prepend?: string[]; content: string };

      // Should still generate helper types
      expect(result.content).toContain('CascadeOf<T>');
      // But no type guards or configs for non-mutation
      expect(result.content).not.toContain('GetTodoCascadeConfig');
    });

    it('should handle empty documents array', () => {
      const result = plugin(schema, [], {}) as { prepend?: string[]; content: string };

      // Should still generate helper types
      expect(result.content).toContain('CascadeOf<T>');
    });
  });
});
