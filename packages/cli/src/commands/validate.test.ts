import * as schemaValidator from '../lib/schema-validator';
import { buildSchema } from 'graphql';

// Mock the schema validator module
jest.mock('../lib/schema-validator');
const mockSchemaValidator = schemaValidator as jest.Mocked<typeof schemaValidator>;

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
const mockProcessExit = jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
  throw new Error(`Process.exit called with code ${code}`);
});

describe('validate command', () => {
  let validateCommand: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Get a fresh command instance for each test
    jest.isolateModules(() => {
      const module = require('./validate');
      validateCommand = module.validateCommand;
    });
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    mockProcessExit.mockRestore();
  });

  it('should be defined with correct configuration', () => {
    expect(validateCommand.name()).toBe('validate');
    expect(validateCommand.description()).toContain('Validate');
  });

  it('should use default schema path if not provided', async () => {
    const mockSchema = buildSchema('type Query { hello: String }');
    mockSchemaValidator.loadSchema.mockReturnValue(mockSchema);
    mockSchemaValidator.validateCascadeCompatibility.mockReturnValue({
      errors: [],
      warnings: [],
      compatibility: 100
    });

    // Parse command with no arguments
    await validateCommand.parseAsync(['node', 'test']);

    expect(mockSchemaValidator.loadSchema).toHaveBeenCalledWith('./schema.graphql');
  });

  it('should use provided schema path', async () => {
    const mockSchema = buildSchema('type Query { hello: String }');
    mockSchemaValidator.loadSchema.mockReturnValue(mockSchema);
    mockSchemaValidator.validateCascadeCompatibility.mockReturnValue({
      errors: [],
      warnings: [],
      compatibility: 100
    });

    await validateCommand.parseAsync(['node', 'test', 'custom/path/schema.graphql']);

    expect(mockSchemaValidator.loadSchema).toHaveBeenCalledWith('custom/path/schema.graphql');
  });

  it('should exit with code 0 when validation passes', async () => {
    const mockSchema = buildSchema('type Query { hello: String }');
    mockSchemaValidator.loadSchema.mockReturnValue(mockSchema);
    mockSchemaValidator.validateCascadeCompatibility.mockReturnValue({
      errors: [],
      warnings: [],
      compatibility: 100
    });

    await validateCommand.parseAsync(['node', 'test']);

    // Should not call process.exit for success
    expect(mockProcessExit).not.toHaveBeenCalled();
  });

  it('should exit with code 1 when validation has errors', async () => {
    const mockSchema = buildSchema('type Query { hello: String }');
    mockSchemaValidator.loadSchema.mockReturnValue(mockSchema);
    mockSchemaValidator.validateCascadeCompatibility.mockReturnValue({
      errors: ['Type User is missing required id field'],
      warnings: [],
      compatibility: 75
    });

    await expect(
      validateCommand.parseAsync(['node', 'test'])
    ).rejects.toThrow('Process.exit called with code 1');

    expect(mockProcessExit).toHaveBeenCalledWith(1);
  });

  it('should treat warnings as errors in strict mode', async () => {
    const mockSchema = buildSchema('type Query { hello: String }');
    mockSchemaValidator.loadSchema.mockReturnValue(mockSchema);
    mockSchemaValidator.validateCascadeCompatibility.mockReturnValue({
      errors: [],
      warnings: ['Potential circular reference detected in User.friends'],
      compatibility: 95
    });

    await expect(
      validateCommand.parseAsync(['node', 'test', '--strict'])
    ).rejects.toThrow('Process.exit called with code 1');

    expect(mockProcessExit).toHaveBeenCalledWith(1);
  });

  it('should not fail on warnings in non-strict mode', async () => {
    const mockSchema = buildSchema('type Query { hello: String }');
    mockSchemaValidator.loadSchema.mockReturnValue(mockSchema);
    mockSchemaValidator.validateCascadeCompatibility.mockReturnValue({
      errors: [],
      warnings: ['Potential circular reference detected in User.friends'],
      compatibility: 95
    });

    await validateCommand.parseAsync(['node', 'test']);

    expect(mockProcessExit).not.toHaveBeenCalled();
  });

  it('should display validation results', async () => {
    const mockSchema = buildSchema('type Query { hello: String }');
    mockSchemaValidator.loadSchema.mockReturnValue(mockSchema);
    mockSchemaValidator.validateCascadeCompatibility.mockReturnValue({
      errors: ['Error 1', 'Error 2'],
      warnings: ['Warning 1'],
      compatibility: 70
    });

    await expect(
      validateCommand.parseAsync(['node', 'test'])
    ).rejects.toThrow('Process.exit called with code 1');

    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Validating'));
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Error 1'));
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Warning 1'));
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('70'));
  });

  it('should handle schema loading errors gracefully', async () => {
    mockSchemaValidator.loadSchema.mockImplementation(() => {
      throw new Error('Schema file not found: schema.graphql');
    });

    await expect(
      validateCommand.parseAsync(['node', 'test'])
    ).rejects.toThrow('Process.exit called with code 1');

    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('Schema file not found'));
    expect(mockProcessExit).toHaveBeenCalledWith(1);
  });

  it('should show compatibility percentage', async () => {
    const mockSchema = buildSchema('type Query { hello: String }');
    mockSchemaValidator.loadSchema.mockReturnValue(mockSchema);
    mockSchemaValidator.validateCascadeCompatibility.mockReturnValue({
      errors: [],
      warnings: [],
      compatibility: 100
    });

    await validateCommand.parseAsync(['node', 'test']);

    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('100'));
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('%'));
  });
});
