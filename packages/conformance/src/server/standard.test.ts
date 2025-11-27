import { runStandardTests } from './standard';
import { ServerConformanceOptions } from '../types';

// Create a mock server that matches the implementation expectations
function createMockServer() {
  let transactionCounter = 0;

  return {
    async execute(mutation: string, variables: any, options: any = {}) {
      const { depth = 1, maxDepth = 5 } = options;
      const transactionId = `txn-${++transactionCounter}`;

      // Mock responses based on mutation type
      if (mutation === 'createUser') {
        return {
          success: true,
          data: { id: '1', name: variables.name, email: variables.email },
          cascade: {
            updated: [{ __typename: 'User', id: '1', operation: 'CREATED' }],
            deleted: [],
            invalidations: [],
            metadata: {
              timestamp: new Date().toISOString(),
              depth: 1,
              affectedCount: 1,
              transactionId
            }
          }
        };
      }

      if (mutation === 'createUserWithPosts') {
        const effectiveDepth = Math.min(depth, maxDepth);
        const updated = [{ __typename: 'User', id: '1', operation: 'CREATED' }];

        if (effectiveDepth >= 2) {
          variables.posts.forEach((_: any, index: number) => {
            updated.push({ __typename: 'Post', id: `${index + 1}`, operation: 'CREATED' });
          });
        }

        return {
          success: true,
          data: {
            id: '1',
            name: variables.name,
            email: variables.email,
            posts: effectiveDepth >= 2 ? variables.posts.map((p: any, i: number) => ({ id: `${i + 1}`, title: p.title })) : []
          },
          cascade: {
            updated,
            deleted: [],
            invalidations: [],
            metadata: {
              timestamp: new Date().toISOString(),
              depth: effectiveDepth,
              affectedCount: updated.length,
              transactionId
            }
          }
        };
      }

      if (mutation === 'createUserWithProfile') {
        const effectiveDepth = Math.min(depth, maxDepth);
        const updated = [{ __typename: 'User', id: '1', operation: 'CREATED' }];

        if (effectiveDepth >= 2) {
          updated.push({ __typename: 'Profile', id: '1', operation: 'CREATED' });
        }

        return {
          success: true,
          data: {
            id: '1',
            name: variables.name,
            email: variables.email,
            profile: effectiveDepth >= 2 ? { id: '1', bio: variables.profile.bio } : undefined
          },
          cascade: {
            updated,
            deleted: [],
            invalidations: [],
            metadata: {
              timestamp: new Date().toISOString(),
              depth: effectiveDepth,
              affectedCount: updated.length,
              transactionId
            }
          }
        };
      }

      if (mutation === 'createUserWithGroups') {
        const effectiveDepth = Math.min(depth, maxDepth);
        const updated = [{ __typename: 'User', id: '1', operation: 'CREATED' }];

        if (effectiveDepth >= 2) {
          variables.groups.forEach((_: any, index: number) => {
            updated.push({ __typename: 'Group', id: `${index + 1}`, operation: 'CREATED' });
          });
        }

        if (effectiveDepth >= 3) {
          variables.groups.forEach((_: any, index: number) => {
            updated.push({ __typename: 'UserGroup', id: `${index + 1}`, operation: 'CREATED' });
          });
        }

        return {
          success: true,
          data: {
            id: '1',
            name: variables.name,
            email: variables.email,
            groups: effectiveDepth >= 2 ? variables.groups.map((g: any, i: number) => ({ id: `${i + 1}`, name: g.name })) : []
          },
          cascade: {
            updated,
            deleted: [],
            invalidations: [],
            metadata: {
              timestamp: new Date().toISOString(),
              depth: effectiveDepth,
              affectedCount: updated.length,
              transactionId
            }
          }
        };
      }

      if (mutation === 'createUsersWithFriends') {
        const updated = [
          { __typename: 'User', id: '1', operation: 'CREATED' },
          { __typename: 'User', id: '2', operation: 'CREATED' }
        ];

        return {
          success: true,
          data: variables.users,
          cascade: {
            updated,
            deleted: [],
            invalidations: [],
            metadata: {
              timestamp: new Date().toISOString(),
              depth: 2,
              affectedCount: 2,
              transactionId
            }
          }
        };
      }

      if (mutation === 'createCategoryTree') {
        const updated = [
          { __typename: 'Category', id: '1', operation: 'CREATED' },
          { __typename: 'Category', id: '2', operation: 'CREATED' }
        ];

        return {
          success: true,
          data: variables.categories,
          cascade: {
            updated,
            deleted: [],
            invalidations: [],
            metadata: {
              timestamp: new Date().toISOString(),
              depth: 2,
              affectedCount: 2,
              transactionId
            }
          }
        };
      }

      if (mutation === 'createPostWithComments') {
        const effectiveDepth = Math.min(depth, maxDepth);
        const updated = [];

        if (effectiveDepth >= 1) {
          updated.push({ __typename: 'Post', id: '1', operation: 'CREATED' });
        }

        if (effectiveDepth >= 2) {
          updated.push({ __typename: 'User', id: '1', operation: 'CREATED' }); // Author
        }

        if (effectiveDepth >= 3) {
          updated.push({ __typename: 'Comment', id: '1', operation: 'CREATED' });
          updated.push({ __typename: 'Comment', id: '2', operation: 'CREATED' });
          updated.push({ __typename: 'User', id: '2', operation: 'CREATED' }); // Commenter 1
          updated.push({ __typename: 'User', id: '3', operation: 'CREATED' }); // Commenter 2
        }

        // Check for partial success (invalid comment)
        const hasInvalidComment = variables.comments.some((c: any) => !c.text || !c.author.name);
        const success = !hasInvalidComment;

        if (hasInvalidComment) {
          // Remove invalid comment from updates
          updated.splice(updated.findIndex((u: any) => u.__typename === 'Comment' && u.id === '2'), 1);
          updated.splice(updated.findIndex((u: any) => u.__typename === 'User' && u.id === '3'), 1);
        }

        return {
          success,
          data: success ? {
            id: '1',
            title: variables.title,
            author: { id: '1', name: variables.author.name },
            comments: hasInvalidComment ? [variables.comments[0]] : variables.comments
          } : null,
          cascade: {
            updated,
            deleted: [],
            invalidations: [],
            metadata: {
              timestamp: new Date().toISOString(),
              depth: effectiveDepth,
              affectedCount: updated.length,
              transactionId,
              partialSuccess: hasInvalidComment,
              warnings: hasInvalidComment ? ['Some comments could not be created'] : undefined
            }
          }
        };
      }

      if (mutation === 'updatePostWithComments') {
        const updated = [
          { __typename: 'Post', id: variables.id, operation: 'UPDATED' },
          { __typename: 'Comment', id: 'comment-1', operation: 'UPDATED' },
          { __typename: 'Comment', id: 'comment-2', operation: 'UPDATED' }
        ];

        return {
          success: true,
          data: variables,
          cascade: {
            updated,
            deleted: [],
            invalidations: [],
            metadata: {
              timestamp: new Date().toISOString(),
              depth: 2,
              affectedCount: 3,
              transactionId
            }
          }
        };
      }

      if (mutation === 'createDeepNested') {
        const effectiveDepth = Math.min(depth, maxDepth);
        const updated = [{ __typename: 'User', id: '1', operation: 'CREATED' }];

        if (effectiveDepth >= 2) {
          updated.push({ __typename: 'Post', id: '1', operation: 'CREATED' });
        }

        if (effectiveDepth >= 3) {
          updated.push({ __typename: 'Comment', id: '1', operation: 'CREATED' });
        }

        return {
          success: true,
          data: variables.user,
          cascade: {
            updated,
            deleted: [],
            invalidations: [],
            metadata: {
              timestamp: new Date().toISOString(),
              depth: effectiveDepth,
              affectedCount: updated.length,
              transactionId
            }
          }
        };
      }

      if (mutation === 'createDeepCascade') {
        const effectiveDepth = Math.min(depth, maxDepth);
        const updated = [{ __typename: 'User', id: '1', operation: 'CREATED' }];

        if (effectiveDepth >= 2) {
          updated.push({ __typename: 'Post', id: '1', operation: 'CREATED' });
        }

        if (effectiveDepth >= 3) {
          updated.push({ __typename: 'Comment', id: '1', operation: 'CREATED' });
        }

        return {
          success: true,
          data: variables.user,
          cascade: {
            updated,
            deleted: [],
            invalidations: [],
            metadata: {
              timestamp: new Date().toISOString(),
              depth: effectiveDepth,
              affectedCount: updated.length,
              transactionId
            }
          }
        };
      }

      if (mutation === 'createPost') {
        return {
          success: true,
          data: { id: '1', title: variables.title, content: variables.content, authorId: variables.authorId },
          cascade: {
            updated: [{ __typename: 'Post', id: '1', operation: 'CREATED' }],
            deleted: [],
            invalidations: [],
            metadata: {
              timestamp: new Date().toISOString(),
              depth: 1,
              affectedCount: 1,
              transactionId
            }
          }
        };
      }

      if (mutation === 'createUserWithValidation') {
        const isValid = variables.name && variables.name.trim().length > 0;
        return {
          success: isValid,
          errors: isValid ? undefined : [{ code: 'VALIDATION_ERROR', message: 'Name is required' }],
          data: isValid ? { id: '1', name: variables.name, email: variables.email } : null,
          cascade: {
            updated: isValid ? [{ __typename: 'User', id: '1', operation: 'CREATED' }] : [],
            deleted: [],
            invalidations: [],
            metadata: {
              timestamp: new Date().toISOString(),
              depth: isValid ? 1 : 0,
              affectedCount: isValid ? 1 : 0,
              transactionId
            }
          }
        };
      }

      // Default response
      return {
        success: true,
        data: { id: '1' },
        cascade: {
          updated: [{ __typename: 'Entity', id: '1', operation: 'CREATED' }],
          deleted: [],
          invalidations: [],
          metadata: {
            timestamp: new Date().toISOString(),
            depth: 1,
            affectedCount: 1,
            transactionId
          }
        }
      };
    }
  };
}

describe('runStandardTests', () => {
  const options: ServerConformanceOptions = {
    level: 'standard',
    createServer: () => mockServer
  };

  it('returns 3 test categories', async () => {
    const categories = await runStandardTests(options);
    expect(categories).toHaveLength(3);
    expect(categories[0].name).toBe('Cascade Depth Control');
    expect(categories[1].name).toBe('Relationship Traversal');
    expect(categories[2].name).toBe('Transaction Metadata');
  });

  it('Cascade Depth Control has 6 tests', async () => {
    const categories = await runStandardTests(options);
    const depthCategory = categories.find(c => c.name === 'Cascade Depth Control');
    expect(depthCategory?.tests).toHaveLength(6);
  });

  it('Relationship Traversal has 8 tests', async () => {
    const categories = await runStandardTests(options);
    const relationshipCategory = categories.find(c => c.name === 'Relationship Traversal');
    expect(relationshipCategory?.tests).toHaveLength(8);
  });

  it('Transaction Metadata has 4 tests', async () => {
    const categories = await runStandardTests(options);
    const transactionCategory = categories.find(c => c.name === 'Transaction Metadata');
    expect(transactionCategory?.tests).toHaveLength(4);
  });

  it('total of 18 tests across all categories', async () => {
    const categories = await runStandardTests(options);
    const totalTests = categories.reduce((sum, category) => sum + category.tests.length, 0);
    expect(totalTests).toBe(18);
  });

  it('runs all tests and returns results', async () => {
    const categories = await runStandardTests(options);
    const totalTests = categories.reduce((sum, category) => sum + category.tests.length, 0);
    expect(totalTests).toBe(18);

    // Check that each test has a result (passed or failed with message)
    categories.forEach(category => {
      category.tests.forEach(test => {
        expect(test).toHaveProperty('name');
        expect(test).toHaveProperty('passed');
        expect(typeof test.passed).toBe('boolean');
        expect(test).toHaveProperty('message');
      });
    });
  });

  it('all categories are at standard level', async () => {
    const categories = await runStandardTests(options);
    categories.forEach(category => {
      expect(category.level).toBe('standard');
    });
  });
});