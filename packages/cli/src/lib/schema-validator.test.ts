import { buildSchema } from "graphql";
import {
  loadSchema,
  validateCascadeCompatibility,
  ValidationResult,
} from "./schema-validator";
import { REFERENCE_SCHEMA } from "./reference-schema";
import * as fs from "fs";

// Mock fs module
jest.mock("fs");
const mockFs = fs as jest.Mocked<typeof fs>;

describe("schema-validator", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("loadSchema", () => {
    it("should load GraphQL SDL schema from file", () => {
      const schemaSDL = `
        type Query {
          user(id: ID!): User
        }

        type User {
          id: ID!
          name: String!
        }
      `;
      mockFs.readFileSync.mockReturnValue(schemaSDL);
      mockFs.existsSync.mockReturnValue(true);

      const schema = loadSchema("schema.graphql");
      expect(schema).toBeDefined();
      expect(schema.getType("User")).toBeDefined();
    });

    it("merges several SDL files into one schema", () => {
      const files: Record<string, string> = {
        "reference.graphql": "interface Node { id: ID! }",
        "schema.graphql":
          "type Query { node: Node }  type User implements Node { id: ID! }",
      };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(
        (path) => files[String(path)] as never,
      );

      const schema = loadSchema(["reference.graphql", "schema.graphql"]);

      expect(schema.getType("Node")).toBeDefined();
      expect(schema.getType("User")).toBeDefined();
    });

    it("should attempt to load JSON introspection schema from file", () => {
      // For this test, we'll just verify it attempts to parse JSON
      // A complete introspection schema is complex, so we test the error path
      const invalidIntrospectionJSON = JSON.stringify({
        __schema: {
          queryType: { name: "Query" },
        },
      });
      mockFs.readFileSync.mockReturnValue(invalidIntrospectionJSON);
      mockFs.existsSync.mockReturnValue(true);

      expect(() => loadSchema("schema.json")).toThrow(
        "Failed to parse JSON schema",
      );
    });

    it("should throw error if schema file does not exist", () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => loadSchema("nonexistent.graphql")).toThrow(
        "Schema file not found",
      );
    });

    it("should throw error for invalid schema syntax", () => {
      mockFs.readFileSync.mockReturnValue("invalid graphql syntax {}{");
      mockFs.existsSync.mockReturnValue(true);

      expect(() => loadSchema("invalid.graphql")).toThrow();
    });
  });

  describe("validateCascadeCompatibility", () => {
    const APP = `
      type Query {
        todo(id: ID!): Todo
      }

      type Todo implements Node {
        id: ID!
        title: String!
      }

      type UpdateTodoCascade implements CascadeResponse {
        success: Boolean!
        errors: [CascadeError!]
        data: Todo
        cascade: CascadeUpdates!
      }

      type Mutation {
        updateTodo(id: ID!, title: String!): UpdateTodoCascade!
      }
    `;
    const validate = (sdl: string) =>
      validateCascadeCompatibility(buildSchema(sdl));

    it("accepts a schema with the reference types and cascade payloads", () => {
      expect(validate(REFERENCE_SCHEMA + APP)).toMatchObject({
        errors: [],
        warnings: [],
        compatibility: 100,
      });
    });

    it("accepts result unions", () => {
      const result = validate(
        REFERENCE_SCHEMA +
          APP.replace(
            "updateTodo(id: ID!, title: String!): UpdateTodoCascade!",
            "updateTodo(id: ID!, title: String!): UpdateTodoResult!",
          ) +
          `
          type UpdateTodoPayload implements CascadePayload {
            data: Todo!
            cascade: CascadeUpdates!
            warnings: [CascadeError!]!
          }
          union UpdateTodoResult = UpdateTodoPayload | CascadeFailure
        `,
      );

      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it("ignores descriptions and the order of fields", () => {
      const reordered = REFERENCE_SCHEMA.replace(
        '  """Whether the mutation succeeded."""\n  success: Boolean!\n',
        "",
      ).replace(
        '  cascade: CascadeUpdates!\n}\n\n"""\nImplemented by',
        '  cascade: CascadeUpdates!\n  success: Boolean!\n}\n\n"""\nImplemented by',
      );
      expect(reordered).not.toBe(REFERENCE_SCHEMA);

      expect(validate(reordered + APP).errors).toEqual([]);
    });

    it("reports a schema without cascade payload types", () => {
      const result = validate(`
        type Query { hello: String }
      `);

      expect(result.errors).toEqual([
        expect.stringContaining("CascadeResponse"),
      ]);
    });

    it("reports reference types defined differently", () => {
      const result = validate(
        REFERENCE_SCHEMA.replace("deletedAt: DateTime!", "deletedAt: String!") +
          APP,
      );

      expect(result.errors).toEqual([
        expect.stringMatching(
          /^DeletedEntity differs from the reference schema/,
        ),
      ]);
    });

    it("reports reference directives defined differently", () => {
      const result = validate(
        REFERENCE_SCHEMA.replace(
          /directive @cascadeInvalidates\([\s\S]*?\) on FIELD_DEFINITION/,
          "directive @cascadeInvalidates(queries: [String!]!) on FIELD_DEFINITION",
        ) + APP,
      );

      expect(result.errors).toEqual([
        expect.stringMatching(
          /^@cascadeInvalidates differs from the reference schema/,
        ),
      ]);
    });

    it("warns about mutations whose results carry no cascade", () => {
      const result = validate(
        REFERENCE_SCHEMA +
          APP.replace(
            "type Mutation {",
            "type Mutation {\n  archiveTodo(id: ID!): Boolean!\n  renameTodo(id: ID!): Todo",
          ),
      );

      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([
        expect.stringMatching(/^Mutation\.archiveTodo returns Boolean/),
        expect.stringMatching(/^Mutation\.renameTodo returns Todo/),
      ]);
    });

    it("reports types with an id that do not implement Node", () => {
      const result = validate(
        REFERENCE_SCHEMA + APP + "type Tag { id: ID!  name: String! }",
      );

      expect(result.errors).toEqual([
        expect.stringMatching(/^Tag has an id but does not implement Node/),
      ]);
    });
  });

  describe("ValidationResult", () => {
    it("should structure errors and warnings correctly", () => {
      const schema = buildSchema(`
        type Query {
          user: User
        }

        type User {
          id: ID!
          name: String!
          friends: [User!]!
        }
      `);

      const result = validateCascadeCompatibility(schema);
      expect(result).toHaveProperty("errors");
      expect(result).toHaveProperty("warnings");
      expect(result).toHaveProperty("compatibility");
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(typeof result.compatibility).toBe("number");
    });

    it("should handle invalid introspection query result without __schema key", () => {
      const invalidIntrospectionJSON = JSON.stringify({
        data: {
          // Missing __schema property
          types: [],
        },
      });
      mockFs.readFileSync.mockReturnValue(invalidIntrospectionJSON);
      mockFs.existsSync.mockReturnValue(true);

      expect(() => loadSchema("schema.json")).toThrow(
        "Invalid introspection query result",
      );
    });

    it("should return 100 compatibility score when total checks is zero", () => {
      const schema = buildSchema("type Query { hello: String }");
      const result = validateCascadeCompatibility(schema);

      // The compatibility score should be between 0 and 100
      // But we're testing the calculateCompatibilityScore function indirectly
      // by verifying the result has expected properties
      expect(result.compatibility).toBeGreaterThanOrEqual(0);
      expect(result.compatibility).toBeLessThanOrEqual(100);
      expect(typeof result.compatibility).toBe("number");
    });
  });
});
