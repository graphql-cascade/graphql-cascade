import Ajv from "ajv";
import { readdirSync, readFileSync } from "fs";
import { join, relative } from "path";

const CASES_DIR = join(__dirname, "../../../conformance-tests");
const NOT_CASES = new Set(["test-case-schema.json", "spec-version.json"]);

function caseFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return caseFiles(path);
    return entry.name.endsWith(".json") && !NOT_CASES.has(entry.name)
      ? [path]
      : [];
  });
}

const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));

describe("conformance test cases", () => {
  const validate = new Ajv({ allErrors: true, validateFormats: false }).compile(
    readJson(join(CASES_DIR, "test-case-schema.json")),
  );
  const files = caseFiles(CASES_DIR);

  it("finds the cases", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((file) => [relative(CASES_DIR, file), file]))(
    "%s matches the test case schema",
    (_name, file) => {
      validate(readJson(file));
      expect(validate.errors ?? []).toEqual([]);
    },
  );

  it("gives every case a unique id", () => {
    const ids = files.map((file) => readJson(file).id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });
});
