import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  findCorruption,
  checkVersionConsistency,
  checkReferenceSchema,
  checkSnippets,
  checkRequirements,
} from "./check-spec.mjs";

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

const REFERENCE = `
"""An entity."""
interface Node {
  id: ID!
}

"""An updated entity."""
type UpdatedEntity {
  "Type name of the entity."
  typename: String!
  id: ID!
  entity: Node!
}

enum Color {
  RED
  GREEN
}

type Query {
  node(id: ID!): Node
}
`;

describe("checkReferenceSchema", () => {
  it("accepts a valid schema", () => {
    assert.deepEqual(checkReferenceSchema(REFERENCE), []);
  });

  it("accepts a schema without a Query root, which implementers provide", () => {
    const withoutQuery = REFERENCE.slice(0, REFERENCE.indexOf("type Query"));
    assert.deepEqual(checkReferenceSchema(withoutQuery), []);
  });

  it("reports syntax errors", () => {
    assert.match(
      checkReferenceSchema("type Query {")[0],
      /^reference\/cascade_base\.graphql: Syntax Error/,
    );
  });

  it("reports invalid schemas, such as reserved __ names", () => {
    const problems = checkReferenceSchema(
      REFERENCE.replace("typename: String!", "__typename: String!"),
    );
    assert.equal(problems.length, 1);
    assert.match(problems[0], /"__typename" must not begin with "__"/);
  });
});

const chapter = (graphql) => ({
  path: "specification/99_test.md",
  content: `# Title\n\nText\n\n\`\`\`graphql\n${graphql}\n\`\`\`\n`,
});

describe("checkSnippets", () => {
  it("accepts snippets that match the reference, ignoring descriptions", () => {
    const snippet = `
      """Differently worded."""
      type UpdatedEntity {
        typename: String!
        id: ID!
        entity: Node!
      }`;
    assert.deepEqual(checkSnippets(REFERENCE, [chapter(snippet)]), []);
  });

  it("ignores types the reference does not define, and operations", () => {
    const snippet = `
      type CreateUserCascade { id: ID! }
      mutation { createUser { id } }`;
    assert.deepEqual(checkSnippets(REFERENCE, [chapter(snippet)]), []);
  });

  it("ignores root operation types, which implementers own", () => {
    const snippet = `type Query { me: Node }`;
    assert.deepEqual(checkSnippets(REFERENCE, [chapter(snippet)]), []);
  });

  it("reports snippets that do not parse, with their line", () => {
    assert.deepEqual(checkSnippets(REFERENCE, [chapter("type {")]), [
      'specification/99_test.md:5: graphql block does not parse: Syntax Error: Expected Name, found "{".',
    ]);
  });

  it("reports field definitions with reserved __ names", () => {
    const snippet = `type Example {
  __typename: String!
}`;
    assert.deepEqual(checkSnippets(REFERENCE, [chapter(snippet)]), [
      'specification/99_test.md:5: Example.__typename: names beginning with "__" are reserved by GraphQL',
    ]);
  });

  it("reports definitions that differ from the reference", () => {
    const snippet = `enum Color {
  RED
}`;
    assert.deepEqual(checkSnippets(REFERENCE, [chapter(snippet)]), [
      "specification/99_test.md:5: Color differs from reference/cascade_base.graphql",
    ]);
  });
});

const spec = (content) => ({ path: "specification/99_test.md", content });
const testCase = (id, requirement) => ({
  path: `conformance-tests/${id}.json`,
  content: JSON.stringify({ id, requirement }),
});

describe("checkRequirements", () => {
  const specFiles = [
    spec("- **[REQ-001]** Servers MUST track creations.\n"),
    spec("Text.\n\n- **[REQ-002]** Clients MUST apply updates.\n"),
  ];

  it("accepts requirements that are defined once and each tested", () => {
    const cases = [testCase("TC-1", "REQ-001"), testCase("TC-2", "REQ-002")];
    assert.deepEqual(checkRequirements(specFiles, cases), []);
  });

  it("reports cases citing undefined requirements", () => {
    const cases = [
      testCase("TC-1", "REQ-001"),
      testCase("TC-2", "REQ-002"),
      testCase("TC-3", "REQ-999"),
    ];
    assert.deepEqual(checkRequirements(specFiles, cases), [
      "conformance-tests/TC-3.json: REQ-999 is not defined in the specification",
    ]);
  });

  it("reports requirements no case tests", () => {
    assert.deepEqual(
      checkRequirements(specFiles, [testCase("TC-1", "REQ-001")]),
      ["specification/99_test.md:3: REQ-002 has no conformance case"],
    );
  });

  it("reports requirements defined twice", () => {
    const twice = [...specFiles, spec("- **[REQ-001]** Again.\n")];
    const cases = [testCase("TC-1", "REQ-001"), testCase("TC-2", "REQ-002")];
    assert.deepEqual(checkRequirements(twice, cases), [
      "specification/99_test.md:1: REQ-001 is already defined at specification/99_test.md:1",
    ]);
  });
});
