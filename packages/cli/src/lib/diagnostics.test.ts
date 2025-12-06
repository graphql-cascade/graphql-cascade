import { runDiagnostics } from './diagnostics';
import * as fs from 'fs';
import { execSync } from 'child_process';

// Mock fs module
jest.mock('fs');
jest.mock('child_process');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('diagnostics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock package.json exists
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({
      dependencies: {
        '@graphql-cascade/client': '^0.1.0'
      }
    }));
  });

  it('should detect installed cascade packages', async () => {
    const result = await runDiagnostics();
    expect(result.checks).toContain('@graphql-cascade/client is installed');
  });

  it('should warn when no config file exists', async () => {
    mockFs.existsSync.mockImplementation((path) => {
      if (path === 'package.json') return true;
      return false;
    });

    const result = await runDiagnostics();
    expect(result.warnings).toContain('No cascade configuration file found - consider creating cascade.config.ts');
  });

  it('should error when no package.json exists', async () => {
    mockFs.existsSync.mockImplementation(() => false);

    const result = await runDiagnostics();
    expect(result.errors).toContain('No package.json found - not in a Node.js project');
  });
});