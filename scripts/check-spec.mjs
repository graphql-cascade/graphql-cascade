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
 * - Code in the READMEs and checked docs imports only real package exports,
 *   and its GraphQL follows the same rules as the specification's.
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
  REFERENCE_MODULE_PATH,
  renderReferenceModule,
} from "./reference-module.mjs";
import {
  Kind,
  buildASTSchema,
  getNamedType,
  isLeafType,
  isTypeSystemDefinitionNode,
  parse,
  print,
  validate,
  validateSchema,
  visit,
} from "graphql";

// Built from parts so this file never matches its own pattern.
const TRANSCRIPT_MARKER = ["xai", "function_call"].join(":");

const SEMVER = /^\d+\.\d+\.\d+$/;

const REFERENCE_PATH = "reference/cascade_base.graphql";

const CONFORMANCE_SCHEMA_PATH = "conformance-tests/schema.graphql";
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

const INTROSPECTION_FIELDS = new Set(["__typename", "__schema", "__type"]);

/** Selected fields named with the reserved `__` prefix, introspection aside. */
function reservedSelections(document) {
  const names = [];
  visit(document, {
    Field(node) {
      const name = node.name.value;
      if (name.startsWith("__") && !INTROSPECTION_FIELDS.has(name)) {
        names.push(name);
      }
    },
  });
  return names;
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
 * @param {string} domainSdl the conformance domain schema
 * @param {{ path: string, content: string }[]} caseFiles conformance cases
 * @returns {string[]} one message per server or transport case whose
 *   operation the conformance domain does not support
 */
export function checkCaseOperations(sdl, domainSdl, caseFiles) {
  const schema = buildASTSchema(
    {
      kind: Kind.DOCUMENT,
      definitions: [...parse(sdl).definitions, ...parse(domainSdl).definitions],
    },
    { assumeValidSDL: true },
  );
  return caseFiles.flatMap(({ path, content }) => {
    const { category, input } = JSON.parse(content);
    if (category === "client") return [];
    try {
      return validate(schema, parse(input.operation)).map(
        (e) => `${path}: ${e.message}`,
      );
    } catch (e) {
      return [`${path}: ${e.message}`];
    }
  });
}

/**
 * @param {string} sdl the reference schema
 * @param {(path: string) => string} readFile
 * @returns {string[]} a message when the shipped copy differs from the reference
 */
export function checkReferenceModule(sdl, readFile) {
  return readFile(REFERENCE_MODULE_PATH) === renderReferenceModule(sdl)
    ? []
    : [
        `${REFERENCE_MODULE_PATH} differs from ${REFERENCE_PATH}: run pnpm run sync:reference`,
      ];
}

/**
 * @param {string} sdl the reference schema
 * @param {{ path: string, content: string }[]} files specification Markdown
 * @returns {string[]} one message per unparseable block or drifted definition
 */
export function checkSnippets(sdl, files) {
  const reference = referenceShapes(parse(sdl));
  const schema = buildASTSchema(parse(sdl), { assumeValidSDL: true });

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
      for (const name of reservedSelections(document)) {
        problems.push(`${where}: selection ${name}: ${RESERVED_NAME}`);
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
      problems.push(...checkCascadeSelections(schema, document, where));
    }
    for (const block of content.matchAll(CODE_BLOCK)) {
      const codeStart = block.index + block[0].indexOf("\n") + 1;
      for (const template of block[1].matchAll(GQL_TEMPLATE)) {
        const line = content
          .slice(0, codeStart + template.index)
          .split("\n").length;
        let document;
        try {
          document = parse(template[1].replace(/\$\{[^}]*\}/g, ""));
        } catch {
          continue; // partial documents in prose examples
        }
        problems.push(
          ...checkCascadeSelections(schema, document, `${path}:${line}`),
        );
      }
    }
  }
  return problems;
}

/** GraphQL in code: tagged templates, or plain strings holding an operation. */
const GQL_TEMPLATE =
  /(?:\b(?:gql|graphql))?`(\s*(?:mutation|query|subscription|fragment)\b[^`]*)`/g;

/**
 * Validate every `cascade { … }` selection against the reference's
 * CascadeUpdates: fields exist, object fields have a selection set and
 * scalars do not. Fragments on application types are not checked.
 */
function checkCascadeSelections(schema, document, where) {
  const root = schema.getType("CascadeUpdates");
  if (!root) return [];
  const fragments = new Map(
    document.definitions
      .filter((def) => def.kind === Kind.FRAGMENT_DEFINITION)
      .map((def) => [def.name.value, def]),
  );
  const problems = [];
  const check = (type, selectionSet, seen) => {
    for (const selection of selectionSet.selections) {
      if (selection.kind === Kind.FIELD) {
        const name = selection.name.value;
        if (name === "__typename") continue;
        const field = type.getFields()[name];
        if (!field) {
          problems.push(
            `${where}: cascade selection ${type.name}.${name} does not exist`,
          );
          continue;
        }
        const named = getNamedType(field.type);
        if (isLeafType(named)) {
          if (selection.selectionSet) {
            problems.push(
              `${where}: cascade selection ${type.name}.${name} is a scalar and takes no selection set`,
            );
          }
        } else if (!selection.selectionSet) {
          problems.push(
            `${where}: cascade selection ${type.name}.${name} needs a selection set`,
          );
        } else {
          check(named, selection.selectionSet, seen);
        }
      } else {
        const fragment =
          selection.kind === Kind.FRAGMENT_SPREAD
            ? fragments.get(selection.name.value)
            : selection;
        if (!fragment || seen.has(fragment)) continue;
        const condition = fragment.typeCondition?.name.value;
        const target = condition ? schema.getType(condition) : type;
        if (target && "getFields" in target) {
          check(target, fragment.selectionSet, new Set([...seen, fragment]));
        }
      }
    }
  };
  // Subscription fields the reference defines, such as cascadeUpdates
  const subscriptionFields = schema.getSubscriptionType()?.getFields() ?? {};
  for (const def of document.definitions) {
    if (
      def.kind !== Kind.OPERATION_DEFINITION ||
      def.operation !== "subscription"
    ) {
      continue;
    }
    for (const selection of def.selectionSet.selections) {
      const field =
        selection.kind === Kind.FIELD &&
        subscriptionFields[selection.name.value];
      if (field && selection.selectionSet) {
        check(getNamedType(field.type), selection.selectionSet, new Set());
      }
    }
  }
  visit(document, {
    Field(node) {
      if (node.name.value === "cascade" && node.selectionSet) {
        check(root, node.selectionSet, new Set());
        return false;
      }
      return undefined;
    },
  });
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

const DECLARATION =
  /export\s+(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:const|let|var|function\*?|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;
const NAMED_EXPORT =
  /export\s+(?:type\s+)?\{([^}]*)\}(?:\s*from\s*["']([^"']+)["'])?/g;
const STAR_EXPORT =
  /export\s*\*\s*(?:as\s+([\w$]+)\s*)?from\s*["']([^"']+)["']/g;

/**
 * Names in an import or export list. For `a as b`, exports list `b` (the
 * name others see) and imports list `a` (the name the module exports).
 */
function listedNames(list, side = "exported") {
  return list
    .split(",")
    .map((item) => item.trim().replace(/^type\s+/, ""))
    .filter(Boolean)
    .map((item) => {
      const [original, alias] = item.split(/\s+as\s+/);
      return (side === "imported" ? original : (alias ?? original)).trim();
    });
}

function resolveModule(readFile, from, specifier) {
  const base = `${from.slice(0, from.lastIndexOf("/") + 1)}${specifier.replace(/^\.\//, "")}`;
  for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
    try {
      readFile(candidate);
      return candidate;
    } catch {
      // try the next candidate
    }
  }
  return undefined;
}

/**
 * Names a TypeScript module exports, following `export * from` locally.
 *
 * @param {(path: string) => string} readFile reads a repo-relative path
 * @param {string} entry the module to start from, e.g. "packages/x/src/index.ts"
 * @returns {Set<string>}
 */
export function exportedNames(readFile, entry, seen = new Set()) {
  const names = new Set();
  if (seen.has(entry)) return names;
  seen.add(entry);
  const source = readFile(entry);
  for (const [, name] of source.matchAll(DECLARATION)) names.add(name);
  for (const [, list] of source.matchAll(NAMED_EXPORT)) {
    for (const name of listedNames(list)) names.add(name);
  }
  for (const [, alias, specifier] of source.matchAll(STAR_EXPORT)) {
    if (alias) {
      names.add(alias);
      continue;
    }
    const module = specifier.startsWith(".")
      ? resolveModule(readFile, entry, specifier)
      : undefined;
    if (module) {
      for (const name of exportedNames(readFile, module, seen)) names.add(name);
    }
  }
  return names;
}

const CODE_BLOCK =
  /^```(?:ts|typescript|tsx|js|javascript|jsx)\b[^\n]*\n([\s\S]*?)^```/gm;
const PACKAGE_IMPORT =
  /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["'](@graphql-cascade\/[^"']+)["']/g;

/**
 * @param {{ path: string, content: string }[]} files documentation Markdown
 * @param {Map<string, Set<string>>} packages exports of each package by name
 * @returns {string[]} one message per import of a missing package or export
 */
export function checkDocImports(files, packages) {
  const problems = [];
  for (const { path, content } of files) {
    for (const block of content.matchAll(CODE_BLOCK)) {
      const codeStart = block.index + block[0].indexOf("\n") + 1;
      for (const match of block[1].matchAll(PACKAGE_IMPORT)) {
        const line = content
          .slice(0, codeStart + match.index)
          .split("\n").length;
        const specifier = match[2];
        const packageName = specifier.split("/").slice(0, 2).join("/");
        const exports = packages.get(packageName);
        if (!exports) {
          problems.push(
            `${path}:${line}: ${packageName} is not a package in this repository`,
          );
          continue;
        }
        if (specifier !== packageName) continue; // subpath exports
        for (const name of listedNames(match[1], "imported")) {
          if (!exports.has(name)) {
            problems.push(
              `${path}:${line}: ${packageName} does not export ${name}`,
            );
          }
        }
      }
    }
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

/**
 * Documentation whose code must match the packages and the reference schema.
 */
const CHECKED_DOCS = [
  /^README\.md$/,
  /^packages\/.+\/README\.md$/,
  /^docs\/.+\.md$/,
];

/** Exported names of every package, keyed by package name. */
function packageExports(files, readFile) {
  const packages = new Map();
  for (const { path, content } of files) {
    if (!/^packages\/(?:[^/]+\/)?[^/]+\/package\.json$/.test(path)) continue;
    const { name, main } = JSON.parse(content);
    if (!name || !main) continue;
    const dir = path.slice(0, -"package.json".length);
    const entry = `${dir}${main.replace(/^(\.\/)?dist\//, "src/").replace(/\.m?js$/, ".ts")}`;
    try {
      packages.set(name, exportedNames(readFile, entry));
    } catch {
      packages.set(name, new Set());
    }
  }
  return packages;
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
  const docFiles = files.filter(({ path }) =>
    CHECKED_DOCS.some((pattern) => pattern.test(path)),
  );
  const sdl = readFile(REFERENCE_PATH);
  const schemaProblems = checkReferenceSchema(sdl);
  const problems = [
    ...findCorruption(files),
    ...checkVersionConsistency(readFile),
    ...schemaProblems,
    ...(schemaProblems.length > 0 ? [] : checkSnippets(sdl, specFiles)),
    ...checkRequirements(specFiles, caseFiles),
    ...(schemaProblems.length > 0
      ? []
      : checkCaseOperations(sdl, readFile(CONFORMANCE_SCHEMA_PATH), caseFiles)),
    ...(schemaProblems.length > 0 ? [] : checkSnippets(sdl, docFiles)),
    ...checkDocImports(docFiles, packageExports(files, readFile)),
    ...checkReferenceModule(sdl, readFile),
    ...checkExampleSchemas(
      sdl,
      files.filter(
        ({ path }) =>
          (path.startsWith("examples/") || path === CONFORMANCE_SCHEMA_PATH) &&
          path.endsWith(".graphql"),
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
