import { runDiagnostics } from "./diagnostics";
import * as fs from "fs";
import { execSync } from "child_process";

// Mock fs module
jest.mock("fs");
jest.mock("child_process");

const mockFs = fs as jest.Mocked<typeof fs>;
const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe("diagnostics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock package.json exists
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({
        dependencies: {
          "@graphql-cascade/client": "^0.1.0",
        },
      }),
    );
  });

  describe("cascade packages detection", () => {
    it("should detect installed cascade packages", async () => {
      const result = await runDiagnostics();
      expect(result.checks).toContain("@graphql-cascade/client is installed");
    });

    it("should error when no cascade packages found", async () => {
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          dependencies: {},
        }),
      );

      const result = await runDiagnostics();
      expect(result.errors).toContain(
        "No GraphQL Cascade packages found in dependencies",
      );
    });

    it("should warn when only some cascade packages installed", async () => {
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          dependencies: {
            "@graphql-cascade/apollo": "^0.1.0",
          },
        }),
      );

      const result = await runDiagnostics();
      expect(result.warnings).toContain(
        "Only some GraphQL Cascade packages installed - consider installing all client packages",
      );
    });

    it("should handle package.json read error", async () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error("Read failed");
      });

      const result = await runDiagnostics();
      expect(result.errors).toContain("Failed to read package.json");
    });

    it("should detect multiple cascade packages", async () => {
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          dependencies: {
            "@graphql-cascade/client": "^0.1.0",
            "@graphql-cascade/apollo": "^0.1.0",
            "@graphql-cascade/react-query": "^0.1.0",
          },
        }),
      );

      const result = await runDiagnostics();
      expect(result.checks).toContain("@graphql-cascade/client is installed");
      expect(result.checks).toContain("@graphql-cascade/apollo is installed");
      expect(result.checks).toContain(
        "@graphql-cascade/react-query is installed",
      );
    });
  });

  describe("package versions", () => {
    it("should error when node_modules not found", async () => {
      mockFs.existsSync.mockImplementation((path) => {
        if (path === "package.json") return true;
        if (path === "node_modules") return false;
        return true;
      });

      const result = await runDiagnostics();
      expect(result.errors).toContain(
        "node_modules not found - run npm install first",
      );
    });

    it("should handle npm list success", async () => {
      mockExecSync.mockReturnValue("@graphql-cascade/client@0.1.0");

      const result = await runDiagnostics();
      expect(result.checks).toContain("Package versions can be resolved");
    });

    it("should handle npm list failure gracefully", async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("npm list failed");
      });

      const result = await runDiagnostics();
      expect(result.checks).toContain("Package installation detected");
    });

    it("should warn when package version check fails", async () => {
      mockFs.existsSync.mockImplementation((path) => {
        if (path === "package.json") return true;
        if (path === "node_modules") return true;
        return false;
      });
      mockExecSync.mockImplementation(() => {
        throw new Error("npm list failed");
      });

      const result = await runDiagnostics();
      // Should not have the version check result
      expect(result.checks).toContain("Package installation detected");
    });
  });

  describe("configuration files", () => {
    it("should warn when no config file exists", async () => {
      mockFs.existsSync.mockImplementation((path) => {
        if (path === "package.json") return true;
        if (path === "node_modules") return true;
        return false;
      });

      const result = await runDiagnostics();
      expect(result.warnings).toContain(
        "No cascade configuration file found - consider creating cascade.config.ts",
      );
    });

    it("should detect cascade.config.ts", async () => {
      mockFs.existsSync.mockImplementation((path) => {
        if (path === "cascade.config.ts") return true;
        return true;
      });

      const result = await runDiagnostics();
      expect(result.checks).toContain(
        "Configuration file found: cascade.config.ts",
      );
    });

    it("should detect cascade.config.js", async () => {
      mockFs.existsSync.mockImplementation((path) => {
        if (path === "cascade.config.ts") return false;
        if (path === "cascade.config.js") return true;
        return true;
      });

      const result = await runDiagnostics();
      expect(result.checks).toContain(
        "Configuration file found: cascade.config.js",
      );
    });

    it("should detect graphql.config.js", async () => {
      mockFs.existsSync.mockImplementation((path) => {
        if (path === "cascade.config.ts") return false;
        if (path === "cascade.config.js") return false;
        if (path === "graphql.config.js") return true;
        return true;
      });

      const result = await runDiagnostics();
      expect(result.checks).toContain(
        "Configuration file found: graphql.config.js",
      );
    });

    it("should detect .graphqlrc", async () => {
      mockFs.existsSync.mockImplementation((path) => {
        if (path === "cascade.config.ts") return false;
        if (path === "cascade.config.js") return false;
        if (path === "graphql.config.js") return false;
        if (path === ".graphqlrc") return true;
        return true;
      });

      const result = await runDiagnostics();
      expect(result.checks).toContain("Configuration file found: .graphqlrc");
    });

    it("should warn when no schema file exists", async () => {
      mockFs.existsSync.mockImplementation((path) => {
        if (path === "package.json") return true;
        if (path === "node_modules") return true;
        return false;
      });

      const result = await runDiagnostics();
      expect(result.warnings).toContain(
        "No GraphQL schema file found - cascade works best with a schema file",
      );
    });

    it("should detect schema.graphql", async () => {
      mockFs.existsSync.mockImplementation((path) => {
        if (path === "schema.graphql") return true;
        return true;
      });

      const result = await runDiagnostics();
      expect(result.checks).toContain("Schema file found: schema.graphql");
    });
  });

  describe("TypeScript version", () => {
    it("should check TypeScript 5.0+", async () => {
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          dependencies: {
            "@graphql-cascade/client": "^0.1.0",
            typescript: "^5.0.0",
          },
        }),
      );

      const result = await runDiagnostics();
      expect(result.checks).toContain("TypeScript version 5.0.0 is compatible");
    });

    it("should check TypeScript 4.7+", async () => {
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          dependencies: {
            "@graphql-cascade/client": "^0.1.0",
            typescript: "^4.7.0",
          },
        }),
      );

      const result = await runDiagnostics();
      expect(result.checks).toContain("TypeScript version 4.7.0 is compatible");
    });

    it("should warn when TypeScript is outdated", async () => {
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          dependencies: {
            "@graphql-cascade/client": "^0.1.0",
            typescript: "^4.0.0",
          },
        }),
      );

      const result = await runDiagnostics();
      expect(result.warnings).toContain(
        "TypeScript 4.0.0 may be outdated. Recommended: >=4.7",
      );
    });

    it("should warn when TypeScript not found", async () => {
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          dependencies: {
            "@graphql-cascade/client": "^0.1.0",
          },
        }),
      );

      const result = await runDiagnostics();
      expect(result.warnings).toContain(
        "TypeScript not found - GraphQL Cascade works best with TypeScript",
      );
    });
  });

  describe("GraphQL version", () => {
    it("should check GraphQL 16+", async () => {
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          dependencies: {
            "@graphql-cascade/client": "^0.1.0",
            graphql: "^16.0.0",
          },
        }),
      );

      const result = await runDiagnostics();
      expect(result.checks).toContain("GraphQL version 16.0.0 is compatible");
    });

    it("should error when GraphQL version too old", async () => {
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          dependencies: {
            "@graphql-cascade/client": "^0.1.0",
            graphql: "^15.0.0",
          },
        }),
      );

      const result = await runDiagnostics();
      expect(result.errors).toContain(
        "GraphQL 15.0.0 is not supported. Required: >=16.0.0. Fix: npm install graphql@^16.0.0",
      );
    });

    it("should error when GraphQL not found", async () => {
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          dependencies: {
            "@graphql-cascade/client": "^0.1.0",
          },
        }),
      );

      const result = await runDiagnostics();
      expect(result.errors).toContain(
        "GraphQL package not found. Fix: npm install graphql@^16.0.0",
      );
    });
  });

  describe("peer dependencies", () => {
    it("should check Apollo Client peer dependency", async () => {
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          dependencies: {
            "@graphql-cascade/client-apollo": "^0.1.0",
            "@apollo/client": "^3.0.0",
          },
        }),
      );

      const result = await runDiagnostics();
      expect(result.checks).toContain("Apollo Client peer dependency found");
    });

    it("should error when Apollo Client peer dependency missing", async () => {
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          dependencies: {
            "@graphql-cascade/client-apollo": "^0.1.0",
          },
        }),
      );

      const result = await runDiagnostics();
      expect(result.errors).toContain(
        "@graphql-cascade/client-apollo requires @apollo/client. Fix: npm install @apollo/client",
      );
    });

    it("should check React Query peer dependency", async () => {
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          dependencies: {
            "@graphql-cascade/client-react-query": "^0.1.0",
            "@tanstack/react-query": "^4.0.0",
          },
        }),
      );

      const result = await runDiagnostics();
      expect(result.checks).toContain("React Query peer dependency found");
    });

    it("should check URQL peer dependency", async () => {
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          dependencies: {
            "@graphql-cascade/client-urql": "^0.1.0",
            urql: "^3.0.0",
          },
        }),
      );

      const result = await runDiagnostics();
      expect(result.checks).toContain("URQL peer dependency found");
    });

    it("should check Relay peer dependency", async () => {
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          dependencies: {
            "@graphql-cascade/client-relay": "^0.1.0",
            "react-relay": "^13.0.0",
          },
        }),
      );

      const result = await runDiagnostics();
      expect(result.checks).toContain("Relay peer dependency found");
    });

    it("should check server package graphql dependency", async () => {
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          dependencies: {
            "@graphql-cascade/server": "^0.1.0",
            graphql: "^16.0.0",
          },
        }),
      );

      const result = await runDiagnostics();
      expect(result.checks).toContain("GraphQL version 16.0.0 is compatible");
    });

    it("should error when server package missing graphql", async () => {
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          dependencies: {
            "@graphql-cascade/server": "^0.1.0",
          },
        }),
      );

      const result = await runDiagnostics();
      expect(result.errors).toContain(
        "@graphql-cascade/server requires graphql. Fix: npm install graphql@^16.0.0",
      );
    });
  });

  it("should error when no package.json exists", async () => {
    mockFs.existsSync.mockImplementation(() => false);

    const result = await runDiagnostics();
    expect(result.errors).toContain(
      "No package.json found - not in a Node.js project",
    );
  });
});
