import { buildSchema, parse } from "graphql";
import { buildCascadeEntityFragment } from "../cascade-entity";

const schema = buildSchema(`
  interface Node { id: ID! }
  type Address { street: String city: String }
  type User implements Node {
    id: ID!
    name: String
    email: String
    address: Address
    posts(first: Int): [Post!]!
  }
  type Post implements Node {
    id: ID!
    title: String
    author: User
  }
  type Query {
    me: User
    post(id: ID!): Post
    node(id: ID!): Node
  }
  type Mutation { renamePost(id: ID!): Post }
`);

const docs = (...sources: string[]) =>
  sources.map((source) => ({ document: parse(source) }));

describe("buildCascadeEntityFragment", () => {
  it("selects, per entity type, the fields the documents read", () => {
    const fragment = buildCascadeEntityFragment(
      schema,
      docs(
        "query Me { me { id name address { city } } }",
        "query Post($id: ID!) { post(id: $id) { title author { name email } } }",
      ),
    );

    expect(fragment).toBe(`fragment CascadeEntity on Node {
  id
  ... on Post {
    title
    author {
      id
    }
  }
  ... on User {
    name
    email
    address {
      city
    }
  }
}
`);
  });

  it("merges selections across documents and fragments", () => {
    const fragment = buildCascadeEntityFragment(
      schema,
      docs(
        "fragment UserName on User { name }",
        "query A { me { ...UserName address { street } } }",
        "query B { me { address { city } } }",
      ),
    );

    expect(fragment).toContain(`  ... on User {
    name
    address {
      street
      city
    }
  }`);
  });

  it("applies selections on an interface to every entity that implements it", () => {
    const fragment = buildCascadeEntityFragment(
      schema,
      docs('query N { node(id: "1") { id ... on Post { title } } }'),
    );

    expect(fragment).toContain("... on Post {\n    title\n  }");
  });

  it("skips fields that take arguments, and its own fragment", () => {
    const fragment = buildCascadeEntityFragment(
      schema,
      docs(
        "query A { me { name posts(first: 3) { title } } }",
        "fragment CascadeEntity on Node { id ... on User { email } }",
      ),
    );

    expect(fragment).toContain("... on User {\n    name\n  }");
    expect(fragment).not.toContain("posts");
    expect(fragment).not.toContain("email");
  });

  it("honors a custom fragment name and interface", () => {
    const fragment = buildCascadeEntityFragment(
      schema,
      docs("query Me { me { name } }"),
      { fragmentName: "Entities" },
    );

    expect(fragment.startsWith("fragment Entities on Node {")).toBe(true);
  });
});

describe("plugin cascadeEntityFragment mode", () => {
  it("outputs only the fragment, for a .graphql target", () => {
    const { plugin } = require("../plugin");
    const documents = docs("query Me { me { name } }").map((d) => ({
      ...d,
      location: "me.graphql",
    }));

    const output = plugin(schema, documents, { cascadeEntityFragment: true });

    expect(output).toEqual({
      content: buildCascadeEntityFragment(schema, documents),
    });
  });
});
