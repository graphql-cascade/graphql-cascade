import { Command } from "commander";
import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";

export const codegenCommand = new Command("codegen")
  .description("Generate TypeScript types from GraphQL schema and operations")
  .option("-c, --config <path>", "Path to codegen config file", "codegen.yml")
  .option("-w, --watch", "Watch for file changes")
  .action(async (options) => {
    const configPath = path.join(process.cwd(), options.config);

    if (!fs.existsSync(configPath)) {
      console.error(`❌ Config file not found: ${configPath}`);
      console.log("\nTo create a config file, run:");
      console.log("  cascade codegen init");
      process.exit(1);
    }

    try {
      console.log("🔄 Generating types...\n");

      // Build graphql-codegen command
      const args = ["--config", options.config];
      if (options.watch) {
        args.push("--watch");
      }

      // Execute graphql-codegen
      const codegenProcess = spawn("npx", ["graphql-codegen", ...args], {
        cwd: process.cwd(),
        stdio: "inherit",
        shell: true,
      });

      codegenProcess.on("error", (error) => {
        console.error("❌ Failed to start codegen process:");
        console.error(error.message);
        process.exit(1);
      });

      codegenProcess.on("exit", (code) => {
        if (code === 0) {
          if (!options.watch) {
            console.log("\n✅ Code generation complete!");
          }
        } else {
          console.error(`❌ Code generation failed with exit code ${code}`);
          process.exit(code || 1);
        }
      });
    } catch (error) {
      console.error("❌ Code generation failed:");
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

export const codegenInitCommand = new Command("init")
  .description("Initialize codegen configuration")
  .option(
    "-s, --schema <path>",
    "Path to GraphQL schema",
    "http://localhost:4000/graphql",
  )
  .option(
    "-d, --documents <pattern>",
    "Document file pattern",
    "./src/**/*.graphql",
  )
  .option(
    "-o, --output <path>",
    "Generated types output path",
    "./src/generated/graphql.ts",
  )
  .action(async (options) => {
    const configPath = path.join(process.cwd(), "codegen.yml");

    if (fs.existsSync(configPath)) {
      console.error("❌ codegen.yml already exists");
      console.log("Remove it first or edit it manually");
      process.exit(1);
    }

    const configContent = `# GraphQL Cascade Codegen Configuration
# Learn more: https://the-guild.dev/graphql/codegen/docs/config-reference/codegen-config

schema: ${options.schema}
documents: ${options.documents}
generates:
  ${options.output}:
    plugins:
      - typescript
      - typescript-operations
      - '@graphql-cascade/codegen'
    config:
      # Don't skip __typename - needed for cache normalization
      skipTypename: false

      # Use TypeScript enums as union types for better type safety
      enumsAsTypes: true

      # Import cascade types from core package
      cascadeImportFrom: '@graphql-cascade/client'

      # Generate pre-configured UnionCascadeConfig objects
      generateUnionHelpers: true

      # Generate type guard functions for union responses
      generateTypeGuards: true
`;

    try {
      fs.writeFileSync(configPath, configContent.trim() + "\n", "utf-8");
      console.log("✅ Created codegen.yml");
      console.log("\nNext steps:");
      console.log(
        "  1. Update schema and documents paths in codegen.yml if needed",
      );
      console.log("  2. Install required dependencies:");
      console.log(
        "     pnpm add -D @graphql-codegen/cli @graphql-codegen/typescript",
      );
      console.log("     pnpm add -D @graphql-codegen/typescript-operations");
      console.log("     pnpm add -D @graphql-cascade/codegen");
      console.log("  3. Run: cascade codegen");
    } catch (error) {
      console.error("❌ Failed to create codegen.yml:");
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

codegenCommand.addCommand(codegenInitCommand);
