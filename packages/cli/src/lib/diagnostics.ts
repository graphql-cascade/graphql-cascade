import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface DiagnosticCheck {
  name: string;
  passed: boolean;
  fix?: string;
  docsUrl?: string;
}

interface DiagnosticResult {
  checks: string[];
  warnings: string[];
  errors: string[];
}

export async function runDiagnostics(): Promise<DiagnosticResult> {
  const result: DiagnosticResult = {
    checks: [],
    warnings: [],
    errors: []
  };

  // Check if we're in a Node.js project
  if (!fs.existsSync('package.json')) {
    result.errors.push('No package.json found - not in a Node.js project');
    return result;
  }

  // Check for cascade packages
  await checkCascadePackages(result);

  // Check package versions
  await checkPackageVersions(result);

  // Check basic configuration
  await checkConfiguration(result);

  // Check TypeScript version
  await checkTypeScriptVersion(result);

  // Check GraphQL version
  await checkGraphQLVersion(result);

  // Check for peer dependencies
  await checkPeerDependencies(result);

  return result;
}

async function checkCascadePackages(result: DiagnosticResult): Promise<void> {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

    const cascadePackages = [
      '@graphql-cascade/client',
      '@graphql-cascade/apollo',
      '@graphql-cascade/react-query'
    ];

    let installedCount = 0;
    for (const pkg of cascadePackages) {
      if (dependencies[pkg]) {
        installedCount++;
        result.checks.push(`${pkg} is installed`);
      }
    }

    if (installedCount === 0) {
      result.errors.push('No GraphQL Cascade packages found in dependencies');
    } else if (installedCount < cascadePackages.length) {
      result.warnings.push('Only some GraphQL Cascade packages installed - consider installing all client packages');
    }

  } catch (error) {
    result.errors.push('Failed to read package.json');
  }
}

async function checkPackageVersions(result: DiagnosticResult): Promise<void> {
  try {
    // Check if node_modules exists
    if (!fs.existsSync('node_modules')) {
      result.errors.push('node_modules not found - run npm install first');
      return;
    }

    // Try to get version info using npm
    try {
      const output = execSync('npm list --depth=0 2>/dev/null || echo "npm list failed"', { encoding: 'utf-8' });
      if (output.includes('@graphql-cascade/')) {
        result.checks.push('Package versions can be resolved');
      }
    } catch {
      // npm list might fail, that's ok
      result.checks.push('Package installation detected');
    }

  } catch (error) {
    result.warnings.push('Could not verify package versions');
  }
}

async function checkConfiguration(result: DiagnosticResult): Promise<void> {
  // Check for common config files
  const configFiles = [
    'cascade.config.ts',
    'cascade.config.js',
    'graphql.config.js',
    '.graphqlrc'
  ];

  let hasConfig = false;
  for (const configFile of configFiles) {
    if (fs.existsSync(configFile)) {
      result.checks.push(`Configuration file found: ${configFile}`);
      hasConfig = true;
      break;
    }
  }

  if (!hasConfig) {
    result.warnings.push('No cascade configuration file found - consider creating cascade.config.ts');
  }

  // Check for schema files
  const schemaFiles = [
    'schema.graphql',
    'schema.gql',
    'src/schema.graphql'
  ];

  let hasSchema = false;
  for (const schemaFile of schemaFiles) {
    if (fs.existsSync(schemaFile)) {
      result.checks.push(`Schema file found: ${schemaFile}`);
      hasSchema = true;
      break;
    }
  }

  if (!hasSchema) {
    result.warnings.push('No GraphQL schema file found - cascade works best with a schema file');
  }
}

async function checkTypeScriptVersion(result: DiagnosticResult): Promise<void> {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

    if (dependencies['typescript']) {
      const version = dependencies['typescript'].replace(/[\^~>=<]/g, '');
      const majorVersion = parseInt(version.split('.')[0], 10);

      if (majorVersion >= 4 && parseInt(version.split('.')[1] || '0', 10) >= 7) {
        result.checks.push(`TypeScript version ${version} is compatible`);
      } else if (majorVersion >= 5) {
        result.checks.push(`TypeScript version ${version} is compatible`);
      } else {
        result.warnings.push(`TypeScript ${version} may be outdated. Recommended: >=4.7`);
      }
    } else {
      result.warnings.push('TypeScript not found - GraphQL Cascade works best with TypeScript');
    }
  } catch (error) {
    // Silently ignore
  }
}

async function checkGraphQLVersion(result: DiagnosticResult): Promise<void> {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

    if (dependencies['graphql']) {
      const version = dependencies['graphql'].replace(/[\^~>=<]/g, '');
      const majorVersion = parseInt(version.split('.')[0], 10);

      if (majorVersion >= 16) {
        result.checks.push(`GraphQL version ${version} is compatible`);
      } else {
        result.errors.push(`GraphQL ${version} is not supported. Required: >=16.0.0. Fix: npm install graphql@^16.0.0`);
      }
    } else {
      result.errors.push('GraphQL package not found. Fix: npm install graphql@^16.0.0');
    }
  } catch (error) {
    // Silently ignore
  }
}

async function checkPeerDependencies(result: DiagnosticResult): Promise<void> {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

    // Check if any cascade client is installed and verify corresponding GraphQL client
    const clientChecks = [
      { cascade: '@graphql-cascade/client-apollo', peer: '@apollo/client', peerName: 'Apollo Client' },
      { cascade: '@graphql-cascade/client-react-query', peer: '@tanstack/react-query', peerName: 'React Query' },
      { cascade: '@graphql-cascade/client-urql', peer: 'urql', peerName: 'URQL' },
      { cascade: '@graphql-cascade/client-relay', peer: 'react-relay', peerName: 'Relay' },
    ];

    for (const check of clientChecks) {
      if (dependencies[check.cascade]) {
        if (dependencies[check.peer]) {
          result.checks.push(`${check.peerName} peer dependency found`);
        } else {
          result.errors.push(`${check.cascade} requires ${check.peer}. Fix: npm install ${check.peer}`);
        }
      }
    }

    // Check for server package peer dependency
    if (dependencies['@graphql-cascade/server']) {
      if (!dependencies['graphql']) {
        result.errors.push('@graphql-cascade/server requires graphql. Fix: npm install graphql@^16.0.0');
      }
    }
  } catch (error) {
    // Silently ignore
  }
}