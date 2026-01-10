/** @type {import('ts-jest').JestConfigWithTsJest} */
// Increase timeout for Windows CI runners which are slower
const isWindows = process.platform === 'win32';

module.exports = {
  testTimeout: isWindows ? 15000 : 10000,
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/index.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  verbose: true
};
