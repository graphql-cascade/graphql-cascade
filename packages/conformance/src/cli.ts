#!/usr/bin/env node
/**
 * GraphQL Cascade Conformance CLI
 *
 * Command-line interface for running conformance tests.
 */

import { runServerConformance, runClientConformance } from './runner';
import { formatReport, getExitCode, type ReporterOptions } from './reporter';
import type { ConformanceLevel, ServerConformanceOptions, ClientConformanceOptions } from './types';

interface CLIOptions {
  target: 'server' | 'client';
  level: ConformanceLevel;
  format: ReporterOptions['format'];
  verbose: boolean;
  colors: boolean;
  config?: string;
}

function printUsage(): void {
  console.log(`
GraphQL Cascade Conformance Test Suite

Usage:
  cascade-conformance [options]

Options:
  --target <server|client>   Target to test (required)
  --level <level>            Conformance level: basic, standard, complete (default: complete)
  --format <format>          Output format: console, json, markdown (default: console)
  --verbose                  Show detailed failure information
  --no-colors                Disable colored output
  --config <path>            Path to configuration file
  --help                     Show this help message

Examples:
  cascade-conformance --target server --level basic
  cascade-conformance --target client --level complete --format json
  cascade-conformance --target server --verbose --format markdown
`);
}

function parseArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {
    target: 'server',
    level: 'complete',
    format: 'console',
    verbose: false,
    colors: true,
  };

  let hasTarget = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--target':
        const target = args[++i];
        if (target !== 'server' && target !== 'client') {
          console.error(`Invalid target: ${target}. Must be 'server' or 'client'.`);
          process.exit(1);
        }
        options.target = target;
        hasTarget = true;
        break;

      case '--level':
        const level = args[++i] as ConformanceLevel;
        if (!['basic', 'standard', 'complete'].includes(level)) {
          console.error(`Invalid level: ${level}. Must be 'basic', 'standard', or 'complete'.`);
          process.exit(1);
        }
        options.level = level;
        break;

      case '--format':
        const format = args[++i] as ReporterOptions['format'];
        if (!['console', 'json', 'markdown'].includes(format)) {
          console.error(`Invalid format: ${format}. Must be 'console', 'json', or 'markdown'.`);
          process.exit(1);
        }
        options.format = format;
        break;

      case '--verbose':
        options.verbose = true;
        break;

      case '--no-colors':
        options.colors = false;
        break;

      case '--config':
        options.config = args[++i];
        break;

      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;

      default:
        if (arg.startsWith('-')) {
          console.error(`Unknown option: ${arg}`);
          printUsage();
          process.exit(1);
        }
    }
  }

  if (!hasTarget) {
    console.error('Error: --target is required');
    printUsage();
    process.exit(1);
  }

  return options;
}

async function loadConfig(configPath: string): Promise<Record<string, unknown>> {
  try {
    // Dynamic import for ESM compatibility
    const config = await import(configPath);
    return config.default || config;
  } catch {
    console.error(`Failed to load config from: ${configPath}`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  const options = parseArgs(args);

  // Load configuration if specified
  let serverFactory: (() => unknown) | undefined;
  let clientFactory: (() => unknown) | undefined;

  if (options.config) {
    const config = await loadConfig(options.config);
    serverFactory = config.createServer as (() => unknown) | undefined;
    clientFactory = config.createClient as (() => unknown) | undefined;
  }

  const reporterOptions: ReporterOptions = {
    format: options.format,
    verbose: options.verbose,
    colors: options.colors,
  };

  try {
    if (options.target === 'server') {
      const serverOptions: ServerConformanceOptions = {
        level: options.level,
        createServer: serverFactory,
      };

      const report = await runServerConformance(serverOptions);
      console.log(formatReport(report, reporterOptions));
      process.exit(getExitCode(report));
    } else {
      if (!clientFactory) {
        console.error('Error: Client conformance requires a createClient factory in config');
        process.exit(1);
      }

      const clientOptions: ClientConformanceOptions = {
        level: options.level,
        createClient: clientFactory,
      };

      const report = await runClientConformance(clientOptions);
      console.log(formatReport(report, reporterOptions));
      process.exit(getExitCode(report));
    }
  } catch (error) {
    console.error('Error running conformance tests:', error);
    process.exit(1);
  }
}

// Export for programmatic use
export { parseArgs, main };

// Run CLI when executed directly
if (require.main === module) {
  main();
}
