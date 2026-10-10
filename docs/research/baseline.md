# site-runtime baseline (job_d81a1970770c)

Measured 2026-10-10 at commit e0765ef (main). Linux container, 4 cores, Node 22.22.
Method follows Foxhound's `docs/research/baseline.md`. Nothing was deleted, no source
file changed, and package.json and the lockfile were not touched (Stryker 9.6.1 was
installed with `npm i --no-save --no-package-lock`; 10.0.0 has a Babel 8 parser bug).

## Test suite

| What | Command | Result |
|------|---------|--------|
| Tests | `npm test` (`node --test "test/*.test.mjs"`) | 1 file, 16 tests, all pass |
| Runtime | same | about 0.26 s in the runner, about 1.2 s with npm start-up |
| Lines | `wc -l` | 1,088 total: 837 in the modules (rate-limit 251, headers, CSP, check, OSHP, update-owasp, bin), 169 in the test file |

Only `rate-limit/` is under test. The test file imports `rate-limit/index.mjs` and nothing
else. There are no tests for headers, CSP, the check or the OSHP suite.

## Mutation testing (StrykerJS 9.6.1)

Two chunks, each pushed to `results/site-runtime-mutation-baseline` (`docs/research/chunks/`)
as it finished: `rate-limit` (`rate-limit/*.mjs`, 16 s) and `headers` (the root `.mjs`
modules and `bin/`, 51 s). Config: `docs/research/stryker.config.mjs`.

The suite uses `node:test`, which has no Stryker runner with per-test coverage, so the
command runner is used with `coverageAnalysis: off`. Every mutant runs the whole suite.
Consequences: Stryker cannot report No coverage (those mutants show as Survived), and
`ignoreStatic` is unavailable, so static mutants count.

### Score

| Status | Mutants |
|--------|---------|
| Killed | 144 |
| Survived | 879 |
| Valid | 1,023 |

- **Mutation score: 14.08%** (144 of 1,023).
- Rate limiter (`rate-limit/`): 69.23% (144 of 208).
- Everything else: 0% (0 of 815), because no test reaches it.

| File | Mutants | Killed | Survived | Score |
|------|---------|--------|----------|-------|
| `rate-limit/core.mjs` | 95 | 71 | 24 | 74.7% |
| `rate-limit/limit.mjs` | 106 | 73 | 33 | 68.9% |
| `rate-limit/durable-object.mjs` | 7 | 0 | 7 | 0.0% |
| `check.mjs` | 229 | 0 | 229 | 0.0% |
| `csp.mjs` | 164 | 0 | 164 | 0.0% |
| `oshp-suite.mjs` | 142 | 0 | 142 | 0.0% |
| `owasp-headers.mjs` | 108 | 0 | 108 | 0.0% |
| `update-owasp.mjs` | 88 | 0 | 88 | 0.0% |
| `headers.mjs` | 54 | 0 | 54 | 0.0% |
| `bin/check-security-headers.mjs` | 30 | 0 | 30 | 0.0% |

`index.mjs` and `rate-limit/index.mjs` are re-exports and have no mutants.

### Per-test kill matrix

`node docs/research/matrix.mjs run` runs Stryker once per test, with the command narrowed
to that test's exact name, and a mutant counts as killed by a test when it fails with only
that test running. Output: `docs/research/kill-matrix.json` (per test: kills, unique kills,
candidate kind, protected flag). Only the rate-limit chunk is in the matrix; no test kills
anything in the headers chunk.

The union of per-test kills is 142 against 144 full-suite kills. The 2 extra full-suite
kills are mutants that fail only when the tests run together (shared state or ordering).

| Test | Kills | Unique | Candidate |
|------|-------|--------|-----------|
| window edges: the limit-th hit is ok, the next is limited | 41 | 0 | covered |
| window edges: the first hit after the boundary is ok and the count restarts | 41 | 0 | covered |
| a limited hit writes nothing | 28 | 0 | covered |
| two rules: when one is spent neither is counted | 45 | 0 | covered |
| two rules: the refusal names the rule that frees up last | 45 | 0 | covered |
| Retry-After is the time left in the window, not the window length | 31 | 0 | covered |
| a rule with a bad limit or a repeated window is refused | 8 | 6 | |
| idle deadline is the end of the longest window | 8 | 8 | |
| fail-closed path: a throwing or missing binding is unavailable and refuses with a 503 | 26 | 9 | |
| allow still reports the failure and lets the call proceed | 17 | 6 | |
| onUnavailable has no default | 5 | 2 | |
| limited answers 429 with the time left, never a success code | 16 | 5 | |
| ipKey shares one anon bucket only without the header, and says so | 10 | 10 | |
| matchRule: case, slashes and percent-escapes cannot slip past a rule | 23 | 23 | |
| cleanup forgets ended windows only, and reports when the rest end | 34 | 0 | covered |
| cleanup with a clock in the past leaves a live window counted | 34 | 0 | covered |

### Removal candidates (nothing removed)

No test is zero-kill. Eight tests are "covered by others" (every mutant they kill is also
killed by another test), but **all 16 tests are protected**: they are the rate limiter's
only tests and rate limiting is a protected path for this job. So there are no removal
candidates. The covered flags are also joint-blind: the two window-edge tests, the two
two-rule tests and the two cleanup tests cover each other, and removing both of a pair
would lose kills.

### Reading this

- The suite is small and fast; the gap is breadth, not bloat. The security headers,
  CSP builder and header check are protected and have no tests, so their 815 mutants
  all survive. Adding tests there is worth far more than trimming any.
- `rate-limit/durable-object.mjs` (7 mutants, 0 killed) needs a Durable Object runtime
  the test does not provide.
- 64 rate-limit mutants survive. Some are likely equivalent or static (the run cannot
  tell); they are in `docs/research/chunks/rate-limit.json`.
