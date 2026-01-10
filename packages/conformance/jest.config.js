// Increase timeout for Windows CI runners which are slower
const isWindows = process.platform === 'win32';

module.exports = {
  testTimeout: isWindows ? 15000 : 10000,
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/index.ts',
    '!src/cli.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 45,
      functions: 70,
      lines: 65,
      statements: 65
    }
  }
};
