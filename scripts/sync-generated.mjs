import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { GENERATED_MODULES } from "./generated-modules.mjs";

// Tracked files, as check:spec reads them; git add -N new cases first.
const paths = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);
const readFile = (path) => readFileSync(path, "utf8");

for (const { path, render } of GENERATED_MODULES) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, render(readFile, paths));
  console.log(`Wrote ${path}`);
}
