import { Command } from 'commander';
import { runDiagnostics } from '../lib/diagnostics';

export const doctorCommand = new Command('doctor')
  .description('Diagnose common GraphQL Cascade issues')
  .action(async () => {
    console.log('Running diagnostics...\n');

    try {
      const results = await runDiagnostics();

      // Display results
      if (results.checks.length > 0) {
        console.log('✓ Checks passed:');
        results.checks.forEach(check => {
          console.log(`  - ${check}`);
        });
        console.log();
      }

      if (results.warnings.length > 0) {
        console.log('⚠ Warnings:');
        results.warnings.forEach(warning => {
          console.log(`  - ${warning}`);
        });
        console.log();
      }

      if (results.errors.length > 0) {
        console.log('✗ Errors:');
        results.errors.forEach(error => {
          console.log(`  - ${error}`);
        });
        console.log();
      }

      const healthScore = Math.round(
        (results.checks.length / (results.checks.length + results.errors.length)) * 100
      );

      console.log(`Health Score: ${healthScore}/100`);

      if (results.errors.length > 0) {
        process.exit(1);
      }

    } catch (error) {
      console.error('Failed to run diagnostics:', error);
      process.exit(1);
    }
  });