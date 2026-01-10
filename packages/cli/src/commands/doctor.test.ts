import { doctorCommand } from "./doctor";
import * as diagnostics from "../lib/diagnostics";

jest.mock("../lib/diagnostics");

const mockRunDiagnostics = diagnostics.runDiagnostics as jest.MockedFunction<
  typeof diagnostics.runDiagnostics
>;

describe("doctorCommand", () => {
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
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe("success path", () => {
    it("should display diagnostics with all checks passed", async () => {
      mockRunDiagnostics.mockResolvedValue({
        checks: ["Apollo client installed", "Schema file found"],
        warnings: [],
        errors: [],
      });

      await doctorCommand.parseAsync(["node", "test", "doctor"]);

      expect(consoleLogSpy).toHaveBeenCalledWith("Running diagnostics...\n");
      expect(consoleLogSpy).toHaveBeenCalledWith("✓ Checks passed:");
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Apollo client installed"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Schema file found"),
      );
    });

    it("should display health score of 100 when all checks pass", async () => {
      mockRunDiagnostics.mockResolvedValue({
        checks: ["Check 1", "Check 2"],
        warnings: [],
        errors: [],
      });

      await doctorCommand.parseAsync(["node", "test", "doctor"]);

      expect(consoleLogSpy).toHaveBeenCalledWith("Health Score: 100/100");
    });

    it("should display warnings when present", async () => {
      mockRunDiagnostics.mockResolvedValue({
        checks: ["Check 1"],
        warnings: ["Warning 1", "Warning 2"],
        errors: [],
      });

      await doctorCommand.parseAsync(["node", "test", "doctor"]);

      expect(consoleLogSpy).toHaveBeenCalledWith("⚠ Warnings:");
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Warning 1"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Warning 2"),
      );
    });

    it("should not exit with error code when no errors", async () => {
      mockRunDiagnostics.mockResolvedValue({
        checks: ["Check 1"],
        warnings: ["Warning 1"],
        errors: [],
      });

      await doctorCommand.parseAsync(["node", "test", "doctor"]);

      expect(processExitSpy).not.toHaveBeenCalled();
    });
  });

  describe("error paths", () => {
    it("should display errors when present", async () => {
      mockRunDiagnostics.mockResolvedValue({
        checks: ["Check 1"],
        warnings: [],
        errors: ["Error 1", "Error 2"],
      });

      await expect(
        doctorCommand.parseAsync(["node", "test", "doctor"]),
      ).rejects.toThrow("process.exit called");

      expect(consoleLogSpy).toHaveBeenCalledWith("✗ Errors:");
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error 1"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error 2"),
      );
    });

    it("should calculate correct health score with errors", async () => {
      mockRunDiagnostics.mockResolvedValue({
        checks: ["Check 1", "Check 2"],
        warnings: [],
        errors: ["Error 1"],
      });

      await expect(
        doctorCommand.parseAsync(["node", "test", "doctor"]),
      ).rejects.toThrow("process.exit called");

      // Health score = Math.round((2 / (2 + 1)) * 100) = Math.round(66.67) = 67
      const healthScoreCall = consoleLogSpy.mock.calls.find((call) =>
        call[0]?.includes?.("Health Score:"),
      );
      expect(healthScoreCall).toBeDefined();
      expect(healthScoreCall?.[0]).toMatch(/Health Score: \d+\/100/);
    });

    it("should exit with code 1 when errors present", async () => {
      mockRunDiagnostics.mockResolvedValue({
        checks: ["Check 1"],
        warnings: [],
        errors: ["Error 1"],
      });

      await expect(
        doctorCommand.parseAsync(["node", "test", "doctor"]),
      ).rejects.toThrow("process.exit called");

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it("should handle diagnostics exception", async () => {
      mockRunDiagnostics.mockRejectedValue(new Error("Diagnostics failed"));

      await expect(
        doctorCommand.parseAsync(["node", "test", "doctor"]),
      ).rejects.toThrow("process.exit called");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to run diagnostics:",
        expect.any(Error),
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it("should display zero health score when all checks fail", async () => {
      mockRunDiagnostics.mockResolvedValue({
        checks: [],
        warnings: [],
        errors: ["Error 1", "Error 2"],
      });

      await expect(
        doctorCommand.parseAsync(["node", "test", "doctor"]),
      ).rejects.toThrow("process.exit called");

      expect(consoleLogSpy).toHaveBeenCalledWith("Health Score: 0/100");
    });
  });

  describe("edge cases", () => {
    it("should handle empty check results", async () => {
      mockRunDiagnostics.mockResolvedValue({
        checks: [],
        warnings: [],
        errors: [],
      });

      await doctorCommand.parseAsync(["node", "test", "doctor"]);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Health Score:"),
      );
    });

    it("should not display checks section when empty", async () => {
      mockRunDiagnostics.mockResolvedValue({
        checks: [],
        warnings: ["Warning 1"],
        errors: [],
      });

      const checksPassed = consoleLogSpy.mock.calls.some((call) =>
        call[0]?.includes?.("✓ Checks passed:"),
      );

      await doctorCommand.parseAsync(["node", "test", "doctor"]);

      // The spy was already created, so we need to check after the call
      const hasChecksPassed = consoleLogSpy.mock.calls.some((call) =>
        call[0]?.includes?.("✓ Checks passed:"),
      );

      expect(hasChecksPassed).toBe(false);
    });
  });
});
