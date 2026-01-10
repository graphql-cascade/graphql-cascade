import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { setup, $fetch } from "@nuxt/test-utils";

describe("GraphQL Cascade Nuxt Module", () => {
  it("module metadata is correct", async () => {
    const module = await import("../module");

    expect(module.default).toBeDefined();
    expect(module.default.meta).toBeDefined();
    expect(module.default.meta.name).toBe("@graphql-cascade/nuxt");
    expect(module.default.meta.configKey).toBe("graphqlCascade");
  });

  it("module has correct default options", () => {
    const module = require("../module");

    expect(module.default.defaults).toEqual({
      enabled: true,
      debug: false,
      autoImports: true,
    });
  });

  it("module exports ModuleOptions type", () => {
    const module = require("../module");

    // Type check - this will fail at build time if types are wrong
    const options: typeof module.ModuleOptions = {
      enabled: true,
      debug: false,
      autoImports: true,
    };

    expect(options).toBeDefined();
  });
});

describe("Composables exports", () => {
  it("all composables are exported", async () => {
    const composables = await import("../runtime/composables");

    expect(composables.useCascadeMutation).toBeDefined();
    expect(composables.useCascadeClient).toBeDefined();
    expect(composables.useCascadeTracker).toBeDefined();
    expect(composables.useCascadeQuery).toBeDefined();
    expect(composables.useCascadeBatch).toBeDefined();
    expect(composables.useCascadeOptimistic).toBeDefined();
    expect(composables.useCascadeUnionQuery).toBeDefined();

    expect(typeof composables.useCascadeMutation).toBe("function");
    expect(typeof composables.useCascadeClient).toBe("function");
    expect(typeof composables.useCascadeTracker).toBe("function");
    expect(typeof composables.useCascadeQuery).toBe("function");
    expect(typeof composables.useCascadeBatch).toBe("function");
    expect(typeof composables.useCascadeOptimistic).toBe("function");
    expect(typeof composables.useCascadeUnionQuery).toBe("function");
  });
});
