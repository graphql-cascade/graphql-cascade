/**
 * The package root must load in projects that install none of the
 * integrations' optional peer dependencies.
 */
import { readFileSync } from "fs";
import { join } from "path";

const PEERS = ["@nestjs/common", "@apollo/server", "express"];

describe("package entries", () => {
  it("loads the root without any integration peer installed", () => {
    jest.isolateModules(() => {
      for (const peer of PEERS) {
        jest.doMock(peer, () => {
          throw new Error(`Cannot find module '${peer}'`);
        });
      }

      expect(() => require("./index")).not.toThrow();
    });
  });

  it("exposes each integration as its own entry", () => {
    const manifest = JSON.parse(
      readFileSync(join(__dirname, "../package.json"), "utf8"),
    );

    expect(Object.keys(manifest.exports)).toEqual([
      ".",
      "./nestjs",
      "./express",
      "./apollo",
      "./package.json",
    ]);
    for (const entry of ["nestjs", "express", "apollo"]) {
      expect(manifest.exports[`./${entry}`]).toEqual({
        types: `./dist/integrations/${entry}.d.ts`,
        default: `./dist/integrations/${entry}.js`,
      });
      expect(manifest.typesVersions["*"][entry]).toEqual([
        `dist/integrations/${entry}.d.ts`,
      ]);
    }
  });
});
