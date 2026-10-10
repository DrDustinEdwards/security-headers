import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { buildContentSecurityPolicy } from "../csp.mjs";
import { STANDARD_SECURITY_HEADERS } from "../headers.mjs";

const CLI = fileURLToPath(new URL("../bin/check-security-headers.mjs", import.meta.url));
const GOOD = { ...STANDARD_SECURITY_HEADERS, "Content-Security-Policy": buildContentSecurityPolicy({ reportUri: "/csp" }).value };

/** @type {import("node:http").Server} */
let server;
let origin = "";
/** @type {string[]} */
const agents = [];
before(async () => {
  server = createServer((req, res) => {
    agents.push(req.headers["user-agent"] ?? "");
    if (req.url === "/good") res.writeHead(200, GOOD);
    else if (req.url === "/redirect") res.writeHead(302, { Location: "/good" });
    else res.writeHead(200, { ...GOOD, "X-Frame-Options": "allowall" });
    res.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(undefined)));
  const address = server.address();
  origin = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
after(() => server.close());

/** @param {string[]} args @returns {Promise<{ code: number, stdout: string, stderr: string }>} */
const run = (args) =>
  new Promise((resolve) => {
    execFile(process.execPath, [CLI, ...args], (error, stdout, stderr) => {
      resolve({ code: error ? Number(error.code) : 0, stdout, stderr });
    });
  });

test("CLI: a URL that carries the set and a sound policy exits 0", async () => {
  const { code, stdout } = await run([`${origin}/good`]);
  assert.equal(code, 0, stdout);
  assert.match(stdout, new RegExp(`${origin}/good \\(200\\)`));
  assert.match(stdout, /all checks pass/);
  assert.doesNotMatch(stdout, /FAIL/);
  assert.match(stdout, /^ {2}ok {3}X-Frame-Options refuses framing$/m);
  assert.match(agents.at(-1) ?? "", /security-headers check/);
});

test("CLI: one failing check exits 1 and names it", async () => {
  const { code, stdout } = await run([`${origin}/good`, `${origin}/weak`]);
  assert.equal(code, 1);
  assert.match(stdout, /FAIL X-Frame-Options refuses framing: got "allowall"/);
  assert.match(stdout, /^1 failure\(s\)$/m);
  const twice = await run([`${origin}/weak`, `${origin}/weak`]);
  assert.equal(twice.code, 1);
  assert.match(twice.stdout, /^2 failure\(s\)$/m);
});

test("CLI: a redirect is graded as it is, not followed", async () => {
  const { code, stdout } = await run([`${origin}/redirect`]);
  assert.equal(code, 1);
  assert.match(stdout, /\(302\)/);
  assert.match(stdout, /FAIL X-Frame-Options is present: ABSENT/);
});

test("CLI: no URL, or one that cannot be fetched, exits 2 and never reads as a pass", async () => {
  const usage = await run([]);
  assert.equal(usage.code, 2);
  assert.match(usage.stderr, /^usage: /);
  const closed = createServer();
  await new Promise((resolve) => closed.listen(0, "127.0.0.1", () => resolve(undefined)));
  const address = closed.address();
  const port = typeof address === "object" && address ? address.port : 0;
  closed.close();
  const unreachable = await run([`http://127.0.0.1:${port}/`, `${origin}/good`]);
  assert.equal(unreachable.code, 2);
  assert.match(unreachable.stderr, /could not fetch/);
  assert.doesNotMatch(unreachable.stdout, /all checks pass/);
});
