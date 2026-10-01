import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { loadNuxt } from "@nuxt/kit";
import type { NuxtHooks } from "@nuxt/schema";
import cascadeModule, { composables, type ModuleOptions } from "../src/module";

type Import = Parameters<NuxtHooks["imports:extend"]>[0][number];

const fixture = fileURLToPath(new URL("./fixture", import.meta.url));

/** The auto-imports a Nuxt app gets with the module installed */
async function autoImports(options: ModuleOptions = {}): Promise<Import[]> {
  const nuxt = await loadNuxt({
    cwd: fixture,
    overrides: {
      modules: [[cascadeModule, options]],
      // Only the module under test registers imports
      imports: { scan: false, presets: [] },
    },
  });
  try {
    const imports: Import[] = [];
    await nuxt.callHook("imports:extend", imports);
    return imports.filter((entry) =>
      (composables as readonly string[]).includes(entry.name),
    );
  } finally {
    await nuxt.close();
  }
}

describe("GraphQL Cascade Nuxt module", () => {
  it("declares its name and config key", async () => {
    const meta = await cascadeModule.getMeta?.();

    expect(meta).toMatchObject({
      name: "@graphql-cascade/nuxt",
      configKey: "graphqlCascade",
    });
  });

  it("auto-imports every composable from the runtime", async () => {
    const imports = await autoImports();

    expect(imports.map((entry) => entry.name).sort()).toEqual(
      [...composables].sort(),
    );
    for (const entry of imports) {
      expect(entry.from).toMatch(/runtime[\\/]composables$/);
    }
  }, 60_000);

  it("registers nothing when auto-imports are off", async () => {
    expect(await autoImports({ autoImports: false })).toEqual([]);
  }, 60_000);

  it("registers nothing when disabled", async () => {
    expect(await autoImports({ enabled: false })).toEqual([]);
  }, 60_000);
});
