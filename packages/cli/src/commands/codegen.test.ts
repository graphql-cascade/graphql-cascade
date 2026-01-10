import { codegenCommand, codegenInitCommand } from "./codegen";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";

jest.mock("fs");
jest.mock("child_process");

const mockFs = fs as jest.Mocked<typeof fs>;
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

describe("codegenCommand", () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    processExitSpy = jest.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as any);

    // Default mock implementations
    mockFs.existsSync.mockReturnValue(true);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe("success path", () => {
    it("should execute graphql-codegen with default config", async () => {
      mockFs.existsSync.mockReturnValue(true);
      const mockProcess = {
        on: jest.fn((event, callback) => {
          if (event === "exit") callback(0);
        }),
      };
      mockSpawn.mockReturnValue(mockProcess as any);

      await codegenCommand.parseAsync(["node", "test", "codegen"]);

      expect(mockSpawn).toHaveBeenCalledWith(
        "npx",
        ["graphql-codegen", "--config", "codegen.yml"],
        expect.any(Object),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith("🔄 Generating types...\n");
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("✅ Code generation complete!"),
      );
    });

    it("should pass --watch flag when watch option is enabled", async () => {
      mockFs.existsSync.mockReturnValue(true);
      const mockProcess = {
        on: jest.fn((event, callback) => {
          if (event === "exit") callback(0);
        }),
      };
      mockSpawn.mockReturnValue(mockProcess as any);

      await codegenCommand.parseAsync(["node", "test", "codegen", "--watch"]);

      expect(mockSpawn).toHaveBeenCalledWith(
        "npx",
        expect.arrayContaining([
          "graphql-codegen",
          "--config",
          "codegen.yml",
          "--watch",
        ]),
        expect.any(Object),
      );
    });

    it("should use custom config path when provided", async () => {
      mockFs.existsSync.mockReturnValue(true);
      const mockProcess = {
        on: jest.fn((event, callback) => {
          if (event === "exit") callback(0);
        }),
      };
      mockSpawn.mockReturnValue(mockProcess as any);

      await codegenCommand.parseAsync([
        "node",
        "test",
        "codegen",
        "--config",
        "custom.yml",
      ]);

      expect(mockSpawn).toHaveBeenCalledWith(
        "npx",
        expect.arrayContaining([
          "graphql-codegen",
          "--config",
          "custom.yml",
        ]),
        expect.any(Object),
      );
    });

    it("should not show completion message in watch mode", async () => {
      mockFs.existsSync.mockReturnValue(true);
      const mockProcess = {
        on: jest.fn((event, callback) => {
          if (event === "exit") callback(0);
        }),
      };
      mockSpawn.mockReturnValue(mockProcess as any);

      await codegenCommand.parseAsync(["node", "test", "codegen", "--watch"]);

      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("✅ Code generation complete!"),
      );
    });
  });

  describe("error paths", () => {
    it("should error when config file not found", async () => {
      mockFs.existsSync.mockReturnValue(false);

      await expect(
        codegenCommand.parseAsync(["node", "test", "codegen"]),
      ).rejects.toThrow("process.exit called");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("❌ Config file not found"),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it("should handle spawn error", async () => {
      mockFs.existsSync.mockReturnValue(true);
      const mockProcess = {
        on: jest.fn((event, callback) => {
          if (event === "error") {
            callback(new Error("ENOENT: command not found"));
          }
        }),
      };
      mockSpawn.mockReturnValue(mockProcess as any);

      await expect(
        codegenCommand.parseAsync(["node", "test", "codegen"]),
      ).rejects.toThrow("process.exit called");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("❌ Failed to start codegen process"),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it("should handle non-zero exit code", async () => {
      mockFs.existsSync.mockReturnValue(true);
      const mockProcess = {
        on: jest.fn((event, callback) => {
          if (event === "exit") callback(1);
        }),
      };
      mockSpawn.mockReturnValue(mockProcess as any);

      await expect(
        codegenCommand.parseAsync(["node", "test", "codegen"]),
      ).rejects.toThrow("process.exit called");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("❌ Code generation failed"),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it("should handle spawn exception", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockSpawn.mockImplementation(() => {
        throw new Error("Failed to spawn process");
      });

      await expect(
        codegenCommand.parseAsync(["node", "test", "codegen"]),
      ).rejects.toThrow("process.exit called");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("❌ Code generation failed"),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("process.cwd", () => {
    it("should use current working directory for config resolution", async () => {
      const cwdSpy = jest.spyOn(process, "cwd").mockReturnValue("/test/dir");
      mockFs.existsSync.mockReturnValue(true);
      const mockProcess = {
        on: jest.fn((event, callback) => {
          if (event === "exit") callback(0);
        }),
      };
      mockSpawn.mockReturnValue(mockProcess as any);

      await codegenCommand.parseAsync(["node", "test", "codegen"]);

      expect(mockFs.existsSync).toHaveBeenCalledWith(
        expect.stringContaining("/test/dir"),
      );
      cwdSpy.mockRestore();
    });
  });
});

describe("codegenInitCommand", () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    processExitSpy = jest.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as any);

    mockFs.existsSync.mockReturnValue(false);
    mockFs.writeFileSync.mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe("success path", () => {
    it("should create codegen.yml with default options", async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.writeFileSync.mockImplementation();

      await codegenInitCommand.parseAsync(["node", "test", "init"]);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining("codegen.yml"),
        expect.stringContaining("schema: http://localhost:4000/graphql"),
        "utf-8",
      );
      expect(consoleLogSpy).toHaveBeenCalledWith("✅ Created codegen.yml");
    });

    it("should create codegen.yml with custom schema path", async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.writeFileSync.mockImplementation();

      await codegenInitCommand.parseAsync([
        "node",
        "test",
        "init",
        "--schema",
        "./schema.graphql",
      ]);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining("codegen.yml"),
        expect.stringContaining("schema: ./schema.graphql"),
        "utf-8",
      );
    });

    it("should create codegen.yml with custom documents pattern", async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.writeFileSync.mockImplementation();

      await codegenInitCommand.parseAsync([
        "node",
        "test",
        "init",
        "--documents",
        "./gql/**/*.ts",
      ]);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining("codegen.yml"),
        expect.stringContaining("documents: ./gql/**/*.ts"),
        "utf-8",
      );
    });

    it("should create codegen.yml with custom output path", async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.writeFileSync.mockImplementation();

      await codegenInitCommand.parseAsync([
        "node",
        "test",
        "init",
        "--output",
        "./types/graphql.ts",
      ]);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining("codegen.yml"),
        expect.stringContaining("./types/graphql.ts"),
        "utf-8",
      );
    });

    it("should display next steps after creation", async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.writeFileSync.mockImplementation();

      await codegenInitCommand.parseAsync(["node", "test", "init"]);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Next steps"),
      );
    });
  });

  describe("error paths", () => {
    it("should error when codegen.yml already exists", async () => {
      mockFs.existsSync.mockReturnValue(true);

      await expect(
        codegenInitCommand.parseAsync(["node", "test", "init"]),
      ).rejects.toThrow("process.exit called");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("❌ codegen.yml already exists"),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it("should handle write file errors", async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.writeFileSync.mockImplementation(() => {
        throw new Error("EACCES: permission denied");
      });

      await expect(
        codegenInitCommand.parseAsync(["node", "test", "init"]),
      ).rejects.toThrow("process.exit called");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("❌ Failed to create codegen.yml"),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("config content validation", () => {
    it("should include skipTypename: false in config", async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.writeFileSync.mockImplementation();

      await codegenInitCommand.parseAsync(["node", "test", "init"]);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining("codegen.yml"),
        expect.stringContaining("skipTypename: false"),
        "utf-8",
      );
    });

    it("should include enumsAsTypes: true in config", async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.writeFileSync.mockImplementation();

      await codegenInitCommand.parseAsync(["node", "test", "init"]);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining("codegen.yml"),
        expect.stringContaining("enumsAsTypes: true"),
        "utf-8",
      );
    });
  });
});
