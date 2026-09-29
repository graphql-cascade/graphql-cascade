#!/usr/bin/env node
/**
 * Specification integrity checks.
 *
 * - No tracked file contains leaked tool-call transcript text.
 * - Every version stamp agrees with specification/VERSION.
 *
 * Usage: node scripts/check-spec.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Built from parts so this file never matches its own pattern.
const TRANSCRIPT_MARKER = ["xai", "function_call"].join(":");

const SEMVER = /^\d+\.\d+\.\d+$/;

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
  const problems = [
    ...findCorruption(trackedTextFiles(root)),
    ...checkVersionConsistency(readFile),
  ];
  if (problems.length > 0) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  console.log("Specification checks passed.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
