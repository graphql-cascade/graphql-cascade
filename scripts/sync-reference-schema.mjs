import { readFileSync, writeFileSync } from "node:fs";
import {
  REFERENCE_MODULE_PATH,
  renderReferenceModule,
} from "./reference-module.mjs";

writeFileSync(
  REFERENCE_MODULE_PATH,
  renderReferenceModule(readFileSync("reference/cascade_base.graphql", "utf8")),
);
console.log(`Wrote ${REFERENCE_MODULE_PATH}`);
