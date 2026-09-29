import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { findCorruption, checkVersionConsistency } from "./check-spec.mjs";

// Built from parts so this file never matches the pattern it tests.
const MARKER = ["</xai", "function_call>"].join(":");

describe("findCorruption", () => {
  it("returns nothing for clean files", () => {
    const files = [{ path: "a.md", content: "# Title\n\nBody\n" }];
    assert.deepEqual(findCorruption(files), []);
  });

  it("reports the file and line of leaked tool-call transcript", () => {
    const files = [
      { path: "a.md", content: "ok\n" },
      { path: "b.py", content: `x = 1</content>\n${MARKER}\n` },
    ];
    assert.deepEqual(findCorruption(files), [
      "b.py:2: leaked tool-call transcript",
    ]);
  });
});

const consistentTree = {
  "specification/VERSION": "1.1.0\n",
  "specification/README.md": "- **Version**: 1.1.0\n",
  "specification/VERSIONING.md": "## Appendix\n\n### v1.1.0 (2025-12-04)\n",
  "conformance-tests/spec-version.json": JSON.stringify({
    specification: { version: "1.1.0" },
  }),
  "README.md":
    '<img src="https://img.shields.io/badge/Specification-v1.1.0-blue">',
};

const reader = (tree) => (path) => {
  if (!(path in tree)) throw new Error(`missing ${path}`);
  return tree[path];
};

describe("checkVersionConsistency", () => {
  it("accepts a tree where every stamp matches specification/VERSION", () => {
    assert.deepEqual(checkVersionConsistency(reader(consistentTree)), []);
  });

  it("rejects a VERSION file that is not semver", () => {
    const tree = { ...consistentTree, "specification/VERSION": "1.1\n" };
    assert.deepEqual(checkVersionConsistency(reader(tree)), [
      'specification/VERSION: "1.1" is not MAJOR.MINOR.PATCH',
    ]);
  });

  it("reports every stamp that disagrees", () => {
    const tree = {
      ...consistentTree,
      "specification/README.md": "- **Version**: 0.1 (Draft)\n",
      "conformance-tests/spec-version.json": JSON.stringify({
        specification: { version: "1.0.0" },
      }),
    };
    assert.deepEqual(checkVersionConsistency(reader(tree)), [
      "specification/README.md: expected **Version**: 1.1.0",
      "conformance-tests/spec-version.json: specification.version is 1.0.0, expected 1.1.0",
    ]);
  });

  it("requires a VERSIONING.md history entry for the current version", () => {
    const tree = {
      ...consistentTree,
      "specification/VERSIONING.md": "### v1.0.0\n",
    };
    assert.deepEqual(checkVersionConsistency(reader(tree)), [
      "specification/VERSIONING.md: missing history entry ### v1.1.0",
    ]);
  });

  it("requires the README badge to show the current version", () => {
    const tree = {
      ...consistentTree,
      "README.md": "badge/Specification-v1.1-blue",
    };
    assert.deepEqual(checkVersionConsistency(reader(tree)), [
      "README.md: expected badge Specification-v1.1.0",
    ]);
  });
});
