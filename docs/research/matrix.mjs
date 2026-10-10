#!/usr/bin/env node
// Per-test kill matrix for site-runtime. Measurement only.
//   node docs/research/matrix.mjs run     # one Stryker run per test (rate-limit chunk), then merge
//   node docs/research/matrix.mjs merge   # merge reports/mutation/rate-limit.*.json only
// A mutant a test kills is one that fails when only that test runs. Writes docs/research/kill-matrix.json.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const names = [...readFileSync("test/rate-limit.test.mjs", "utf8").matchAll(/^test\((["`])(.*?)\1/gm)].map((m) => m[2]);
const hex = (s) => Buffer.from(s).toString("hex").slice(0, 16);
if (process.argv[2] === "run") {
  for (const name of names) {
    execFileSync("npx", ["stryker", "run", "docs/research/stryker.config.mjs"], {
      env: { ...process.env, STRYKER_CHUNK: "rate-limit", STRYKER_TEST: name }, stdio: "ignore",
    });
    console.log("done:", name);
  }
}
const full = JSON.parse(readFileSync("reports/mutation/rate-limit.json", "utf8"));
const key = (file, m) => `${file}#${m.id}`;
const killedAll = new Set();
for (const [f, e] of Object.entries(full.files)) for (const m of e.mutants) if (m.status === "Killed" || m.status === "Timeout") killedAll.add(key(f, m));
const per = new Map();
for (const name of names) {
  const r = JSON.parse(readFileSync(`reports/mutation/rate-limit.${hex(name)}.json`, "utf8"));
  const kills = new Set();
  for (const [f, e] of Object.entries(r.files)) for (const m of e.mutants) if (m.status === "Killed" || m.status === "Timeout") kills.add(key(f, m));
  per.set(name, kills);
}
const killers = new Map();
for (const kills of per.values()) for (const k of kills) killers.set(k, (killers.get(k) ?? 0) + 1);
// Protected: the rate limiter is a protected path for this job.
const rows = names.map((name) => {
  const kills = per.get(name);
  let unique = 0;
  for (const k of kills) if (killers.get(k) === 1) unique++;
  return { file: "test/rate-limit.test.mjs", name, kills: kills.size, unique, kind: kills.size === 0 ? "zero-kill" : unique === 0 ? "covered" : "", protected: true };
});
writeFileSync("docs/research/kill-matrix.json", JSON.stringify(rows, null, 2) + "\n");
console.log(rows.map((r) => `${r.kills}\t${r.unique}\t${r.kind}\t${r.name}`).join("\n"));
const union = new Set([...per.values()].flatMap((s) => [...s]));
console.log("union of per-test kills:", union.size, "full-suite kills:", killedAll.size);
