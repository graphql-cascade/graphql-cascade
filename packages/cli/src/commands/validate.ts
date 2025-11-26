import { Command } from 'commander';
import { loadSchema, validateCascadeCompatibility } from '../lib/schema-validator';

interface ValidateOptions {
  strict?: boolean;
}

export const validateCommand = new Command('validate')
  .description('Validate GraphQL schema for Cascade compatibility')
  .argument('[schema]', 'Path to schema file (SDL or JSON introspection)', './schema.graphql')
  .option('--strict', 'Treat warnings as errors')
  .action(async (schemaPath: string, options: ValidateOptions) => {
    try {
      console.log(`\nValidating schema: ${schemaPath}\n`);

      // Load the schema
      const schema = loadSchema(schemaPath);

      // Validate compatibility
      const result = validateCascadeCompatibility(schema);

      // Display results
      displayValidationResults(result);

      // Display compatibility score
      displayCompatibilityScore(result.compatibility);

      // Handle exit conditions
      handleExitConditions(result, options);

    } catch (error) {
      console.error(`\nError: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(1);
    }
  });

/**
 * Display validation errors and warnings.
 */
function displayValidationResults(result: { errors: string[]; warnings: string[] }): void {
  if (result.errors.length > 0) {
    console.log('✗ Errors:');
    result.errors.forEach(error => {
      console.log(`  - ${error}`);
    });
    console.log();
  }

  if (result.warnings.length > 0) {
    console.log('⚠ Warnings:');
    result.warnings.forEach(warning => {
      console.log(`  - ${warning}`);
    });
    console.log();
  }

  if (result.errors.length === 0 && result.warnings.length === 0) {
    console.log('✓ No issues found\n');
  }
}

/**
 * Display the compatibility score with appropriate messaging.
 */
function displayCompatibilityScore(compatibility: number): void {
  console.log(`Cascade Compatibility: ${compatibility}%\n`);

  if (compatibility === 100) {
    console.log('Schema is fully compatible with GraphQL Cascade!\n');
  } else if (compatibility >= 80) {
    console.log('Schema is mostly compatible. Fix the remaining issues for optimal Cascade performance.\n');
  } else if (compatibility >= 50) {
    console.log('Schema has significant compatibility issues. Review the errors above.\n');
  } else {
    console.log('Schema requires substantial changes for Cascade compatibility.\n');
  }
}

/**
 * Handle process exit based on validation results and options.
 */
function handleExitConditions(
  result: { errors: string[]; warnings: string[] },
  options: ValidateOptions
): void {
  const hasErrors = result.errors.length > 0;
  const hasWarnings = result.warnings.length > 0;

  if (hasErrors) {
    process.exit(1);
  }

  if (options.strict && hasWarnings) {
    console.log('Running in strict mode: treating warnings as errors\n');
    process.exit(1);
  }
}
