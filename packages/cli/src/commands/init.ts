import { Command } from "commander";
import inquirer from "inquirer";
import * as fs from "fs";
import * as path from "path";

interface InitOptions {
  yes?: boolean;
  client?: string;
  schema?: string;
}

interface InitAnswers {
  client: string;
  schemaPath: string;
  overwrite?: boolean;
}

const SUPPORTED_CLIENTS = ["apollo", "react-query", "relay", "urql"];

const CLIENT_PACKAGES: Record<string, string> = {
  apollo: "@apollo/client",
  "react-query": "@tanstack/react-query",
  relay: "react-relay",
  urql: "urql",
};

export const initCommand = new Command("init")
  .description("Initialize GraphQL Cascade in your project")
  .option("-y, --yes", "Skip prompts and use defaults")
  .option(
    "--client <type>",
    "GraphQL client (apollo, react-query, relay, urql)",
  )
  .option("--schema <path>", "Path to GraphQL schema")
  .action(async (options: InitOptions) => {
    try {
      // Check for package.json
      const packageJsonPath = path.join(process.cwd(), "package.json");
      if (!fs.existsSync(packageJsonPath)) {
        console.error(
          "Error: No package.json found. Please run this command in a Node.js project directory.",
        );
        process.exit(1);
      }

      console.log("Detected package.json ✓");

      // Read package.json
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

      // Detect existing schema files
      const detectedSchemas = detectSchemaFiles(process.cwd());

      // Prepare questions
      const questions: any[] = [];

      if (!options.client) {
        questions.push({
          type: "list",
          name: "client",
          message: "Which GraphQL client are you using?",
          choices: SUPPORTED_CLIENTS,
          default: "apollo",
        });
      }

      if (!options.schema) {
        questions.push({
          type: "input",
          name: "schemaPath",
          message: "Path to your GraphQL schema:",
          default:
            detectedSchemas.length > 0
              ? `./${detectedSchemas[0]}`
              : "./schema.graphql",
          validate: (input: string) => {
            if (!input || input.trim() === "") {
              return "Schema path is required";
            }
            return true;
          },
        });
      }

      // Get user input
      let answers: Partial<InitAnswers> = {};
      if (options.yes || (options.client && options.schema)) {
        // Use defaults or provided options
        answers = {
          client: options.client || "apollo",
          schemaPath:
            options.schema ||
            (detectedSchemas.length > 0
              ? `./${detectedSchemas[0]}`
              : "./schema.graphql"),
        };
      } else {
        if (questions.length > 0) {
          answers = await inquirer.prompt(questions);
        }
        // Fill in missing values from options
        if (options.client && !answers.client) {
          answers.client = options.client;
        }
        if (options.schema && !answers.schemaPath) {
          answers.schemaPath = options.schema;
        }
      }

      const client = options.client || answers.client || "apollo";
      const schemaPath =
        options.schema || answers.schemaPath || "./schema.graphql";

      // Validate schema path
      if (!schemaPath || schemaPath.trim() === "") {
        console.error("Error: Schema path is required");
        process.exit(1);
      }

      // Generate config file content
      const configPath = path.join(process.cwd(), "cascade.config.ts");
      const configContent = generateConfigFile(client, schemaPath);

      // Handle file creation/overwrite with atomic operations
      if (!options.yes) {
        try {
          // Atomic operation: create new file exclusively (fails if exists)
          fs.writeFileSync(configPath, configContent, {
            flag: "wx",
            encoding: "utf-8",
          });
          console.log("\nConfiguration file created: cascade.config.ts ✓");
          return; // Success - file created
        } catch (err: any) {
          // Handle file already exists
          if (err.code === "EEXIST") {
            const overwriteAnswer = await inquirer.prompt([
              {
                type: "confirm",
                name: "overwrite",
                message: "cascade.config.ts already exists. Overwrite?",
                default: false,
              },
            ]);

            if (!overwriteAnswer.overwrite) {
              console.log("Configuration generation cancelled.");
              return;
            }
            // Fall through to overwrite below
          } else {
            // Propagate other filesystem errors
            throw err;
          }
        }
      }

      // Write file (overwrite mode or --yes flag was used)
      fs.writeFileSync(configPath, configContent, "utf-8");
      console.log("\nConfiguration file created: cascade.config.ts ✓");

      // Display next steps
      displayNextSteps(client, packageJson);
    } catch (error) {
      console.error(
        `Failed to initialize GraphQL Cascade: ${error instanceof Error ? error.message : error}`,
      );
      process.exit(1);
    }
  });

function detectSchemaFiles(dir: string): string[] {
  try {
    const files = fs.readdirSync(dir);
    return files.filter(
      (file) =>
        file.endsWith(".graphql") ||
        file.endsWith(".gql") ||
        file === "schema.json",
    );
  } catch (error) {
    return [];
  }
}

function generateConfigFile(client: string, schemaPath: string): string {
  return `import { CascadeConfig } from '@graphql-cascade/core';

const config: CascadeConfig = {
  client: '${client}',
  schema: '${schemaPath}',
  output: {
    directory: './src/generated',
    typescript: true
  },
  features: {
    dataFetching: true,
    caching: true,
    optimisticUpdates: true
  }
};

export default config;
`;
}

function displayNextSteps(client: string, packageJson: any): void {
  console.log("\n🎉 GraphQL Cascade initialized successfully!\n");
  console.log("Next steps:");
  console.log("  1. Review and customize cascade.config.ts");

  // Check if client package is installed
  const clientPackage = CLIENT_PACKAGES[client];
  const isClientInstalled =
    (packageJson.dependencies && packageJson.dependencies[clientPackage]) ||
    (packageJson.devDependencies && packageJson.devDependencies[clientPackage]);

  if (!isClientInstalled) {
    console.log(
      `  2. Install your GraphQL client: npm install ${clientPackage}`,
    );
    console.log(
      "  3. Install GraphQL Cascade: npm install @graphql-cascade/client",
    );
    console.log("  4. Run cascade doctor to verify your setup");
  } else {
    console.log(
      "  2. Install GraphQL Cascade: npm install @graphql-cascade/client",
    );
    console.log("  3. Run cascade doctor to verify your setup");
  }

  console.log(
    "\nFor more information, visit: https://graphql-cascade.dev/docs",
  );
}
