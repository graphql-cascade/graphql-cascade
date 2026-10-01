import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  checkCaseOperations,
  checkGeneratedModules,
  findCorruption,
  checkVersionConsistency,
  checkReferenceSchema,
  checkSnippets,
  checkRequirements,
  checkExampleSchemas,
  checkDocImports,
  exportedNames,
  packageExports,
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
  "releases/spec-v1.1.0.md": "# Release notes\n",
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

  it("requires release notes for the current version", () => {
    const tree = { ...consistentTree };
    delete tree["releases/spec-v1.1.0.md"];
    assert.deepEqual(checkVersionConsistency(reader(tree)), [
      "releases/spec-v1.1.0.md: missing release notes for 1.1.0",
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

  it("ignores operations named like a reference type", () => {
    const snippet = `query UpdatedEntity { node(id: "1") { id } }`;
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

  it("reports selections of reserved __ fields other than introspection", () => {
    const snippet = `mutation { createTodo { __typename __cascade { updated { typename } } } }`;
    assert.deepEqual(checkSnippets(REFERENCE, [chapter(snippet)]), [
      'specification/99_test.md:5: selection __cascade: names beginning with "__" are reserved by GraphQL',
    ]);
  });

  describe("cascade selections", () => {
    const CASCADE_REFERENCE = `${REFERENCE}
      type CascadeUpdates { updated: [UpdatedEntity!]! count: Int! }`;
    const check = (snippet) =>
      checkSnippets(CASCADE_REFERENCE, [chapter(snippet)]);

    it("accepts selections that follow the reference types", () => {
      assert.deepEqual(
        check(
          `mutation { m { cascade { count updated { typename entity { id ... on User { name } } } } } }`,
        ),
        [],
      );
    });

    it("reports object fields selected without a selection set", () => {
      assert.deepEqual(
        check(`mutation { m { cascade { updated { typename entity } } } }`),
        [
          "specification/99_test.md:5: cascade selection UpdatedEntity.entity needs a selection set",
        ],
      );
    });

    it("reports scalar fields given a selection set", () => {
      assert.deepEqual(check(`mutation { m { cascade { count { x } } } }`), [
        "specification/99_test.md:5: cascade selection CascadeUpdates.count is a scalar and takes no selection set",
      ]);
    });

    it("reports fields the reference type does not have", () => {
      assert.deepEqual(check(`mutation { m { cascade { created { id } } } }`), [
        "specification/99_test.md:5: cascade selection CascadeUpdates.created does not exist",
      ]);
    });

    it("checks untagged operation strings in code blocks", () => {
      const doc = {
        path: "docs/page.md",
        content:
          "# Page\n\n```typescript\nclient.mutate(\n  `mutation { m { cascade { updated { entity } } } }`,\n);\n```\n",
      };
      assert.deepEqual(checkSnippets(CASCADE_REFERENCE, [doc]), [
        "docs/page.md:5: cascade selection UpdatedEntity.entity needs a selection set",
      ]);
    });

    it("checks subscription events against the reference Subscription type", () => {
      const withSubscription = `${CASCADE_REFERENCE}
        type CascadeUpdateEvent { entity: UpdatedEntity }
        type Subscription { cascadeUpdates: CascadeUpdateEvent! }`;
      assert.deepEqual(
        checkSnippets(withSubscription, [
          chapter(
            "subscription { cascadeUpdates { entity { typename entity } } }",
          ),
        ]),
        [
          "specification/99_test.md:5: cascade selection UpdatedEntity.entity needs a selection set",
        ],
      );
    });

    it("checks gql templates in code blocks", () => {
      const doc = {
        path: "docs/page.md",
        content:
          "# Page\n\n```typescript\nconst M = gql`\n  mutation { m { cascade { updated { entity } } } }\n`;\n```\n",
      };
      assert.deepEqual(checkSnippets(CASCADE_REFERENCE, [doc]), [
        "docs/page.md:4: cascade selection UpdatedEntity.entity needs a selection set",
      ]);
    });
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

describe("checkExampleSchemas", () => {
  const example = (content) => ({ path: "examples/schema.graphql", content });

  it("accepts an example that uses the reference types", () => {
    const app = `
      type Query { me: UpdatedEntity }
      type Mutation { touch: UpdatedEntity }`;
    assert.deepEqual(checkExampleSchemas(REFERENCE, [example(app)]), []);
  });

  it("accepts an example that repeats a reference type exactly", () => {
    const app = `
      type Query { me: UpdatedEntity }
      type UpdatedEntity { typename: String! id: ID! entity: Node! }`;
    assert.deepEqual(checkExampleSchemas(REFERENCE, [example(app)]), []);
  });

  it("reports reference types the example redefines differently", () => {
    const app = "type Query { me: Node }\nenum Color { RED }";
    assert.deepEqual(checkExampleSchemas(REFERENCE, [example(app)]), [
      "examples/schema.graphql:2: Color differs from reference/cascade_base.graphql",
    ]);
  });

  it("reports schema errors", () => {
    const app = `
      type Query { r: Result }
      interface Result { data: Int }
      type Impl implements Result { data: String }`;
    const problems = checkExampleSchemas(REFERENCE, [example(app)]);
    assert.equal(problems.length, 1);
    assert.match(
      problems[0],
      /^examples\/schema\.graphql: Interface field Result\.data expects type Int/,
    );
  });

  it("reports reserved __ field names", () => {
    const app = "type Query { id: ID }\ntype Extra {\n  __typename: String!\n}";
    assert.deepEqual(checkExampleSchemas(REFERENCE, [example(app)]), [
      'examples/schema.graphql:3: Extra.__typename: names beginning with "__" are reserved by GraphQL',
    ]);
  });

  it("reports schemas that do not parse", () => {
    assert.match(
      checkExampleSchemas(REFERENCE, [example("type {")])[0],
      /^examples\/schema\.graphql: Syntax Error/,
    );
  });
});

describe("exportedNames", () => {
  const tree = {
    "src/index.ts": [
      'export * from "./types";',
      'export { CascadeClient, applyCascade as apply } from "./client";',
      'export type { Options } from "./options";',
      "export const VERSION = '1';",
      "export default function main() {}",
    ].join("\n"),
    "src/types.ts": [
      "export interface UpdatedEntity {}",
      "export enum CascadeOperation { CREATED }",
      "export async function load() {}",
      "export abstract class Base {}",
      "export type Id = string;",
    ].join("\n"),
  };

  it("collects declarations, re-exports and export-star modules", () => {
    const names = exportedNames(reader(tree), "src/index.ts");
    assert.deepEqual([...names].sort(), [
      "Base",
      "CascadeClient",
      "CascadeOperation",
      "Id",
      "Options",
      "UpdatedEntity",
      "VERSION",
      "apply",
      "load",
    ]);
  });
});

describe("checkDocImports", () => {
  const packages = new Map([
    ["@graphql-cascade/client", new Set(["CascadeClient", "UpdatedEntity"])],
    ["@graphql-cascade/server", new Set(["CascadeTracker"])],
    ["@graphql-cascade/server/nestjs", new Set(["CascadeModule"])],
  ]);
  const doc = (code, lang = "typescript") => ({
    path: "docs/page.md",
    content: `# Page\n\n\`\`\`${lang}\n${code}\n\`\`\`\n`,
  });

  it("accepts imports of real exports", () => {
    const code = `import { CascadeClient, type UpdatedEntity as U } from "@graphql-cascade/client";`;
    assert.deepEqual(checkDocImports([doc(code)], packages), []);
  });

  it("ignores other packages and non-code text", () => {
    const code = `import { gql } from "@apollo/client";`;
    assert.deepEqual(
      checkDocImports([doc(code), doc(code, "text")], packages),
      [],
    );
  });

  it("reports names a package does not export", () => {
    const code = `const x = 1;\nimport {\n  CascadeClient,\n  getCascade,\n} from "@graphql-cascade/client";`;
    assert.deepEqual(checkDocImports([doc(code, "tsx")], packages), [
      "docs/page.md:5: @graphql-cascade/client does not export getCascade",
    ]);
  });

  it("checks imports from subpath entries", () => {
    const code = `import { CascadeModule, CascadeTracker } from "@graphql-cascade/server/nestjs";`;
    assert.deepEqual(checkDocImports([doc(code)], packages), [
      "docs/page.md:4: @graphql-cascade/server/nestjs does not export CascadeTracker",
    ]);
  });

  it("reports subpath entries a package does not have", () => {
    const code = `import { X } from "@graphql-cascade/server/koa";`;
    assert.deepEqual(checkDocImports([doc(code)], packages), [
      "docs/page.md:4: @graphql-cascade/server has no entry @graphql-cascade/server/koa",
    ]);
  });

  it("reports packages that do not exist", () => {
    const code = `import { X } from '@graphql-cascade/client-apollo';`;
    assert.deepEqual(checkDocImports([doc(code, "js")], packages), [
      "docs/page.md:4: @graphql-cascade/client-apollo is not a package in this repository",
    ]);
  });
});

describe("checkGeneratedModules", () => {
  const modules = [
    {
      path: "out.ts",
      render: (readFile) => `export const A = ${readFile("a.txt")};\n`,
    },
  ];
  const files = (out) => (path) => ({ "a.txt": "1", "out.ts": out })[path];

  it("accepts modules matching their sources", () => {
    assert.deepEqual(
      checkGeneratedModules(modules, files("export const A = 1;\n"), []),
      [],
    );
  });

  it("reports modules that differ from their sources", () => {
    assert.deepEqual(
      checkGeneratedModules(modules, files("export const A = 2;\n"), []),
      ["out.ts is out of date: run pnpm run sync:generated"],
    );
  });
});

describe("checkCaseOperations", () => {
  const reference = "interface Node { id: ID! }";
  const domain = `
    type Query { user(id: ID!): User }
    type User implements Node { id: ID! name: String! }
    type Mutation { renameUser(id: ID!, name: String!): User! }
  `;
  const serverCase = (operation) => ({
    path: "conformance-tests/server/rename.json",
    content: JSON.stringify({ category: "server", input: { operation } }),
  });

  it("accepts operations valid against the conformance domain", () => {
    assert.deepEqual(
      checkCaseOperations(reference, domain, [
        serverCase('mutation { renameUser(id: "1", name: "A") { id name } }'),
      ]),
      [],
    );
  });

  it("reports operations the domain does not support", () => {
    const problems = checkCaseOperations(reference, domain, [
      serverCase('mutation { renameUser(id: "1", name: "A") { id email } }'),
    ]);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /rename\.json: .*email/);
  });

  it("ignores client cases", () => {
    assert.deepEqual(
      checkCaseOperations(reference, domain, [
        {
          path: "conformance-tests/client/x.json",
          content: JSON.stringify({ category: "client", input: {} }),
        },
      ]),
      [],
    );
  });
});

describe("packageExports", () => {
  it("maps each entry of a package's exports to its source module's exports", () => {
    const manifest = JSON.stringify({
      name: "@graphql-cascade/server",
      main: "dist/index.js",
      exports: {
        ".": { types: "./dist/index.d.ts", default: "./dist/index.js" },
        "./nestjs": {
          types: "./dist/integrations/nestjs.d.ts",
          default: "./dist/integrations/nestjs.js",
        },
        "./package.json": "./package.json",
      },
    });
    const sources = {
      "packages/server/src/index.ts": "export const CascadeTracker = 1;",
      "packages/server/src/integrations/nestjs.ts":
        "export class CascadeModule {}",
    };

    const packages = packageExports(
      [{ path: "packages/server/package.json", content: manifest }],
      (path) => sources[path],
    );

    assert.deepEqual(
      [...packages].map(([specifier, names]) => [specifier, [...names]]),
      [
        ["@graphql-cascade/server", ["CascadeTracker"]],
        ["@graphql-cascade/server/nestjs", ["CascadeModule"]],
      ],
    );
  });

  it("follows nested conditions to an entry's JavaScript file", () => {
    const manifest = JSON.stringify({
      name: "@graphql-cascade/nuxt",
      main: "./dist/module.cjs",
      exports: {
        ".": {
          import: {
            types: "./dist/module.d.mts",
            default: "./dist/module.mjs",
          },
          require: {
            types: "./dist/module.d.cts",
            default: "./dist/module.cjs",
          },
        },
      },
    });

    const packages = packageExports(
      [{ path: "packages/nuxt/module/package.json", content: manifest }],
      (path) =>
        ({ "packages/nuxt/module/src/module.ts": "export const meta = 1;" })[
          path
        ],
    );

    assert.deepEqual(
      [...packages].map(([specifier, names]) => [specifier, [...names]]),
      [["@graphql-cascade/nuxt", ["meta"]]],
    );
  });
});
