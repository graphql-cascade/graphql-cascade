module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/index.ts',
    '!src/error-handling.ts',
    '!src/relay-runtime.d.ts',
    '!src/types.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 65,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};