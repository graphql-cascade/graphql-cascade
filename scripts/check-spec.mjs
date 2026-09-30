#!/usr/bin/env node
/**
 * Specification integrity checks.
 *
 * - No tracked file contains leaked tool-call transcript text.
 * - Every version stamp agrees with specification/VERSION, and the version
 *   has release notes.
 * - reference/cascade_base.graphql is a valid GraphQL schema, and is the
 *   normative source: every graphql block in the specification parses, and
 *   any definition of a reference type matches it (descriptions aside).
 * - Example schemas under examples/, merged with the reference, are valid
 *   GraphQL schemas and repeat reference types unchanged.
 * - Every requirement tagged **[REQ-NNN]** in the specification is defined
 *   once and tested by a conformance case, and every case cites a defined
 *   requirement.
 *
 * Usage: node scripts/check-spec.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  Kind,
  buildASTSchema,
  isTypeSystemDefinitionNode,
  parse,
  print,
  validateSchema,
  visit,
} from "graphql";

// Built from parts so this file never matches its own pattern.
const TRANSCRIPT_MARKER = ["xai", "function_call"].join(":");

const SEMVER = /^\d+\.\d+\.\d+$/;

const REFERENCE_PATH = "reference/cascade_base.graphql";
// The reference defines types for implementers' schemas, which own the Query root.
const MISSING_QUERY_ROOT = "Query root type must be provided.";
// Implementers own their root operation types; examples show their own.
const ROOT_TYPES = new Set(["Query", "Mutation", "Subscription"]);
const GRAPHQL_BLOCK = /^```graphql\n([\s\S]*?)^```/gm;

/**
 * @param {{ path: string, content: string }[]} files
 * @returns {string[]} one message per corrupted line
 */
export function findCorruption(files) {
  const problems = [];
  for (const { path, content } of files) {
    content.split("\n").forEach((line, index) => {
      if (line.includes(TRANSCRIPT_MARKER)) {
        problems.push(`${path}:${index + 1}: leaked tool-call transcript`);
      }
    });
  }
  return problems;
}

/**
 * @param {(path: string) => string} readFile reads a repo-relative path
 * @returns {string[]} one message per inconsistent stamp
 */
export function checkVersionConsistency(readFile) {
  const version = readFile("specification/VERSION").trim();
  if (!SEMVER.test(version)) {
    return [`specification/VERSION: "${version}" is not MAJOR.MINOR.PATCH`];
  }

  const problems = [];

  if (
    !readFile("specification/README.md").includes(`**Version**: ${version}`)
  ) {
    problems.push(`specification/README.md: expected **Version**: ${version}`);
  }

  const manifest = JSON.parse(readFile("conformance-tests/spec-version.json"));
  const declared = manifest.specification?.version;
  if (declared !== version) {
    problems.push(
      `conformance-tests/spec-version.json: specification.version is ${declared}, expected ${version}`,
    );
  }

  const history = readFile("specification/VERSIONING.md");
  if (
    !new RegExp(`^### v${version.replaceAll(".", "\\.")}\\b`, "m").test(history)
  ) {
    problems.push(
      `specification/VERSIONING.md: missing history entry ### v${version}`,
    );
  }

  if (!readFile("README.md").includes(`Specification-v${version}-`)) {
    problems.push(`README.md: expected badge Specification-v${version}`);
  }

  const releaseNotes = `releases/spec-v${version}.md`;
  try {
    readFile(releaseNotes);
  } catch {
    problems.push(`${releaseNotes}: missing release notes for ${version}`);
  }

  return problems;
}

/**
 * @param {string} sdl the reference schema
 * @returns {string[]} one message per syntax or schema validation error
 */
export function checkReferenceSchema(sdl) {
  try {
    const schema = buildASTSchema(parse(sdl), { assumeValidSDL: false });
    return validateSchema(schema)
      .filter((e) => e.message !== MISSING_QUERY_ROOT)
      .map((e) => `${REFERENCE_PATH}: ${e.message}`);
  } catch (e) {
    return [`${REFERENCE_PATH}: ${e.message}`];
  }
}

const withoutDescriptions = (node) =>
  visit(node, {
    leave: (n) =>
      n.description ? { ...n, description: undefined } : undefined,
  });

const RESERVED_NAME = 'names beginning with "__" are reserved by GraphQL';

/** Field definitions named with GraphQL's reserved `__` prefix. */
function reservedFields(document) {
  return document.definitions.flatMap((def) =>
    (def.fields ?? [])
      .filter((field) => field.name.value.startsWith("__"))
      .map((field) => ({
        name: `${def.name.value}.${field.name.value}`,
        line: field.loc.startToken.line,
      })),
  );
}

/**
 * Printed structure (descriptions aside) of each reference definition that
 * examples and excerpts must reproduce exactly; root types are exempt.
 */
function referenceShapes(document) {
  const shapes = new Map();
  for (const def of document.definitions) {
    if (def.name && !ROOT_TYPES.has(def.name.value)) {
      shapes.set(def.name.value, print(withoutDescriptions(def)));
    }
  }
  return shapes;
}

/**
 * Examples are validated the way implementers build schemas: merged with the
 * reference, whose types they may repeat but not change.
 *
 * @param {string} sdl the reference schema
 * @param {{ path: string, content: string }[]} files example GraphQL schemas
 * @returns {string[]} one message per reserved name, drift or schema error
 */
export function checkExampleSchemas(sdl, files) {
  const reference = parse(sdl);
  const shapes = referenceShapes(reference);
  return files.flatMap(({ path, content }) => {
    let document;
    try {
      document = parse(content);
    } catch (e) {
      return [`${path}: ${e.message}`];
    }
    const reserved = reservedFields(document);
    if (reserved.length > 0) {
      return reserved.map(
        ({ name, line }) => `${path}:${line}: ${name}: ${RESERVED_NAME}`,
      );
    }

    const own = new Set();
    const drift = [];
    for (const def of document.definitions) {
      if (!isTypeSystemDefinitionNode(def) || !def.name) continue;
      own.add(def.name.value);
      const expected = shapes.get(def.name.value);
      if (expected && print(withoutDescriptions(def)) !== expected) {
        drift.push(
          `${path}:${def.loc.startToken.line}: ${def.name.value} differs from ${REFERENCE_PATH}`,
        );
      }
    }
    if (drift.length > 0) return drift;

    const merged = {
      kind: Kind.DOCUMENT,
      definitions: [
        ...reference.definitions.filter(
          (def) => !(def.name && own.has(def.name.value)),
        ),
        ...document.definitions,
      ],
    };
    try {
      return validateSchema(
        buildASTSchema(merged, { assumeValidSDL: false }),
      ).map((e) => `${path}: ${e.message}`);
    } catch (e) {
      return [`${path}: ${e.message}`];
    }
  });
}

/**
 * @param {string} sdl the reference schema
 * @param {{ path: string, content: string }[]} files specification Markdown
 * @returns {string[]} one message per unparseable block or drifted definition
 */
export function checkSnippets(sdl, files) {
  const reference = referenceShapes(parse(sdl));

  const problems = [];
  for (const { path, content } of files) {
    for (const match of content.matchAll(GRAPHQL_BLOCK)) {
      const where = `${path}:${content.slice(0, match.index).split("\n").length}`;
      let document;
      try {
        document = parse(match[1]);
      } catch (e) {
        problems.push(`${where}: graphql block does not parse: ${e.message}`);
        continue;
      }
      for (const { name } of reservedFields(document)) {
        problems.push(`${where}: ${name}: ${RESERVED_NAME}`);
      }
      for (const def of document.definitions) {
        const expected =
          isTypeSystemDefinitionNode(def) &&
          def.name &&
          reference.get(def.name.value);
        if (expected && print(withoutDescriptions(def)) !== expected) {
          problems.push(
            `${where}: ${def.name.value} differs from ${REFERENCE_PATH}`,
          );
        }
      }
    }
  }
  return problems;
}

const REQUIREMENT_TAG = /\*\*\[(REQ-\d{3})\]\*\*/g;

/**
 * @param {{ path: string, content: string }[]} specFiles specification Markdown
 * @param {{ path: string, content: string }[]} caseFiles conformance cases
 * @returns {string[]} one message per broken link between spec and cases
 */
export function checkRequirements(specFiles, caseFiles) {
  const problems = [];
  const defined = new Map();
  for (const { path, content } of specFiles) {
    for (const match of content.matchAll(REQUIREMENT_TAG)) {
      const where = `${path}:${content.slice(0, match.index).split("\n").length}`;
      if (defined.has(match[1])) {
        problems.push(
          `${where}: ${match[1]} is already defined at ${defined.get(match[1])}`,
        );
      } else {
        defined.set(match[1], where);
      }
    }
  }

  const tested = new Set();
  for (const { path, content } of caseFiles) {
    const { requirement } = JSON.parse(content);
    if (defined.has(requirement)) {
      tested.add(requirement);
    } else {
      problems.push(
        `${path}: ${requirement} is not defined in the specification`,
      );
    }
  }

  for (const [id, where] of defined) {
    if (!tested.has(id))
      problems.push(`${where}: ${id} has no conformance case`);
  }
  return problems;
}

function trackedTextFiles(root) {
  const paths = execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
  const files = [];
  for (const path of paths) {
    let buffer;
    try {
      buffer = readFileSync(new URL(path, root));
    } catch {
      continue; // deleted in the working tree
    }
    if (!buffer.includes(0))
      files.push({ path, content: buffer.toString("utf8") });
  }
  return files;
}

function main() {
  const root = new URL("../", import.meta.url);
  const readFile = (path) => readFileSync(new URL(path, root), "utf8");
  const files = trackedTextFiles(root);
  const specFiles = files.filter(
    ({ path }) => path.startsWith("specification/") && path.endsWith(".md"),
  );
  const caseFiles = files.filter(
    ({ path }) =>
      path.startsWith("conformance-tests/") &&
      path.endsWith(".json") &&
      !path.endsWith("test-case-schema.json") &&
      !path.endsWith("spec-version.json"),
  );
  const sdl = readFile(REFERENCE_PATH);
  const schemaProblems = checkReferenceSchema(sdl);
  const problems = [
    ...findCorruption(files),
    ...checkVersionConsistency(readFile),
    ...schemaProblems,
    ...(schemaProblems.length > 0 ? [] : checkSnippets(sdl, specFiles)),
    ...checkRequirements(specFiles, caseFiles),
    ...checkExampleSchemas(
      sdl,
      files.filter(
        ({ path }) => path.startsWith("examples/") && path.endsWith(".graphql"),
      ),
    ),
  ];
  if (problems.length > 0) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  console.log("Specification checks passed.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
