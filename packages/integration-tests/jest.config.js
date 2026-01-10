// Increase timeout for Windows CI runners which are slower
const isWindows = process.platform === 'win32';

module.exports = {
  testTimeout: isWindows ? 15000 : 10000,
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/e2e'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.{ts,js}',
    '!**/node_modules/**',
    '!**/dist/**',
  ],
  moduleNameMapping: {
    '^@graphql-cascade/(.*)$': '<rootDir>/../packages/$1/src',
  },
};
