/**
 * Point every peer dependency, and the packages that go with it, at its
 * latest major through pnpm overrides, so CI can test the packages against
 * the current majors as well as the previous ones their devDependencies pin.
 *
 * Usage: node scripts/latest-peers.mjs && pnpm install --no-frozen-lockfile
 */
import { readFileSync, writeFileSync } from "node:fs";

/** The current major of each peer; raise one deliberately, with the fixes it needs. */
export const LATEST_MAJORS = {
  "@apollo/client": "^4.0.0",
  "@apollo/server": "^5.0.0",
  "@nestjs/common": "^12.0.0",
  "@nestjs/core": "^12.0.0",
  "@nestjs/testing": "^12.0.0",
  "@tanstack/react-query": "^5.0.0",
  "@types/express": "^5.0.0",
  "@types/react": "^19.0.0",
  "@types/react-dom": "^19.0.0",
  "@types/relay-runtime": "^20.0.0",
  "@urql/core": "^6.0.0",
  express: "^5.0.0",
  graphql: "^17.0.0",
  react: "^19.0.0",
  "react-dom": "^19.0.0",
  "relay-runtime": "^21.0.0",
};

const manifest = JSON.parse(readFileSync("package.json", "utf8"));
manifest.pnpm = {
  ...manifest.pnpm,
  overrides: { ...manifest.pnpm?.overrides, ...LATEST_MAJORS },
};
writeFileSync("package.json", `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Overrode ${Object.keys(LATEST_MAJORS).length} packages with their latest majors`);
