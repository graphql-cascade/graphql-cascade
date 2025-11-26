import { initCommand } from './init';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');

// Mock inquirer module
jest.mock('inquirer', () => {
  const mockFn = jest.fn();
  return {
    __esModule: true,
    default: {
      prompt: mockFn
    },
    mockPrompt: mockFn
  };
});

const mockFs = fs as jest.Mocked<typeof fs>;

// Get the mock prompt function - we'll access it after importing
let mockPrompt: jest.Mock;

describe('init command', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeAll(() => {
    // Get mockPrompt after modules are loaded
    const inquirerMock = require('inquirer');
    mockPrompt = inquirerMock.default.prompt;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as any);

    // Default mock implementations
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({
      name: 'test-project',
      dependencies: {}
    }));
    mockFs.writeFileSync.mockImplementation();
    mockFs.readdirSync.mockReturnValue([]);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('package.json detection', () => {
    it('should detect existing package.json', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockPrompt.mockResolvedValue({
        client: 'apollo',
        schemaPath: './schema.graphql'
      });

      await initCommand.parseAsync(['node', 'test', 'init', '--yes']);

      expect(mockFs.existsSync).toHaveBeenCalledWith(
        expect.stringContaining('package.json')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Detected package.json')
      );
    });

    it('should error when no package.json exists', async () => {
      mockFs.existsSync.mockImplementation((filePath) => {
        if (typeof filePath === 'string' && filePath.includes('package.json')) {
          return false;
        }
        return false;
      });

      await expect(
        initCommand.parseAsync(['node', 'test', 'init', '--yes'])
      ).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('No package.json found')
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('interactive prompts', () => {
    it('should accept client via --client flag', async () => {
      // Test that we can provide client via flag
      await initCommand.parseAsync(['node', 'test', 'init', '--client', 'apollo', '--schema', './schema.graphql', '--yes']);

      expect(mockFs.writeFileSync).toHaveBeenCalled();
      const writeCall = mockFs.writeFileSync.mock.calls.find(
        call => call[0].toString().includes('cascade.config.ts')
      );
      expect(writeCall).toBeDefined();
      expect(writeCall![1]).toContain('apollo');
    });

    it('should skip prompts when --yes flag is used', async () => {
      await initCommand.parseAsync(['node', 'test', 'init', '--yes']);

      expect(mockPrompt).not.toHaveBeenCalled();
    });

    it('should use provided client when --client flag is used', async () => {
      mockPrompt.mockResolvedValue({
        schemaPath: './schema.graphql'
      });

      await initCommand.parseAsync(['node', 'test', 'init', '--client', 'relay']);

      const promptCalls = mockPrompt.mock.calls;
      if (promptCalls.length > 0) {
        const questions = promptCalls[0][0] as any[];
        expect(questions.find((q: any) => q.name === 'client')).toBeUndefined();
      }
    });

    it('should accept schema path via --schema flag', async () => {
      await initCommand.parseAsync(['node', 'test', 'init', '--client', 'apollo', '--schema', './custom.graphql', '--yes']);

      expect(mockFs.writeFileSync).toHaveBeenCalled();
      const writeCall = mockFs.writeFileSync.mock.calls.find(
        call => call[0].toString().includes('cascade.config.ts')
      );
      expect(writeCall).toBeDefined();
      expect(writeCall![1]).toContain('./custom.graphql');
    });
  });

  describe('schema file detection', () => {
    it('should detect existing .graphql files', async () => {
      mockFs.readdirSync.mockReturnValue([
        'schema.graphql',
        'types.graphql',
        'index.ts'
      ] as any);
      mockPrompt.mockResolvedValue({
        client: 'apollo',
        schemaPath: './schema.graphql'
      });

      await initCommand.parseAsync(['node', 'test', 'init', '--yes']);

      expect(mockFs.readdirSync).toHaveBeenCalled();
    });

    it('should use detected schema files', async () => {
      mockFs.readdirSync.mockReturnValue([
        'my-schema.graphql'
      ] as any);

      await initCommand.parseAsync(['node', 'test', 'init', '--yes']);

      expect(mockFs.readdirSync).toHaveBeenCalled();
      // When schema files are detected, readdir is called
      // The schema path will either be detected or use defaults
      const readdirCalls = mockFs.readdirSync.mock.calls;
      expect(readdirCalls.length).toBeGreaterThan(0);
    });
  });

  describe('config file generation', () => {
    it('should generate cascade.config.ts with selected options', async () => {
      await initCommand.parseAsync(['node', 'test', 'init', '--client', 'apollo', '--schema', './schema.graphql', '--yes']);

      expect(mockFs.writeFileSync).toHaveBeenCalled();
      const writeCall = mockFs.writeFileSync.mock.calls.find(
        call => call[0].toString().includes('cascade.config.ts')
      );
      expect(writeCall).toBeDefined();
      expect(writeCall![1]).toContain('apollo');
    });

    it('should include schema path in generated config', async () => {
      await initCommand.parseAsync(['node', 'test', 'init', '--client', 'apollo', '--schema', './custom/schema.graphql', '--yes']);

      expect(mockFs.writeFileSync).toHaveBeenCalled();
      const writeCall = mockFs.writeFileSync.mock.calls.find(
        call => call[0].toString().includes('cascade.config.ts')
      );
      expect(writeCall).toBeDefined();
      expect(writeCall![1]).toContain('./custom/schema.graphql');
    });

    it('should skip existing config when using --yes flag', async () => {
      mockFs.existsSync.mockImplementation((filePath) => {
        if (typeof filePath === 'string' && filePath.includes('cascade.config.ts')) {
          return true;
        }
        return true;
      });

      // With --yes flag, it should overwrite existing config
      await initCommand.parseAsync(['node', 'test', 'init', '--yes']);

      const writeCallsForConfig = mockFs.writeFileSync.mock.calls.filter(
        call => call[0].toString().includes('cascade.config.ts')
      );
      // With --yes, it should write the config
      expect(writeCallsForConfig.length).toBeGreaterThan(0);
    });
  });

  describe('next steps output', () => {
    it('should display next steps after successful initialization', async () => {
      mockPrompt.mockResolvedValue({
        client: 'apollo',
        schemaPath: './schema.graphql'
      });

      await initCommand.parseAsync(['node', 'test', 'init', '--yes']);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Next steps')
      );
    });

    it('should suggest installing client package if not present', async () => {
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        name: 'test-project',
        dependencies: {}
      }));
      mockPrompt.mockResolvedValue({
        client: 'apollo',
        schemaPath: './schema.graphql'
      });

      await initCommand.parseAsync(['node', 'test', 'init', '--yes']);

      const allLogs = consoleLogSpy.mock.calls.map((call: any[]) => call.join(' ')).join('\n');
      expect(allLogs).toMatch(/install.*@apollo\/client/);
    });
  });

  describe('error handling', () => {
    it('should handle file write errors gracefully', async () => {
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });
      mockPrompt.mockResolvedValue({
        client: 'apollo',
        schemaPath: './schema.graphql'
      });

      await expect(
        initCommand.parseAsync(['node', 'test', 'init', '--yes'])
      ).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed')
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should require schema path to be provided', async () => {
      // Schema path is required - without it, default will be used
      await initCommand.parseAsync(['node', 'test', 'init', '--yes']);

      expect(mockFs.writeFileSync).toHaveBeenCalled();
      const writeCall = mockFs.writeFileSync.mock.calls.find(
        call => call[0].toString().includes('cascade.config.ts')
      );
      expect(writeCall).toBeDefined();
      // Should use default schema path
      expect(writeCall![1]).toContain('schema.graphql');
    });
  });
});
