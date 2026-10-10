// StrykerJS mutation baseline for site-runtime. Measurement only: not a gate, not in CI,
// not a dependency. Run from the repo root, one chunk at a time:
//
//   npm i --no-save --no-package-lock @stryker-mutator/core@9.6.1
//   STRYKER_CHUNK=rate-limit npx stryker run docs/research/stryker.config.mjs
//   STRYKER_CHUNK=rate-limit STRYKER_TEST="a limited hit writes nothing" npx stryker run docs/research/stryker.config.mjs
//
// The suite uses node:test, which has no per-test Stryker runner, so the command runner
// (no coverage analysis) runs the whole suite per mutant. For the per-test kill matrix the
// run is repeated once per test with STRYKER_TEST set, which narrows the command to that
// one test by exact name; scripts in docs/research/matrix.mjs drive that and merge.
import process from "node:process";

const CHUNKS = {
  headers: ["headers.mjs", "owasp-headers.mjs", "csp.mjs", "check.mjs", "oshp-suite.mjs", "index.mjs", "update-owasp.mjs", "bin/*.mjs"],
  "rate-limit": ["rate-limit/*.mjs"],
};
const chunk = process.env.STRYKER_CHUNK;
if (!CHUNKS[chunk]) throw new Error(`STRYKER_CHUNK must be one of ${Object.keys(CHUNKS).join(", ")}`);
const only = process.env.STRYKER_TEST;
const escaped = only ? only.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : "";
const command = only ? `node --test --test-name-pattern="^${escaped.replace(/"/g, '\\"')}$" test/*.test.mjs` : "node --test test/*.test.mjs";
const name = only ? `${chunk}.${Buffer.from(only).toString("hex").slice(0, 16)}` : chunk;

export default {
  testRunner: "command",
  commandRunner: { command },
  coverageAnalysis: "off",
  mutate: CHUNKS[chunk],
  reporters: ["json"],
  jsonReporter: { fileName: `reports/mutation/${name}.json` },
  concurrency: 4,
  timeoutMS: 20000,
  tempDirName: ".stryker-tmp",
  disableTypeChecks: true,
  checkers: [],
};
