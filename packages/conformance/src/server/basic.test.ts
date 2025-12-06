import { runBasicTests } from './basic';
import type { ServerConformanceOptions } from '../types';

describe('runBasicTests', () => {
  const options: ServerConformanceOptions = {
    level: 'basic',
  };

  it('should return 4 test categories', async () => {
    const categories = await runBasicTests(options);
    expect(categories).toHaveLength(4);
  });

  it('should include Entity Tracking category', async () => {
    const categories = await runBasicTests(options);
    const entityTracking = categories.find(cat => cat.name === 'Entity Tracking');
    expect(entityTracking).toBeDefined();
    expect(entityTracking?.level).toBe('basic');
    expect(entityTracking?.tests).toHaveLength(10);
  });

  it('should include Invalidation Hints category', async () => {
    const categories = await runBasicTests(options);
    const invalidationHints = categories.find(cat => cat.name === 'Invalidation Hints');
    expect(invalidationHints).toBeDefined();
    expect(invalidationHints?.level).toBe('basic');
    expect(invalidationHints?.tests).toHaveLength(8);
  });

  it('should include Metadata category', async () => {
    const categories = await runBasicTests(options);
    const metadata = categories.find(cat => cat.name === 'Metadata');
    expect(metadata).toBeDefined();
    expect(metadata?.level).toBe('basic');
    expect(metadata?.tests).toHaveLength(6);
  });

  it('should include Error Handling category', async () => {
    const categories = await runBasicTests(options);
    const errorHandling = categories.find(cat => cat.name === 'Error Handling');
    expect(errorHandling).toBeDefined();
    expect(errorHandling?.level).toBe('basic');
    expect(errorHandling?.tests).toHaveLength(6);
  });

  it('should have correct test structure', async () => {
    const categories = await runBasicTests(options);
    for (const category of categories) {
      for (const test of category.tests) {
        expect(test).toHaveProperty('name');
        expect(test).toHaveProperty('passed');
        expect(typeof test.passed).toBe('boolean');
        expect(test).toHaveProperty('message');
      }
    }
  });

  it('should pass basic fixture-based tests', async () => {
    const categories = await runBasicTests(options);

    // Test some specific tests that should pass with our fixtures
    const entityTracking = categories.find(cat => cat.name === 'Entity Tracking');
    const primaryTracked = entityTracking?.tests.find(t => t.name === 'Primary mutation result tracked');
    expect(primaryTracked?.passed).toBe(true);

    const correctTypename = entityTracking?.tests.find(t => t.name === 'Correct __typename');
    expect(correctTypename?.passed).toBe(true);

    const metadata = categories.find(cat => cat.name === 'Metadata');
    const hasTimestamp = metadata?.tests.find(t => t.name === 'Has timestamp');
    expect(hasTimestamp?.passed).toBe(true);

    const errorHandling = categories.find(cat => cat.name === 'Error Handling');
    const validationError = errorHandling?.tests.find(t => t.name === 'VALIDATION_ERROR code');
    expect(validationError?.passed).toBe(true);
  });
});