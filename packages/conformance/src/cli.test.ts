import type { ClientHarness } from "./client-runner";
import { parseArgs, runCli } from "./cli";
import type { ServerTarget } from "./server-runner";

/** A server that answers every operation with nothing. */
const emptyServer: ServerTarget = {
  setup: () => {},
  execute: () => ({ data: {} }),
};

/** A client that holds nothing and applies nothing. */
const emptyClient = (): ClientHarness => ({
  cache: "normalized",
  seed: () => {},
  apply: () => {},
  entity: () => null,
  query: () => ({ state: "invalidated" }),
});

async function run(argv: string[], config: unknown) {
  const output: string[] = [];
  const code = await runCli(argv, {
    load: async () => config,
    write: (text) => output.push(text),
  });
  return { code, output: output.join("\n") };
}

describe("parseArgs", () => {
  it("reads the options", () => {
    expect(
      parseArgs([
        "--config",
        "c.mjs",
        "--target",
        "client",
        "--level",
        "standard",
        "--format",
        "json",
        "--verbose",
        "--no-colors",
      ]),
    ).toEqual({
      config: "c.mjs",
      target: "client",
      level: "standard",
      format: "json",
      verbose: true,
      colors: false,
    });
  });

  it("requires a config file", () => {
    expect(() => parseArgs([])).toThrow("--config <file> is required");
  });

  it("rejects unknown values", () => {
    expect(() => parseArgs(["--config", "c", "--level", "gold"])).toThrow(
      '--level must be one of basic, standard, complete; got "gold"',
    );
  });
});

describe("runCli", () => {
  it("runs the server cases against the configured server", async () => {
    const { code, output } = await run(["--config", "c.mjs", "--no-colors"], {
      server: emptyServer,
    });

    expect(code).toBe(1);
    expect(output).toContain("✗ TC-S-001");
    expect(output).not.toContain("TC-C-");
    expect(output).toContain("Achieved level: none");
  });

  it("runs the client cases against fresh harnesses", async () => {
    const { output } = await run(
      ["--config", "c.mjs", "--no-colors", "--format", "json"],
      { client: emptyClient },
    );

    const { results } = JSON.parse(output);
    expect(results.some((r: { id: string }) => r.id.startsWith("TC-C-"))).toBe(
      true,
    );
    expect(results.some((r: { id: string }) => r.id.startsWith("TC-S-"))).toBe(
      false,
    );
  });

  it("reports a target the config lacks", async () => {
    const { code, output } = await run(
      ["--config", "c.mjs", "--target", "client"],
      { server: emptyServer },
    );

    expect(code).toBe(1);
    expect(output).toContain("c.mjs exports no client");
  });
});
