// Increase timeout for Windows CI runners which are slower
const isWindows = process.platform === 'win32';

module.exports = {
  testTimeout: isWindows ? 15000 : 10000,
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  collectCoverageFrom: [
    'src/**/*.ts',
    'src/**/*.tsx',
    '!src/index.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      isolatedModules: true,
      tsconfig: {
        jsx: 'react-jsx'
      }
    }]
  },
  silent: false,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
};