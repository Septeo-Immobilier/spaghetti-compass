# Review — 004-go-package-impact-truthfulness

Speculative: false

**Scope**: uncommitted working tree on `feature/004-go-package-impact-truthfulness`
(`git diff main...HEAD` is empty — the branch carries no commit; the change lives in
`git diff main` plus 5 untracked paths: 11 files modified, 757 insertions).
**Reviewer model**: claude-opus-5. **Implementer model**: unrecorded — `stats.md` still carries
no IMPLEMENT and no VERIFY row and `devit-log.md` still ends at CHECKLIST, so
`SameModelWarning` cannot be resolved either way. **Test status**: assessed, not assumed —
119/119 green, `eslint` 0 errors, `tsc` clean, all under `node:20.18.1-bookworm-slim`.

This is the second full review of this branch. Its predecessor's single High — `routes[].chain`
losing determinism — is **fixed and verified**; see "Resolved since the previous review". No new
High replaces it. Every finding below was re-reproduced against the current tree rather than
carried over on trust.

## Verdict

Approved (with minor)

0 Critical, 0 High, 6 Medium, 7 Low. Plus 5 grievance candidates, which move no verdict.

The defect the spec exists for is fixed and observably so, and the output contract now holds
byte-for-byte on the built CLI. What remains is test quality, diff hygiene and one pre-existing
read-boundary hole — none of which makes the change unshippable, and none of which is a
degradation this diff introduced.

## Resolved since the previous review

- **H1 — `routes[].chain` determinism.** `src/core/impact.ts:252` now sorts `files` before
  `collectFiles` returns, with a comment naming the cause (`readdir` order feeds `reverseDeps`
  insertion order, and the BFS assigns `parent` first-wins). The guard added at
  `src/core/impact.test.ts:117-196` builds a temp module whose intermediate package holds two
  importers of the same leaf, then reverses `readdirSync` and asserts the chain is unchanged —
  the assertion fails without the sort. Test count moved 118 → 119. `contracts/impact-cli.md`
  §6's determinism clause now holds for every output field.

Nothing else changed between the two reviews. The eleven other findings below are the
predecessor's, re-verified as still open, plus one new Low the H1 fix itself raises (L7).

## Spec coverage matrix

| US  | Implemented | Partial | Missing | Notes |
| --- | ----------- | ------- | ------- | ----- |
| US1 — truthful dependents for any file of a package | yes | | | `go-mod.ts:109-123` + `resolver.ts:162-180` + `impact.ts:206-214`. Scenarios 1, 2, 4 covered by `go-integration.test.ts:95-116`. Scenario 3 (rename) holds end-to-end but is asserted one layer too low — M3. |
| US2 — tell an empty answer apart from an unknown one | yes | | | `impact.ts:144-149`, `output/impact.ts:59-66`, `cli/index.ts:27-33, 374-378`. Scenarios 1-6 re-observed live on the built CLI this round. |
| US3 — regression fixture | yes | | | `fixtures/go/internal/notify/{aaa_marker,sender}.go` + `fixtures/go/cmd/notifier/main.go`, asserted at `go-integration.test.ts:95-116`. |
| US4 — accurate limitations text | yes | | | `README.md:176-178`, `README.md:454-455`, plus the optional `--json` key list at `README.md:367-368` (ANALYZE A-007 + A-011). |

| FR / NFR | Status | Evidence |
| --- | --- | --- |
| FR-001 | met | `go-mod.ts:239-294` returns every non-test file, sorted; `go-mod.test.ts:238-270`. |
| FR-002 | met | `go-integration.test.ts:95-116`. Live: `impact aaa_marker.go --json` and `impact sender.go --json` both return `dependents == directDependents == ["cmd/notifier/main.go"]`. |
| FR-003 | met (behaviour), weak (test) | The committed test asserts file **contents** set-equality after a rename, which a rename cannot change — M3. The behaviour itself holds. |
| FR-004 | met | Live: `"granularity": "package"` on both an empty (`cmd/service/main.go`) and a non-empty (`internal/notify/sender.go`) Go target, each with a non-null note. |
| FR-005 | met, thinly tested | Live: `impact src/core/go-mod.ts -c . --json` → `"granularity": "file"`, `"granularityNote": null`. Python and PHP targets untested — L3. |
| FR-006 | met | `output/impact.ts:59-66`; `output/impact.test.ts:44-55`. Live: `LINE-PKG-EMPTY` verbatim on stdout, `LINE-EXACT-EMPTY` absent (`grep -c` = 0). |
| FR-007 | met | `EXIT=0` observed on the empty and the non-empty Go target, text and `--json`. |
| FR-008 | met | `cli/index.ts:27-33, 374-378`. Exactly one stderr line in each mode (`wc -l` = 1), byte-identical to `NOTE-PKG-STDERR`, textually distinct from `degradedMessage('go')`. |
| FR-009 | met | `go-mod.ts:274-278, 299-302`; `go-mod.test.ts:302-346`. |
| FR-010 | met | Fixture present, asserted, proven RED-without-the-fix by T013. |
| FR-011 | met | Both mandatory README sites corrected, plus the optional third. |
| NFR-001 | met on a realistic topology; exceeded on an adversarial one | Measured in the previous round (+0.4% / +9% realistic, +111% adversarial). Still unrecorded in `devit-log.md` — M6. |
| NFR-002 | met (exclude half), untested (traversal half) | The committed boundary assertion cannot fail — M4. A pre-existing module-root escape sits under the same requirement — M5. |

JSON payload conformance re-checked against `contracts/impact-result.schema.json`: the emitted
key order is `target, targetAbsolute, scannedFiles, directDependents, dependents, routes,
routePatterns, targetIsRoute, granularity, granularityNote` — the declaration order the schema
fixes, with `additionalProperties: false` satisfied exactly.

## Constitution compliance

| Principle | Status | Evidence |
| --------- | ------ | -------- |
| (none ratified) | vacuous pass | `.specify/memory/constitution.md` is still the spec-kit template (`[PROJECT_NAME]`, `[PRINCIPLE_1_NAME]`, `[GOVERNANCE_RULES]`). `plan.md`'s Constitution Check declares the gate vacuous and takes zero waivers; that reading is correct. Recorded as GC-3. |
| English-only | respected by this diff | Zero accented lines added, tracked or untracked (`git diff main \| grep '^+[^+]' \| grep -cP '[éèêàçôûîœ]'` = 0). 30 pre-existing French files remain under `src/`, including `src/cli/index.ts` which this diff touches — GC-4, and M1 for the asymmetry. |
| Docker-only execution | violated (probable) | M2 — `fixtures/go/go.sum` is the output of a Go toolchain nobody declared running. Every command in this review ran under `node:20.18.1-bookworm-slim`. |

## Architecture

No layer leak, no dependency-direction violation, no port/adapter drift. The load-bearing
decision holds in the code rather than only in the plan: `resolveImport()` is literally
`resolvePackageFiles(...)[0] ?? null` (`go-mod.ts:93-95`), so `Analyzer` / `explore` and the call
graph see byte-identical resolution and needed no edit. `resolver.test.ts`'s Go assertion passes
unmodified, which is the check that proves it.

Reverse impact of the touched files was resolved with `spaghetti-compass` itself, run from the
Docker-built `dist/` rather than the host binary
(`impact <file> -c . --json -e "**/node_modules/**" "**/dist/**" "**/vendor/**"`). It resolved
`src/core/go-mod.ts` → direct `resolver.ts`, `go-mod.test.ts`; transitive `analyzer.ts`,
`impact.ts`, `cli/index.ts`, `output/impact.ts` and the four test files — matching `plan.md`'s
blast-radius table plus the new `src/output/impact.test.ts`, and confirming `analyzer.ts` sits in
reach while staying outside the touched set. It was the right instrument for the TypeScript half:
one sub-second LSP-backed call per file instead of a grep sweep, and it returned
`"granularity": "file"` on itself, which doubles as the FR-005 live check. It was not usable for
the Go half, where the fixtures are the subject rather than the dependency graph of the change;
that half was read and reproduced by hand.

## Contract observations

Run against `contracts/impact-cli.md` on the built CLI, in Docker:

- Case (c), `impact internal/notify/sender.go -c fixtures/go` → `1 dependent(s), 1 direct,
  1 route(s)`, route `cmd/notifier/main.go`, chain `main.go ↳ sender.go`, exit `0`, exactly one
  stderr line matching `NOTE-PKG-STDERR` verbatim.
- Case (d), `impact cmd/service/main.go -c fixtures/go` → `LINE-PKG-EMPTY` verbatim,
  `LINE-EXACT-EMPTY` absent, exit `0`, same single stderr line.
- `--json` on `internal/notify/aaa_marker.go` → identical `dependents`, `directDependents` and
  route to `sender.go`. This is SC-001, observed rather than inferred.
- `--json` on a TypeScript target → `"granularity": "file"`, `"granularityNote": null`.
- Determinism clause (§6) → holds for every field, including `chain`. Previously failed.

## Issues to fix — auto-applied by `/dev-it` (REVIEW-FIX phase)

### Critical

None.

### High

None.

## Issues to review — require approval

### Medium

- [ ] **Drive-by French-to-English comment translation inflates the diff**
      [src/core/resolver.ts, src/core/impact.ts, src/output/impact.ts, src/core/go-mod.ts,
      src/core/go-mod.test.ts] — of 100 added lines in `resolver.ts`, 17 carry behaviour;
      `impact.ts` 23 of 91; `go-mod.ts` 18 of 82; `output/impact.ts` 5 of 16. Roughly 80% of the
      added lines in the four core files are translated prose. No task asks for it: T004, T005,
      T006 and T011 each scope one method, and `plan.md`'s Source-code table lists a one-line
      change for `output/impact.ts`. It is also unfinished and arbitrary — `src/cli/index.ts` is
      touched by this same diff and keeps its 29 accented lines, and 30 files under `src/` remain
      French. Reverting it would move the repo away from English-only, so it must not be
      auto-applied; the right action is to split it out.
      Fix: move the translation hunks into their own `refactor:` commit, or drop them from this
      branch.

- [ ] **Out-of-scope fixture edits: `go.mod` reformatted, `go.sum` created**
      [fixtures/go/go.mod:5, fixtures/go/go.sum:1-2] — `require ( … )` was collapsed to a one-line
      `require`, and a `go.sum` carrying `github.com/google/uuid` hashes appeared. T001's
      `Touches:` lists only the three `.go` fixtures and `fixtures/go/README.md`; neither file is
      named in `tasks.md`, `plan.md` or `devit-log.md`. The pair is the exact output of
      `go mod tidy` — a language toolchain, and therefore Docker-only under the dispatch mandate.
      No fixture is ever compiled and `package.json:files` publishes only `dist`, `bin`, `config`,
      so `go.sum` has no consumer at all.
      Fix: revert both, or declare them and state where the command ran.

- [ ] **FR-003 / SC-002 are asserted one layer below the requirement**
      [src/core/go-mod.test.ts:353-399] — the rename test builds a temp module, renames
      `zzz-sibling.go` to `aaa-sibling.go`, then asserts `after.length === before.length` plus
      set-equality of the files' *contents*. A rename cannot change file contents, so the second
      assertion is near-tautological, and neither touches `impact`. FR-003 and SC-002 speak about
      "the dependents, direct dependents, or route count reported by `impact`", and `plan.md`'s
      "Rename invariance" section spells out the `ImpactAnalyzer`-level assertion; T002(d)
      silently narrowed it and the drift is not recorded in `analyze.md`. The behaviour is fine —
      re-verified by renaming on a copy of the fixture — so this is a test-quality gap.
      Test to add: same temp module, run `ImpactAnalyzer.analyze` before and after the rename,
      assert `dependents`, `directDependents` and `routes.length` are equal.

- [ ] **The NFR-002 boundary assertion cannot fail**
      [src/core/go-integration.test.ts:118-144] — it excludes `**/aaa_marker.go` and asserts the
      file appears in no `dependents` or `directDependents` set. `aaa_marker.go` declares one
      unreferenced constant and imports nothing (`fixtures/go/internal/notify/aaa_marker.go:1-10`),
      so it can never be an importer and therefore never a dependent, with or without the exclude.
      The check passes identically against the pre-fix code and against a deliberately broken
      `matchesContextPatterns`. This is the SELF-certification shape: a tick that would not fail if
      the change were wrong. The third assertion below it (sender.go still sees
      `cmd/notifier/main.go`) is meaningful but tests the opposite direction.
      Test to add: exclude a file that *does* import the target — `**/cmd/notifier/main.go` — and
      assert it disappears from `sender.go`'s dependents.

- [ ] **Go import paths containing `..` escape the module root** [src/core/go-mod.ts:251-254] —
      **predates this diff**; `_resolveImportInternal` at `main:src/core/go-mod.ts:230-234` is
      character-identical. Kept here rather than in the ledger because it is a read-boundary
      finding and NFR-002 of this very spec asserts the boundary is not widened. `suffix` is taken
      verbatim from the import path and passed to `path.join(moduleRoot, suffix)` with no
      containment check. Re-reproduced this round against the built `dist/`: with a module at
      `/tmp/escape-repro/mod`, `resolvePackageFiles('m/../outside/secretpkg', …)` returns
      `["/tmp/escape-repro/outside/secretpkg/leak.go"]` — a `readdirSync` of a directory outside
      the declared context, whose path `explore` then emits as a node id. `impact` drops it
      (`classifyLocation` requires the context prefix). Not reachable through valid Go — the
      toolchain rejects `..` in module import paths — so the trigger is a crafted or malformed
      source file in a scanned repo. The new `resolvePackageFiles` inherits it unchanged.
      Fix: after computing `pkgDir`, reject unless
      `path.resolve(pkgDir).startsWith(path.resolve(moduleRoot) + path.sep)`.
      Test to add: `resolvePackageFiles('m/../outside/x', …)` returns `[]`.

- [ ] **T015 ticked NFR-001 with no measurement recorded, and `checklist.md` is 0/26**
      [specs/004-go-package-impact-truthfulness/tasks.md T015,
      specs/004-go-package-impact-truthfulness/devit-log.md,
      specs/004-go-package-impact-truthfulness/checklist.md] — neither `devit-log.md` nor
      `stats.md` carries a timing, while all 15 tasks read `[x]` and all 26 checklist items read
      `[ ]`. `plan.md`'s analytic bound argues the `readdirSync` count is unchanged, which is true
      and beside the point: what grows is the reverse-edge fan-out, `importers × package size`.
      The numbers exist from the previous round (+0.4% and +9% on a realistic 1,891-file topology,
      +111% when 1,800 of 1,891 files import the 90-file package) and they vindicate the target
      for the topology the bug report describes, so this is bookkeeping, not a design change.
      Fix: paste the measured table into `devit-log.md`, and add one sentence to NFR-001 or the
      README noting the overhead scales with `importers × package size`.

### Low / Style

- [ ] **`granularityNote` renders `<pkg>` as `.` for a context-root Go target**
      [src/core/impact.ts:267] — `path.dirname(this.rel(targetAbsolute))` returns `'.'` when the
      target sits at the context root. Re-observed live this round: `"…no file in the scanned
      context imports ., but this is a package-level observation…"`. `contracts/impact-cli.md` §1
      specifies an `internal/repo`-shaped value. The same line yields backslash-separated package
      names on Windows.

- [ ] **Cached arrays are handed out by reference** [src/core/go-mod.ts:117, 121-122,
      src/core/resolver.ts:165, 178-179] — both `resolvePackageFiles` and `resolveAll` return the
      cached `string[]` directly, so any caller that sorts, reverses or splices it silently
      corrupts every later resolution of the same package. No current caller mutates; a latent
      hazard, not a live bug. Fix: freeze on insert, or return a copy.

- [ ] **FR-005 names three languages, one is tested** [src/core/impact.test.ts:107-115] — only a
      TypeScript target asserts `granularity: 'file'`. Python and PHP fixtures exist under
      `fixtures/` and would cost three lines each.

- [ ] **`resolveAll()` skips the tsconfig-alias branch that `resolve()` applies to Go sources**
      [src/core/resolver.ts:168-176 vs src/core/resolver.ts:84-92] — `resolve()` consults
      `tsConfigResolver.resolveAlias` before its `isGoSource` check; `resolveAll()` does not. A Go
      import specifier that happens to match a tsconfig path alias would resolve differently
      through the two entry points. Pathological, but the two methods are meant to agree by
      construction.

- [ ] **`//nolint:unused` targets a linter this repo does not run**
      [fixtures/go/internal/notify/aaa_marker.go:8] — CI is `.github/workflows/release.yml`, whose
      only check is `npm run test:run`; `package.json:lint` covers TypeScript only. No
      golangci-lint anywhere in the repository. Error handling for an impossible scenario.

- [ ] **Unrequested punctuation rewrites in the fixture README** [fixtures/go/README.md:15,
      fixtures/go/README.md:40] — two pre-existing lines had `—` replaced by `-` ("Entry point -
      wires handlers", "# JSON output - check resolved edges") while the same diff *adds* em
      dashes at `README.md:176-178` and inside the two contract strings at `src/cli/index.ts:31`
      and `src/output/impact.ts:62`. Neither direction is asked for by T001, and the two
      directions contradict each other inside one diff.

- [ ] **The determinism fix is language-agnostic but only the Go path is guarded, and the guard
      mocks a Node builtin for the whole test file** [src/core/impact.ts:252,
      src/core/impact.test.ts:19-33] — `files.sort()` changes which intermediate hop `chain`
      reports for TypeScript, Python and PHP contexts too, where `readdir` order previously
      decided; no test covers that half. The Go guard leans on `vi.mock('node:fs', …)`, which
      replaces the builtin for every module in `impact.test.ts`'s graph for the whole file, not
      just the one assertion. Both are acceptable as shipped — the sort is a strict improvement and
      the mock's default implementation is the real one — but the mock is a broad instrument for a
      narrow need, and the next person adding an `fs`-sensitive test to this file will not expect it.

## Deferred clarifications

`spec.md` carries no `## Open Questions` section — CLARIFY did not take the B7 fast-path skip.
Nothing deferred, nothing to lose.

## Writing register

The `flow-sdd-doctrine` skill installed in this environment ships
`references/{behavioral-guidelines,clean-arch,clean-code,conv-commits,english-only,hexagonal-ddd,sdd-speckit,tdd}.md`
and **no `writing-register` reference** (re-checked this round against the 2.22.0 plugin cache).
R1-R4 and R6-R8 therefore have no definition available to judge against, and inventing one would
be worse than abstaining. The table records that rather than a fabricated score.

| Rule | Fired in this phase | Note |
| --- | --- | --- |
| R1 | not assessed | definition unavailable in the installed doctrine |
| R2 | not assessed | idem |
| R3 | not assessed | idem |
| R4 | not assessed | idem |
| R5 | 0 (REVIEW) | Zero accented lines added across the tracked diff and all five untracked paths. Judged under `english-only`, which *is* defined. Pre-existing debt is GC-4. |
| R6 | not assessed | definition unavailable |
| R7 | not assessed | idem |
| R8 | not assessed | idem |

## Grievance reconciliation

`specs/GRIEVANCES.md` does not exist — this repository carries no ledger.

**Resolved**: none. With no ledger there is no open entry to close.

**Candidates** — pre-existing, neither introduced nor worsened by this diff, none carrying a
regulatory, security, data-loss or money dimension. They belong to a ledger, not to the issue list
above, and they move no verdict. Each was re-verified against the working tree for this review.
They are reported despite the absent ledger: dropping five verified findings because the file has
not been created yet would lose them entirely, and the orchestrator is the one that declares.

| Id | Locus | Finding | Impact if left |
| --- | --- | --- | --- |
| GC-1 | `src/core/go-mod.ts:299-302` | `_isInVendorOrCache` splits the *absolute* path, so a checkout under any directory named `vendor` or `.gomodcache` (e.g. `/srv/vendor/app`) filters out every `.go` file of every package. Identical on `main`. | The next reader gets a confident `0 dependent(s)` for an entire repository — the failure mode this spec exists to repair, one directory name away. |
| GC-2 | `src/core/resolver.ts:439-450` | `matchGlob` escapes `.` *after* expanding `**` to `.*`, so `**/node_modules/**` compiles to `^\.*/node_modules/\.*$` — "zero or more literal dots". `src/core/impact.ts:297-312` already carries a second, correct copy whose comment names the bug. | Two glob engines with divergent semantics in one package; `PathResolver.matchesPatterns` silently mis-filters, and the next person to reach for it will not read the comment 200 lines away. |
| GC-3 | `.specify/memory/constitution.md` | Still the unfilled spec-kit template: `[PROJECT_NAME]`, `[PRINCIPLE_1_NAME]`, `[GOVERNANCE_RULES]`. | Every feature's constitution gate is a vacuous pass, so the gate reports "compliant" whatever the change does. `plan.md` is right not to fill it from a bug-fix branch. |
| GC-4 | 30 files under `src/`, incl. `src/cli/index.ts` (29 accented lines) | 30 `.ts` files still carry French comments while the repo rule is English-only; this diff de-francized 4 of the 5 core files it touched and left `src/cli/index.ts` in place, widening the split. | A half-translated codebase reads as deliberate in neither language, and `flow-verifier` (conventions) will keep flagging whichever file the next diff happens to touch. |
| GC-5 | `README.md:367-368` | The `--json` key enumeration now lists 7 of the 10 payload keys; this diff appended `granularity` and `granularityNote` but `targetAbsolute`, `routePatterns` and `targetIsRoute` stay unlisted. | A `--json` consumer reading the README under-provisions its parser and rediscovers three fields by accident. |

## Stats audit

`stats.md` records SPECIFY, PLAN-core, PLAN-research, TASKS, ANALYZE-pre, ANALYZE-tasks-delta,
BATCH-PLAN and CHECKLIST-delta — and **still no IMPLEMENT row, no VERIFY row and no REVIEW row**,
though 15 tasks are ticked in `tasks.md`, the working tree carries the change, and this is the
second review of the branch. `devit-log.md` has the same hole: it ends at CHECKLIST, so the H1 fix
applied between the two reviews is journaled nowhere. Two consequences worth naming: the
implementer model is unknown, so `SameModelWarning` is unresolvable; and the "Aggregate / Total
sessions" row reads `0` against 12 recorded SESSION rows. This is a telemetry gap in the run, not
a defect of the feature — but it is the same gap the previous review reported, unchanged.

## Final checklist

- [x] FRs covered — FR-003 weak at the test level (M3), FR-005 thinly tested (L3)
- [x] Tests pass (unit + e2e) — 119/119 green, 9 files, `vitest run` under
      `node:20.18.1-bookworm-slim`. No e2e suite exists; this is a CLI with no UI surface, so
      WCAG does not apply (`plan.md` Test strategy)
- [x] Lint + typecheck pass — `eslint src`: 0 errors, 2 pre-existing `no-explicit-any` warnings in
      untouched files (`analyzer.ts:234`, `doctor.ts:51`); `tsc` clean
- [ ] Conventional Commits — nothing committed yet; `plan.md` Decision 4's split
      (`fix(go)` / `feat(impact)` / `test(fixtures)` / `docs(README)` → 1.1.0) is sound, and the
      translation of M1 needs a fifth `refactor:` commit if it stays
- [x] No hardcoded values — the five contract strings are named constants or single-site literals
      matching `contracts/impact-cli.md` §1 verbatim
- [x] English-only — respected by this diff; zero accented lines added. Pre-existing debt is GC-4
- [x] No personal-trace leak — the tracked diff and all five untracked paths were scanned for
      `/Users/`, `/home/`, `$HOME` and the username; zero hits in source, fixtures, tests and docs
