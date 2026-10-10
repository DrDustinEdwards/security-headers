#!/usr/bin/env node
// Planted-break matrix (job_e520453432e8). Measurement only. Takes a Stryker JSON report, applies each mutant
// (a planted break) to a scratch copy of the repo, runs the whole node:test suite with the TAP reporter, and
// records which tests fail. Every test should fail on at least one plant and pass on clean code.
//   node docs/research/plant-matrix.mjs reports/mutation/headers-tested.json <scratch-dir> <out.json>
import { execFile } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [report, scratch, out] = process.argv.slice(2);
const files = JSON.parse(readFileSync(report, "utf8")).files;
const WORKERS = 4;
const copy = (dir) => {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  cpSync(".", dir, { recursive: true, filter: (src) => !/(^|\/)(node_modules|\.git|reports|\.stryker-tmp)(\/|$)/.test(src) });
};
const failing = (dir) =>
  new Promise((resolve) => {
    execFile(process.execPath, ["--test", "--test-reporter=tap", "test/*.test.mjs"], { cwd: dir, timeout: 60000 }, (error, stdout) => {
      const names = [...stdout.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1].replace(/\\#/g, "#"));
      resolve({ timedOut: Boolean(error?.killed), names, passedAll: !error });
    });
  });
const offset = (source, { line, column }) => source.split("\n").slice(0, line - 1).reduce((n, l) => n + l.length + 1, 0) + column - 1;

const jobs = Object.entries(files).flatMap(([file, entry]) => entry.mutants.map((m) => ({ file, source: entry.source, m })));
const results = [];
const dirs = Array.from({ length: WORKERS }, (_, i) => join(scratch, `w${i}`));
dirs.forEach(copy);
const clean = await failing(dirs[0]);
if (!clean.passedAll) throw new Error(`the clean suite fails: ${clean.names.join(", ")}`);
let next = 0;
await Promise.all(dirs.map(async (dir) => {
  while (next < jobs.length) {
    const { file, source, m } = jobs[next++];
    const mutated = source.slice(0, offset(source, m.location.start)) + m.replacement + source.slice(offset(source, m.location.end));
    writeFileSync(join(dir, file), mutated);
    const run = await failing(dir);
    writeFileSync(join(dir, file), source);
    results.push({ file, id: m.id, mutator: m.mutatorName, line: m.location.start.line, stryker: m.status, failing: run.names, timedOut: run.timedOut });
  }
}));
writeFileSync(out, JSON.stringify(results, null, 2));
console.log(`plants: ${results.length}`);
