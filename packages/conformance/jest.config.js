module.exports = {
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
