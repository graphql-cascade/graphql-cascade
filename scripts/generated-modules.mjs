/**
 * Modules generated from the specification's artifacts, for the packages
 * that ship them. `pnpm run sync:generated` writes them; check:spec fails
 * when one is out of date.
 */

const HEADER = (source) => `/**
 * Generated from ${source} by \`pnpm run sync:generated\`; do not edit.
 */
`;

/**
 * @param {string[]} paths tracked files
 * @returns {string[]} the conformance case files, sorted
 */
export function caseFilePaths(paths) {
  return paths
    .filter(
      (path) =>
        path.startsWith("conformance-tests/") &&
        path.endsWith(".json") &&
        !path.endsWith("test-case-schema.json") &&
        !path.endsWith("spec-version.json"),
    )
    .sort();
}

/**
 * @type {{ path: string, render: (readFile: (path: string) => string, paths: string[]) => string }[]}
 */
export const GENERATED_MODULES = [
  {
    path: "packages/cli/src/lib/reference-schema.ts",
    render: (readFile) =>
      `${HEADER("reference/cascade_base.graphql")}export const REFERENCE_SCHEMA: string = ${JSON.stringify(
        readFile("reference/cascade_base.graphql"),
      )};
`,
  },
  {
    path: "packages/conformance/src/generated/cases.ts",
    render: (readFile, paths) =>
      `${HEADER("conformance-tests/")}import type { ConformanceCase } from "../cases";

export const REFERENCE_SCHEMA: string = ${JSON.stringify(readFile("reference/cascade_base.graphql"))};

export const DOMAIN_SCHEMA: string = ${JSON.stringify(readFile("conformance-tests/schema.graphql"))};

export const CASES: ConformanceCase[] = ${JSON.stringify(
        caseFilePaths(paths).map((path) => JSON.parse(readFile(path))),
      )} as ConformanceCase[];
`,
  },
];
