import { createRequire } from "node:module";
import { expect, it } from "vitest";

it("loads the composables without loading React", async () => {
  await import("../src/runtime/composables");

  const loaded = Object.keys(createRequire(import.meta.url).cache);
  expect(
    loaded.filter((path) => /[\\/]node_modules[\\/]react[\\/]/.test(path)),
  ).toEqual([]);
});
