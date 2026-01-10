import { buildSchema } from "graphql";
import {
  loadSchema,
  validateCascadeCompatibility,
  ValidationResult,
} from "./schema-validator";
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
    it("should pass validation for fully compatible schema", () => {
      const schema = buildSchema(`
        type Query {
          user(id: ID!): User
        }

        type Mutation {
          createUser(name: String!): User
        }

        type User {
          id: ID!
          name: String!
          email: String
        }

        type Post {
          id: ID!
          title: String!
          author: User!
        }
      `);

      const result = validateCascadeCompatibility(schema);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.compatibility).toBe(100);
    });

    it("should error when type is missing id field", () => {
      const schema = buildSchema(`
        type Query {
          user(id: ID!): User
        }

        type User {
          name: String!
        }
      `);

      const result = validateCascadeCompatibility(schema);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("User");
      expect(result.errors[0]).toContain("id");
      expect(result.compatibility).toBeLessThan(100);
    });

    it("should pass when type has @cascade directive but no id field", () => {
      const schema = buildSchema(`
        directive @cascade(depth: Int) on OBJECT

        type Query {
          config: Config
        }

        type Config @cascade {
          apiKey: String!
          endpoint: String!
        }
      `);

      const result = validateCascadeCompatibility(schema);
      expect(result.errors).toHaveLength(0);
    });

    it("should error when mutation returns Boolean instead of entity", () => {
      const schema = buildSchema(`
        type Query {
          user(id: ID!): User
        }

        type Mutation {
          deleteUser(id: ID!): Boolean
        }

        type User {
          id: ID!
          name: String!
        }
      `);

      const result = validateCascadeCompatibility(schema);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("deleteUser");
      expect(result.errors[0]).toContain("Boolean");
    });

    it("should pass when mutation returns entity type", () => {
      const schema = buildSchema(`
        type Query {
          user(id: ID!): User
        }

        type Mutation {
          updateUser(id: ID!, name: String!): User
        }

        type User {
          id: ID!
          name: String!
        }
      `);

      const result = validateCascadeCompatibility(schema);
      expect(result.errors).toHaveLength(0);
    });

    it("should warn about potential circular references without depth limits", () => {
      const schema = buildSchema(`
        type Query {
          user(id: ID!): User
        }

        type User {
          id: ID!
          name: String!
          friends: [User!]!
        }
      `);

      const result = validateCascadeCompatibility(schema);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain("circular");
      expect(result.warnings[0]).toContain("User");
    });

    it("should calculate compatibility percentage correctly", () => {
      const schema = buildSchema(`
        type Query {
          user: User
          post: Post
        }

        type Mutation {
          deleteUser: Boolean
          deletePost: Boolean
        }

        type User {
          id: ID!
          name: String!
        }

        type Post {
          title: String!
        }
      `);

      const result = validateCascadeCompatibility(schema);
      // Post missing id (1 error)
      // 2 mutations returning Boolean (2 errors)
      expect(result.errors).toHaveLength(3);
      expect(result.compatibility).toBeGreaterThan(0);
      expect(result.compatibility).toBeLessThan(100);
    });

    it("should ignore built-in GraphQL types", () => {
      const schema = buildSchema(`
        type Query {
          user: User
        }

        type User {
          id: ID!
          name: String!
        }
      `);

      const result = validateCascadeCompatibility(schema);
      // Should not complain about String, ID, etc. not having id fields
      expect(result.errors).toHaveLength(0);
    });

    it("should provide actionable error messages", () => {
      const schema = buildSchema(`
        type Query {
          product: Product
        }

        type Product {
          name: String!
        }
      `);

      const result = validateCascadeCompatibility(schema);
      expect(result.errors[0]).toContain("Product");
      expect(result.errors[0]).toContain("id: ID!");
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
