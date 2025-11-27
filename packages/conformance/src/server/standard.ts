import { TestCategory, TestResult, ServerConformanceOptions } from '../types';

/**
 * Run standard-level server conformance tests
 */
export async function runStandardTests(
  options: ServerConformanceOptions
): Promise<TestCategory[]> {
  const categories: TestCategory[] = [];

  // Cascade Depth Control (6 tests)
  categories.push(await runCascadeDepthControlTests(options));

  // Relationship Traversal (8 tests)
  categories.push(await runRelationshipTraversalTests(options));

  // Transaction Metadata (4 tests)
  categories.push(await runTransactionMetadataTests(options));

  return categories;
}

/**
 * Test cascade depth control behavior
 */
async function runCascadeDepthControlTests(options: ServerConformanceOptions): Promise<TestCategory> {
  const tests: TestResult[] = [];
  const server = options.createServer?.() || mockTestServer();

  // Depth 1 returns primary only
  try {
    const response = await executeMutation(server, 'createUser', { name: 'Test User', email: 'test@example.com' }, { depth: 1 });
    const passed = response.cascade.metadata.depth === 1 && response.cascade.updated.length === 1;
    tests.push({
      name: 'Depth 1 returns primary only',
      passed,
      message: passed ? 'Depth 1 correctly returns only primary entity' : `Expected depth 1 with 1 entity, got depth ${response.cascade.metadata.depth} with ${response.cascade.updated.length} entities`
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    tests.push({
      name: 'Depth 1 returns primary only',
      passed: false,
      message: `Test failed: ${errorMessage}`
    });
  }

  // Depth 2 returns related
  try {
    const response = await executeMutation(server, 'createUserWithPosts', {
      name: 'Test User',
      email: 'test@example.com',
      posts: [{ title: 'Test Post', content: 'Content' }]
    }, { depth: 2 });
    const passed = response.cascade.metadata.depth === 2 && response.cascade.updated.length >= 2;
    tests.push({
      name: 'Depth 2 returns related',
      passed,
      message: passed ? 'Depth 2 correctly returns primary and related entities' : `Expected depth 2 with >=2 entities, got depth ${response.cascade.metadata.depth} with ${response.cascade.updated.length} entities`
    });
  } catch (error) {
    tests.push({
      name: 'Depth 2 returns related',
      passed: false,
      message: `Test failed: ${error instanceof Error ? error.message : String(error)}`
    });
  }

  // Depth N respects limit
  try {
    const response = await executeMutation(server, 'createDeepNested', {
      name: 'Test User',
      posts: [{
        title: 'Test Post',
        comments: [{
          text: 'Comment',
          author: { name: 'Comment Author' }
        }]
      }]
    }, { depth: 4, maxDepth: 2 });
    const passed = response.cascade.metadata.depth <= 2;
    tests.push({
      name: 'Depth N respects limit',
      passed,
      message: passed ? 'Depth correctly respects the specified limit' : `Expected depth <= 2, got ${response.cascade.metadata.depth}`
    });
  } catch (error) {
    tests.push({
      name: 'Depth N respects limit',
      passed: false,
      message: `Test failed: ${error instanceof Error ? error.message : String(error)}`
    });
  }

  // Default depth applied
  try {
    const response = await executeMutation(server, 'createUser', { name: 'Test User', email: 'test@example.com' });
    const hasDepth = typeof response.cascade.metadata.depth === 'number' && response.cascade.metadata.depth > 0;
    tests.push({
      name: 'Default depth applied',
      passed: hasDepth,
      message: hasDepth ? 'Default depth is applied in metadata' : 'No valid depth found in cascade metadata'
    });
  } catch (error) {
    tests.push({
      name: 'Default depth applied',
      passed: false,
      message: `Test failed: ${error instanceof Error ? error.message : String(error)}`
    });
  }

  // Max depth enforced
  try {
    const response = await executeMutation(server, 'createDeepNested', {
      name: 'Test User',
      posts: [{
        title: 'Test Post',
        comments: [{
          text: 'Comment',
          replies: [{ text: 'Reply' }]
        }]
      }]
    }, { maxDepth: 3 });
    const passed = response.cascade.metadata.depth <= 3;
    tests.push({
      name: 'Max depth enforced',
      passed,
      message: passed ? 'Max depth limit is properly enforced' : `Expected depth <= 3, got ${response.cascade.metadata.depth}`
    });
  } catch (error) {
    tests.push({
      name: 'Max depth enforced',
      passed: false,
      message: `Test failed: ${error instanceof Error ? error.message : String(error)}`
    });
  }

  // Depth metadata accurate
  try {
    const response = await executeMutation(server, 'createUserWithPosts', {
      name: 'Test User',
      email: 'test@example.com',
      posts: [{ title: 'Test Post', content: 'Content' }]
    }, { depth: 2 });
    const expectedDepth = 2;
    const actualDepth = response.cascade.metadata.depth;
    const passed = actualDepth === expectedDepth;
    tests.push({
      name: 'Depth metadata accurate',
      passed,
      message: passed ? 'Depth metadata matches actual cascade depth' : `Expected depth ${expectedDepth}, got ${actualDepth}`
    });
  } catch (error) {
    tests.push({
      name: 'Depth metadata accurate',
      passed: false,
      message: `Test failed: ${error instanceof Error ? error.message : String(error)}`
    });
  }

  return {
    name: 'Cascade Depth Control',
    level: 'standard',
    tests
  };
}

/**
 * Test relationship traversal behavior
 */
async function runRelationshipTraversalTests(options: ServerConformanceOptions): Promise<TestCategory> {
  const tests: TestResult[] = [];
  const server = options.createServer?.() || mockTestServer();

  // One-to-one tracked
  try {
    const response = await executeMutation(server, 'createUserWithProfile', {
      name: 'Test User',
      email: 'test@example.com',
      profile: { bio: 'Test bio' }
    }, { depth: 2 });
    const hasUser = response.cascade.updated.some((u: any) => u.__typename === 'User');
    const hasProfile = response.cascade.updated.some((u: any) => u.__typename === 'Profile');
    const passed = hasUser && hasProfile;
    tests.push({
      name: 'One-to-one tracked',
      passed,
      message: passed ? 'One-to-one relationship properly tracked in cascade' : 'Missing User or Profile in cascade updates'
    });
  } catch (error) {
    tests.push({
      name: 'One-to-one tracked',
      passed: false,
      message: `Test failed: ${error instanceof Error ? error.message : String(error)}`
    });
  }

  // One-to-many tracked
  try {
    const response = await executeMutation(server, 'createUserWithPosts', {
      name: 'Test User',
      email: 'test@example.com',
      posts: [
        { title: 'Post 1', content: 'Content 1' },
        { title: 'Post 2', content: 'Content 2' }
      ]
    }, { depth: 2 });
    const userUpdates = response.cascade.updated.filter((u: any) => u.__typename === 'User');
    const postUpdates = response.cascade.updated.filter((u: any) => u.__typename === 'Post');
    const passed = userUpdates.length === 1 && postUpdates.length === 2;
    tests.push({
      name: 'One-to-many tracked',
      passed,
      message: passed ? 'One-to-many relationship properly tracked in cascade' : `Expected 1 User and 2 Posts, got ${userUpdates.length} Users and ${postUpdates.length} Posts`
    });
  } catch (error) {
    tests.push({
      name: 'One-to-many tracked',
      passed: false,
      message: `Test failed: ${error instanceof Error ? error.message : String(error)}`
    });
  }

  // Many-to-many tracked
  try {
    const response = await executeMutation(server, 'createUserWithGroups', {
      name: 'Test User',
      email: 'test@example.com',
      groups: [
        { name: 'Group 1' },
        { name: 'Group 2' }
      ]
    }, { depth: 3 });
    const userUpdates = response.cascade.updated.filter((u: any) => u.__typename === 'User');
    const groupUpdates = response.cascade.updated.filter((u: any) => u.__typename === 'Group');
    const membershipUpdates = response.cascade.updated.filter((u: any) => u.__typename === 'UserGroup');
    const passed = userUpdates.length === 1 && groupUpdates.length === 2 && membershipUpdates.length === 2;
    tests.push({
      name: 'Many-to-many tracked',
      passed,
      message: passed ? 'Many-to-many relationship properly tracked in cascade' : `Expected 1 User, 2 Groups, 2 Memberships; got ${userUpdates.length}/${groupUpdates.length}/${membershipUpdates.length}`
    });
  } catch (error) {
    tests.push({
      name: 'Many-to-many tracked',
      passed: false,
      message: `Test failed: ${error instanceof Error ? error.message : String(error)}`
    });
  }

  // Circular refs handled
  try {
    const response = await executeMutation(server, 'createUsersWithFriends', {
      users: [
        { name: 'User 1', friends: [{ name: 'User 2' }] },
        { name: 'User 2', friends: [{ name: 'User 1' }] }
      ]
    }, { depth: 2 });
    const userUpdates = response.cascade.updated.filter((u: any) => u.__typename === 'User');
    const passed = userUpdates.length === 2; // Should not create duplicate users due to circular refs
    tests.push({
      name: 'Circular refs handled',
      passed,
      message: passed ? 'Circular references handled without duplication' : `Expected 2 Users, got ${userUpdates.length}`
    });
  } catch (error) {
    tests.push({
      name: 'Circular refs handled',
      passed: false,
      message: `Test failed: ${error instanceof Error ? error.message : String(error)}`
    });
  }

  // Self-referential handled
  try {
    const response = await executeMutation(server, 'createCategoryTree', {
      categories: [
        { name: 'Parent', children: [{ name: 'Child', parentId: 'parent-id' }] }
      ]
    }, { depth: 2 });
    const categoryUpdates = response.cascade.updated.filter((u: any) => u.__typename === 'Category');
    const passed = categoryUpdates.length === 2; // Parent and child, no infinite loop
    tests.push({
      name: 'Self-referential handled',
      passed,
      message: passed ? 'Self-referential relationships handled correctly' : `Expected 2 Categories, got ${categoryUpdates.length}`
    });
  } catch (error) {
    tests.push({
      name: 'Self-referential handled',
      passed: false,
      message: `Test failed: ${error instanceof Error ? error.message : String(error)}`
    });
  }

  // Nested creates tracked
  try {
    const response = await executeMutation(server, 'createPostWithComments', {
      title: 'Test Post',
      content: 'Content',
      author: { name: 'Author', email: 'author@example.com' },
      comments: [
        { text: 'Comment 1', author: { name: 'Commenter 1', email: 'c1@example.com' } },
        { text: 'Comment 2', author: { name: 'Commenter 2', email: 'c2@example.com' } }
      ]
    }, { depth: 3 });
    const userUpdates = response.cascade.updated.filter((u: any) => u.__typename === 'User');
    const postUpdates = response.cascade.updated.filter((u: any) => u.__typename === 'Post');
    const commentUpdates = response.cascade.updated.filter((u: any) => u.__typename === 'Comment');
    const passed = userUpdates.length === 3 && postUpdates.length === 1 && commentUpdates.length === 2;
    tests.push({
      name: 'Nested creates tracked',
      passed,
      message: passed ? 'Nested creates properly tracked in cascade' : `Expected 3 Users, 1 Post, 2 Comments; got ${userUpdates.length}/${postUpdates.length}/${commentUpdates.length}`
    });
  } catch (error) {
    tests.push({
      name: 'Nested creates tracked',
      passed: false,
      message: `Test failed: ${error instanceof Error ? error.message : String(error)}`
    });
  }

  // Nested updates tracked
  try {
    const response = await executeMutation(server, 'updatePostWithComments', {
      id: 'post-1',
      title: 'Updated Title',
      comments: [
        { id: 'comment-1', text: 'Updated Comment 1' },
        { id: 'comment-2', text: 'Updated Comment 2' }
      ]
    }, { depth: 2 });
    const postUpdates = response.cascade.updated.filter((u: any) => u.__typename === 'Post' && u.operation === 'UPDATED');
    const commentUpdates = response.cascade.updated.filter((u: any) => u.__typename === 'Comment' && u.operation === 'UPDATED');
    const passed = postUpdates.length === 1 && commentUpdates.length === 2;
    tests.push({
      name: 'Nested updates tracked',
      passed,
      message: passed ? 'Nested updates properly tracked in cascade' : `Expected 1 Post update, 2 Comment updates; got ${postUpdates.length}/${commentUpdates.length}`
    });
  } catch (error) {
    tests.push({
      name: 'Nested updates tracked',
      passed: false,
      message: `Test failed: ${error instanceof Error ? error.message : String(error)}`
    });
  }

  // Cascade stops at limit
  try {
    const response = await executeMutation(server, 'createDeepCascade', {
      user: {
        name: 'User',
        posts: [{
          title: 'Post',
          comments: [{
            text: 'Comment',
            replies: [{
              text: 'Reply',
              author: { name: 'Replier' }
            }]
          }]
        }]
      }
    }, { maxDepth: 3 });
    const passed = response.cascade.metadata.depth <= 3;
    tests.push({
      name: 'Cascade stops at limit',
      passed,
      message: passed ? 'Cascade correctly stops at depth limit' : `Expected depth <= 3, got ${response.cascade.metadata.depth}`
    });
  } catch (error) {
    tests.push({
      name: 'Cascade stops at limit',
      passed: false,
      message: `Test failed: ${error instanceof Error ? error.message : String(error)}`
    });
  }

  return {
    name: 'Relationship Traversal',
    level: 'standard',
    tests
  };
}

/**
 * Test transaction metadata behavior
 */
async function runTransactionMetadataTests(options: ServerConformanceOptions): Promise<TestCategory> {
  const tests: TestResult[] = [];
  const server = options.createServer?.() || mockTestServer();

  // Transaction ID included
  try {
    const response = await executeMutation(server, 'createUser', { name: 'Test User', email: 'test@example.com' });
    const hasTransactionId = response.cascade.metadata.transactionId;
    const passed = typeof hasTransactionId === 'string' && hasTransactionId.length > 0;
    tests.push({
      name: 'Transaction ID included',
      passed,
      message: passed ? 'Transaction ID is included in cascade metadata' : 'Missing transaction ID in cascade metadata'
    });
  } catch (error) {
    tests.push({
      name: 'Transaction ID included',
      passed: false,
      message: `Test failed: ${error instanceof Error ? error.message : String(error)}`
    });
  }

  // Transaction ID consistent
  try {
    const response1 = await executeMutation(server, 'createUser', { name: 'User 1', email: 'user1@example.com' });
    const response2 = await executeMutation(server, 'createPost', {
      title: 'Post',
      content: 'Content',
      authorId: response1.data.id
    });
    const transactionId1 = response1.cascade.metadata.transactionId;
    const transactionId2 = response2.cascade.metadata.transactionId;
    const passed = Boolean(transactionId1 && transactionId2 && transactionId1 !== transactionId2);
    tests.push({
      name: 'Transaction ID consistent',
      passed,
      message: passed ? 'Different operations have different transaction IDs' : 'Transaction IDs should be unique per operation'
    });
  } catch (error) {
    tests.push({
      name: 'Transaction ID consistent',
      passed: false,
      message: `Test failed: ${error instanceof Error ? error.message : String(error)}`
    });
  }

  // Rollback empty cascade
  try {
    const response = await executeMutation(server, 'createUserWithValidation', {
      name: '', // Invalid: empty name
      email: 'test@example.com'
    });
    const isRollback = !response.success && response.cascade.updated.length === 0 && response.cascade.metadata.affectedCount === 0;
    const passed = isRollback;
    tests.push({
      name: 'Rollback empty cascade',
      passed,
      message: passed ? 'Failed operations result in empty cascade (rollback)' : 'Failed operations should result in empty cascade'
    });
  } catch (error) {
    tests.push({
      name: 'Rollback empty cascade',
      passed: false,
      message: `Test failed: ${error instanceof Error ? error.message : String(error)}`
    });
  }

  // Partial success indicated
  try {
    const response = await executeMutation(server, 'createPostWithComments', {
      title: 'Test Post',
      content: 'Content',
      author: { name: 'Author', email: 'author@example.com' },
      comments: [
        { text: 'Valid Comment', author: { name: 'Commenter', email: 'commenter@example.com' } },
        { text: '', author: { name: '', email: 'invalid@example.com' } } // Invalid comment
      ]
    });
    const hasPartialSuccess = response.cascade.metadata.partialSuccess === true;
    const hasWarnings = response.cascade.metadata.warnings && response.cascade.metadata.warnings.length > 0;
    const passed = hasPartialSuccess && hasWarnings;
    tests.push({
      name: 'Partial success indicated',
      passed,
      message: passed ? 'Partial success is properly indicated with warnings' : 'Partial success should be indicated when some operations fail'
    });
  } catch (error) {
    tests.push({
      name: 'Partial success indicated',
      passed: false,
      message: `Test failed: ${error instanceof Error ? error.message : String(error)}`
    });
  }

  return {
    name: 'Transaction Metadata',
    level: 'standard',
    tests
  };
}

/**
 * Mock test server for conformance testing
 */
function mockTestServer() {
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
          variables.posts.forEach((post: any, index: number) => {
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
          variables.groups.forEach((group: any, index: number) => {
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

        if (effectiveDepth >= 4) {
          updated.push({ __typename: 'User', id: '2', operation: 'CREATED' }); // Comment author
        }

        return {
          success: true,
          data: {
            id: '1',
            name: variables.name,
            posts: effectiveDepth >= 2 ? [{
              id: '1',
              title: variables.posts[0].title,
              comments: effectiveDepth >= 3 ? [{
                id: '1',
                text: variables.posts[0].comments[0].text,
                author: effectiveDepth >= 4 ? { id: '2', name: variables.posts[0].comments[0].author.name } : undefined
              }] : []
            }] : []
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

/**
 * Execute a mutation against the test server
 */
async function executeMutation(server: any, mutationType: string, variables: any, options: any = {}) {
  return await server.execute(mutationType, variables, options);
}