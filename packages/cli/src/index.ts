#!/usr/bin/env node

import { Command } from 'commander';
import { doctorCommand } from './commands/doctor';

const program = new Command();

program
  .name('cascade')
  .description('CLI tool for GraphQL Cascade development')
  .version('0.1.0');

// Register commands
program.addCommand(doctorCommand);

program.parse();