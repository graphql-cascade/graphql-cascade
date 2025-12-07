// Suppress Apollo Client deprecation warnings in tests
// These warnings are about API changes in Apollo Client v3.14.0
// and don't affect test validity
const originalWarn = console.warn;
const originalError = console.error;

beforeAll(() => {
  console.warn = (...args) => {
    const message = args[0];
    // Suppress Apollo Client deprecation warnings
    if (
      typeof message === 'string' &&
      (message.includes('go.apollo.dev/c/err') ||
        message.includes('addTypename') ||
        message.includes('connectToDevTools') ||
        message.includes('deprecated'))
    ) {
      return;
    }
    originalWarn.apply(console, args);
  };

  console.error = (...args) => {
    const message = args[0];
    // Suppress specific React warnings that are expected in tests
    if (
      typeof message === 'string' &&
      (message.includes('Not implemented: HTMLFormElement.prototype.submit') ||
        message.includes('Error: Could not parse CSS stylesheet'))
    ) {
      return;
    }
    originalError.apply(console, args);
  };
});

afterAll(() => {
  console.warn = originalWarn;
  console.error = originalError;
});
