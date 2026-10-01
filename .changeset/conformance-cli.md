---
"@graphql-cascade/conformance": minor
---

**Breaking:** the conformance package tests implementations, through the specification's cases only.

- Removed the level runners (`runServerConformance`, `runClientConformance`, `runBasicTests`, `runStandardTests`, `runCompleteTests` and the client equivalents), the bundled fixtures, `validateSchema` and `validateResponse`. They tested the package's own fixtures and a built-in mock server instead of the implementation; use `runServerCases` and `runClientCases`, and `cascade validate` for schemas.
- `summarize(results)` gives the level achieved; `formatReport(results, { format })` prints console, JSON or Markdown reports; `getExitCode(results, level?)` fails CI on cases up to a level.
- `cascade-conformance --config <file>` runs the server and client a configuration file exports, with `--target`, `--level`, `--format`, `--verbose` and `--no-colors`.
- The package has no runtime dependencies.
