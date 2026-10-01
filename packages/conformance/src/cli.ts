#!/usr/bin/env node
/**
 * cascade-conformance: run the specification's conformance cases against
 * the server and client a configuration file exports.
 */
import { resolve } from "path";
import { pathToFileURL } from "url";
import type { CaseResult, ConformanceLevel } from "./cases";
import { runClientCases, type ClientHarness } from "./client-runner";
import { formatReport, getExitCode, type ReportOptions } from "./report";
import { runServerCases, type ServerTarget } from "./server-runner";

type MaybePromise<T> = T | Promise<T>;

/** What a configuration file exports, as its default export */
export interface ConformanceConfig {
  /** The server under test, or a function returning it */
  server?: ServerTarget | (() => MaybePromise<ServerTarget>);
  /** Creates a fresh harness around the client under test */
  client?: () => MaybePromise<ClientHarness>;
}

export interface CliOptions {
  config: string;
  target?: "server" | "client";
  level?: ConformanceLevel;
  format: ReportOptions["format"];
  verbose: boolean;
  colors: boolean;
}

const USAGE = `Usage: cascade-conformance --config <file> [options]

Runs the GraphQL Cascade conformance cases against the server and client
that <file> exports: { server?: ServerTarget, client?: () => ClientHarness }.

Options:
  --target <server|client>                Run one side only
  --level <basic|standard|complete>       Fail only for cases up to this level
  --format <console|json|markdown>        Output format (default: console)
  --verbose                               List passed and skipped cases too
  --no-colors                             Plain console output`;

function oneOf<T extends string>(
  flag: string,
  value: string | undefined,
  values: readonly T[],
): T {
  if (!values.includes(value as T)) {
    throw new Error(
      `${flag} must be one of ${values.join(", ")}; got "${value}"`,
    );
  }
  return value as T;
}

export function parseArgs(argv: string[]): CliOptions {
  const options: Partial<CliOptions> = {
    format: "console",
    verbose: false,
    colors: true,
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    switch (flag) {
      case "--config":
        options.config = argv[++i];
        break;
      case "--target":
        options.target = oneOf(flag, argv[++i], ["server", "client"] as const);
        break;
      case "--level":
        options.level = oneOf(flag, argv[++i], [
          "basic",
          "standard",
          "complete",
        ] as const);
        break;
      case "--format":
        options.format = oneOf(flag, argv[++i], [
          "console",
          "json",
          "markdown",
        ] as const);
        break;
      case "--verbose":
        options.verbose = true;
        break;
      case "--no-colors":
        options.colors = false;
        break;
      default:
        throw new Error(`Unknown option ${flag}\n\n${USAGE}`);
    }
  }
  if (!options.config)
    throw new Error(`--config <file> is required\n\n${USAGE}`);
  return options as CliOptions;
}

/** Native import, which TypeScript's CommonJS output would turn into require. */
const importModule = new Function("specifier", "return import(specifier)") as (
  specifier: string,
) => Promise<{ default?: unknown }>;

async function loadConfig(path: string): Promise<unknown> {
  const module = await importModule(pathToFileURL(resolve(path)).href);
  return module.default ?? module;
}

/**
 * Run the CLI; returns the exit code.
 */
export async function runCli(
  argv: string[],
  {
    load = loadConfig,
    write = (text: string) => console.log(text),
  }: {
    load?: (path: string) => Promise<unknown>;
    write?: (text: string) => void;
  } = {},
): Promise<number> {
  let options: CliOptions;
  try {
    options = parseArgs(argv);
  } catch (error) {
    write((error as Error).message);
    return 1;
  }

  const config = (await load(options.config)) as ConformanceConfig;
  const targets = options.target
    ? [options.target]
    : (["server", "client"] as const);
  const missing = targets.filter((target) => !config[target]);
  if (options.target && missing.length > 0) {
    write(`${options.config} exports no ${options.target}`);
    return 1;
  }

  const results: CaseResult[] = [];
  if (targets.includes("server") && config.server) {
    const server =
      typeof config.server === "function"
        ? await config.server()
        : config.server;
    results.push(...(await runServerCases(server)));
  }
  if (targets.includes("client") && config.client) {
    results.push(...(await runClientCases(config.client)));
  }
  if (results.length === 0) {
    write(`${options.config} exports neither a server nor a client`);
    return 1;
  }

  write(formatReport(results, options));
  return getExitCode(results, options.level);
}

if (require.main === module) {
  runCli(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      console.error(error);
      process.exit(1);
    },
  );
}
