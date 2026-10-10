# Tests for the security headers, CSP builder and header check (job_e520453432e8)

Measured 2026-10-10 on top of fe0ea69 (main). Node 22.22, 4 cores, StrykerJS 9.6.1 installed with
`npm i --no-save --no-package-lock`. No source file changed. package.json and the lockfile are untouched.

## A bug the tests found (reported, not fixed)

**CSP keywords are compared case-sensitively, and browsers compare them case-insensitively.** So a policy
whose script-src carries `'UNSAFE-INLINE'` (or `'Unsafe-Eval'`, or any other casing) passes
`checkSecurityHeaders` and is accepted by `buildContentSecurityPolicy`, while the browser runs inline script
under it.

- Browser: Chromium (Playwright's build, 1194) given `script-src 'UNSAFE-INLINE'` or `script-src 'Unsafe-Inline'`
  runs an inline `<script>`, exactly as with `'unsafe-inline'`. Given `script-src 'self'` it blocks it.
- Check: `check.mjs` lines 97 and 98 test `scripts.includes("'unsafe-inline'")` and `"'unsafe-eval'"`. `parsePolicy`
  lower-cases directive names but not sources. A response with the standard set and
  `default-src 'self'; script-src 'self' 'UNSAFE-INLINE' 'Unsafe-Eval'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; report-uri /csp`
  gets zero failures.
- Builder: `csp.mjs` line 126 refuses `/^'unsafe-(inline|eval)'$/` with no `i` flag, so
  `sources.script: ["'UNSAFE-INLINE'"]` builds `script-src 'self' 'UNSAFE-INLINE'`.

Reproduce:

```sh
node -e 'import("./index.mjs").then(({ checkSecurityHeaders, failures, applyHeaderSet, buildContentSecurityPolicy }) => {
  const h = new Headers(); applyHeaderSet(h);
  h.set("Content-Security-Policy", "default-src '"'"'self'"'"'; script-src '"'"'self'"'"' '"'"'UNSAFE-INLINE'"'"'; object-src '"'"'none'"'"'; base-uri '"'"'none'"'"'; frame-ancestors '"'"'none'"'"'; report-uri /csp");
  console.log(failures(checkSecurityHeaders(h)));                                   // [] : should name unsafe-inline
  console.log(buildContentSecurityPolicy({ reportUri: "/csp", sources: { script: ["'"'"'UNSAFE-INLINE'"'"'"] } }).value); // should throw
})'
```

The same mismatch runs the strict way for `object-src 'NONE'` and `base-uri 'NONE'`, which the check fails
although a browser reads them as `'none'`. That one refuses a sound policy rather than passing an unsafe one.
A fix would compare source keywords case-insensitively in both files. It is left for a separate change, as
the job says. No test pins either behaviour.

## Tests added

| File | Tests | Covers |
|------|-------|--------|
| `test/headers.test.mjs` | 13 | the standard set against OSHP minus the skipped four, frozen exports, the logout set, overrides (replace, add, remove, every refusal and the 12-character reason edge), `applyHeaderSet` overwrite and merge, immutable headers |
| `test/csp.test.mjs` | 21 | nonce shape and freshness, `scriptHash` against node:crypto, `buildPolicy`, the fixed policy, sinks, Report-Only, nonce and hash placement and refusals, per-kind sources, script-source refusals, source injection (`;`, space, comma) in every kind and in the sinks, the beacon, style attributes, extra directives, and every built policy passing the check |
| `test/check.test.mjs` | 24 | `parsePolicy` (case, first occurrence wins), `failures`, each standard header absent, HSTS floor and one-year default, strict Referrer-Policy, X-Frame-Options, Permissions-Policy denial, exact match for the rest, a declared floor, `csp: false`, enforced vs Report-Only, every script, object-src, base-uri, frame-ancestors and sink rule, default-src fallback, and the beacon rules |
| `test/check-cli.test.mjs` | 4 | the CLI against a local server: exit 0, exit 1 with the failure named and counted, a 302 graded unfollowed, exit 2 on no URL or an unreachable one |

`npm test`: 78 tests (16 before), all pass, about 1 s.

## Each test seen failing, then passing

`node docs/research/plant-matrix.mjs <stryker json> <scratch> <out>` applies each of the 477 Stryker mutants of
these files to a scratch copy, one at a time, runs the whole suite, and records which tests fail
(`docs/research/plant-matrix.json`). The clean suite passes first. 465 plants fail at least one test. Every
test except one fails on at least one plant. The exception, "the exported sets cannot be changed by a site",
guards `Object.freeze`, which Stryker does not mutate. It was seen failing by hand, once with the freeze removed
from `LOGOUT_HEADERS` and once from `OWASP_SKIPPED`, then passing once restored.

## Mutation score

Chunk `headers-tested` in `docs/research/stryker.config.mjs` (`headers.mjs`, `csp.mjs`, `check.mjs`, `bin/*.mjs`),
command runner, so the whole suite runs for every mutant.

| File | Mutants | Baseline killed | Now killed | Survived | Score |
|------|---------|-----------------|------------|----------|-------|
| `check.mjs` | 229 | 0 | 221 | 8 | 96.5% |
| `csp.mjs` | 164 | 0 | 161 | 3 | 98.2% |
| `headers.mjs` | 54 | 0 | 53 | 1 | 98.1% |
| `bin/check-security-headers.mjs` | 30 | 0 | 30 | 0 | 100.0% |
| **Total** | **477** | **0 (0%)** | **465 (97.48%)** | **12** | |

465 includes 2 timeouts, counted as killed. The repo's overall score, with the rate limiter (144 of 208) and the
untested `oshp-suite.mjs`, `owasp-headers.mjs` and `update-owasp.mjs` (0 of 338), goes from 14.08% to 59.53%
(609 of 1,023).

### The 12 survivors

All are equivalent, or change only text nobody reads:

| Where | Mutant | Why it survives |
|-------|--------|-----------------|
| `check.mjs` 70, 72, 78 | `got.trim()` to `got` | Equivalent. `Headers` strips leading and trailing whitespace from every value it stores, so `got` is already trimmed. |
| `check.mjs` 76, 89, 100 | a passing result's empty detail becomes text | Not observable. The detail of a passing result is never printed (the CLI prints detail only on FAIL) and no caller reads it. |
| `check.mjs` 108 | `scripts ?? []` to `scripts ?? ["Stryker was here"]` | Equivalent. When there are no script sources both beacon entries are missing either way. |
| `headers.mjs` 45 | `?? ""` fallback for Clear-Site-Data | Unreachable while OSHP's data has Clear-Site-Data, which owasp-headers.mjs does. |
| `check.mjs` 99, `csp.mjs` 126 | the `^` dropped from `/^(https?\|data\|blob):$/i` | Differs only for a made-up scheme ending in `http:`, `https:`, `data:` or `blob:` (`ext-data:`), which no browser loads scripts from. |
| `csp.mjs` 126 (2) | `^` or `$` dropped from `/^'unsafe-(inline\|eval)'$/` | Equivalent in effect. A source like `x'unsafe-inline'` or `'unsafe-inline'x` is not a keyword; Chromium ignores it and blocks inline script. |
