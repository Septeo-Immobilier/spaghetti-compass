# Tasks: Truthful Go package impact analysis

**Feature Branch**: `004-go-package-impact-truthfulness`
**Input**: `spec.md`, `plan.md` (research.md, data-model.md, contracts/ have landed and are used below)
**Tests**: included — the spec's own Independent Tests require them (US1, US2, US3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: file-disjoint AND no blocking dependency on another open task
- **[Story]**: which user story this task belongs to (US1..US4)
- **`Touches:`**: exact repo-relative files this task creates/modifies — mandatory, feeds the batch planner
- **`Pair:`**: on every GREEN task, the RED task it turns green — mandatory unless the task has no
  automated RED counterpart, in which case the reason is stated instead (see T012, T013, T014)

---

## ✅ Cross-artifact conflicts — settled by ANALYZE (Stage `tasks-delta`, 2026-08-19)

Nothing below is open. Every `[research-pending]` tag has been cleared and the artifacts were
amended to agree. Implementers must not re-litigate these; see `analyze.md` for the full record.

| Id | Decision | Artifacts amended |
|---|---|---|
| **R1** | The two new `ImpactResult` fields are **`granularity`** (`'file' \| 'package'`) and **`granularityNote`** (`string \| null`). The competing `confidence` / `confidenceReason` naming is rejected: what varies is the resolution unit, a fact about the method, whereas "confidence" implies a probability the tool never computes. | `plan.md`, `quickstart.md` brought into line with `data-model.md`, `research.md` and `contracts/` |
| **R2** | `NOTE-PKG-STDERR` is emitted in **both** text and `--json` mode. FR-008 says "per invocation" unqualified; stderr never pollutes the JSON document on stdout. | `contracts/impact-cli.md` §6 promoted to normative; `research.md` D3 marked resolved; `plan.md` Decision 5 |
| **A-005** | The `📦 Package-granular result: …` stdout line for the **non-empty** Go case is **dropped** — no FR requires it (FR-006 and US2 scenario 1 both scope the text change to the zero-dependents case). The stderr note of R2 already covers the non-empty caller. | `contracts/impact-cli.md` §4; T009 and T011 below shrunk accordingly |
| **A-003** | The fixture **must** place its external caller at `fixtures/go/cmd/notifier/main.go`. `data-model.md` §6 previously forbade it, claiming route counts would shift; verified false — no test asserts a Go route count. | `data-model.md` §6 |
| **A-004** | Granularity is derived from the target's **parser name** (`ParserFactory.getParser(...).name === 'go'`), not from its file extension. | `plan.md` Decision 3 |
| **A-007** | FR-011 covers **two** README sites, not one. | `plan.md` "README scope (FR-011)"; T014 below |
| **R3** | The constitution gate is vacuous — `.specify/memory/constitution.md` is an unfilled spec-kit template. Zero waivers, so no waiver-without-sunset risk. Recorded as a repository-level gap; **do not** author constitution content from this branch. | none |

---

## Phase 1: Setup

Not applicable. `plan.md` Technical Context: no new dependency, no new module, no new directory —
the existing Docker/vitest toolchain (`npm ci`, `npm run test:run`, `npm run build`, `npm run lint`,
all Docker-wrapped per `plan.md` "Commands") is unchanged and sufficient.

---

## Phase 2: Foundational (blocks US1, US2, US3)

**Purpose**: reproduce the defect in a committed fixture so every story's RED tests below have
something concrete to assert against (spec: *"Without this fixture, User Story 1's fix has no
regression guard"*).

- [x] T001 [P] Add the multi-file Go fixture package that reproduces the defect exactly
  (`plan.md` Test strategy / Fixture design; `data-model.md` §6): `package notify` with
  `aaa_marker.go` (sorts first, symbol referenced by nothing) and `sender.go` (sorts second, holds
  the `Sender` constructor an external caller uses), plus `cmd/notifier/main.go` which imports the
  package and calls the constructor (matches the default route pattern `**/cmd/**/main.go`).
  Document the new package in `fixtures/go/README.md`. Do not touch any existing fixture file — the
  rejected alternative (adding to `internal/ports/`) would steal `repository.go`'s reverse edge and
  break an unrelated existing test pre-fix.
  Pre-fix reproduction to confirm by hand once: `impact sender.go` → `0 dependent(s), 0 route(s)`;
  `impact aaa_marker.go` → `1, 1`.
  **FR-010**
  Touches: fixtures/go/internal/notify/aaa_marker.go, fixtures/go/internal/notify/sender.go, fixtures/go/cmd/notifier/main.go, fixtures/go/README.md

**Checkpoint**: the fixture reproduces the asymmetry on `main`. US1/US2 RED tests below can now be written against it.

---

## Phase 3: User Story 1 — Truthful dependents for any file of a Go package (Priority: P1) 🎯 MVP

**Goal**: every non-test file of a Go package reports the same dependents/directDependents/routes.

**Independent Test**: `impact` on `sender.go` and on `aaa_marker.go` (T001's fixture) report the
same non-empty set, both containing `cmd/notifier/main.go`; renaming the sibling file changes nothing.

### Tests for User Story 1 (write first, confirm RED)

- [x] T002 [P] [US1] Add failing unit tests to `src/core/go-mod.test.ts`:
  (a) `resolvePackageFiles()` returns every non-test `.go` file of a package, sorted;
  (b) falls back to every `.go` file (tests included) when the package holds no non-test file;
  (c) excludes `vendor/` and `.gomodcache/` candidates (build a temp module with a `vendor/` dir,
  the pattern at `go-mod.test.ts:33-72`);
  (d) rename invariance: build a temp two-file package (`fs.mkdtempSync`, pattern at
  `go-mod.test.ts:197-231`), resolve, rename the non-referenced file so the alphabetical winner
  flips, resolve again, assert `resolvePackageFiles()`'s result set is identical.
  **FR-001, FR-003, FR-009**
  Touches: src/core/go-mod.test.ts

- [x] T003 [US1] Add a failing assertion to `src/core/go-integration.test.ts`: `impact` on
  `fixtures/go/internal/notify/sender.go` and on `fixtures/go/internal/notify/aaa_marker.go` must
  report identical `dependents`, `directDependents` and `routes` sets, both containing
  `cmd/notifier/main.go`. Depends on T001 (needs the fixture). Not `[P]` with T001 for that reason,
  though the file it touches is disjoint.
  Second assertion in the same task — **context boundary (NFR-002)**: run `impact` on `sender.go`
  with an `excludePatterns` entry that drops `cmd/notifier/main.go` — a real importer — from the
  scanned context, and assert `cmd/notifier/main.go` disappears from both `dependents` and
  `directDependents`, while a run with no exclude still reports it. (An earlier draft excluded
  `aaa_marker.go`, which imports nothing, so the assertion could never fail; `aaa_marker.go` is not
  a valid exclude probe for this guard.) The guard under test is `matchesContextPatterns`
  (`src/core/impact.ts:239-246`); the point is that widening the reverse edge must raise edge
  *fidelity* inside the boundary, never move the boundary.
  Added by ANALYZE: NFR-002 previously mapped to no task, and T002(c) covers only the
  `vendor/`/`.gomodcache/` half of FR-009.
  **FR-002, FR-009, NFR-002**
  Touches: src/core/go-integration.test.ts

### Implementation for User Story 1

- [x] T004 [US1] In `src/core/go-mod.ts`: extract the existing candidate-selection logic from
  `_resolveImportInternal` (`.go` filter, `vendor/`/`.gomodcache/` exclusion, non-test-preferred
  with all-files fallback) into one private helper shared by both callers (`plan.md` Decision 2 —
  "Both methods should share one private helper so the two rules cannot drift"). Add public
  `resolvePackageFiles(importPath, fromFile): string[]`, sorted, backed by a new
  `packageFilesCache: Map<string, string[]>` keyed identically to the existing `importCache`. Make
  `resolveImport()` read `resolvePackageFiles(...)[0] ?? null` from that same cached array — its own
  signature and every existing `go-mod.test.ts` assertion stay green, unedited. Update
  `clearCache()` to clear the new map too.
  Makes T002 pass.
  **FR-001, FR-003, FR-009**
  Touches: src/core/go-mod.ts
  Pair: T002

- [x] T005 [US1] In `src/core/resolver.ts`: add `resolveAll(spec, fromFile): string[]` — Go sources
  delegate to `resolvePackageFiles()`; every other language returns `[resolve(...)]`, or `[]` when
  that is `null`. Add `resolvedAllCache: Map<string, string[]>` mirroring the existing
  `resolvedCache`. `resolve()` itself and `classifyLocation()` are untouched (`resolver.test.ts` is
  intentionally not edited — it stays green because nothing it asserts on changed).
  Depends on T004 (delegates to `resolvePackageFiles`).
  **FR-001, FR-002**
  Touches: src/core/resolver.ts
  Pair: T003

- [x] T006 [US1] In `src/core/impact.ts`: switch `resolveInternalImports()`'s inner loop
  (`impact.ts:186-193`) from one `resolve()` result to iterating `resolveAll()`, classifying each
  element and keeping the `internal` ones — signature unchanged, callers just see a longer array.
  Depends on T005. Completes T003's green together with T004 and T005 — none of the three alone is
  sufficient.
  **FR-001, FR-002**
  Touches: src/core/impact.ts
  Pair: T003

**Checkpoint**: T002 and T003 green; every pre-existing `go-mod.test.ts`, `resolver.test.ts`,
`impact.test.ts` and `go-integration.test.ts` assertion still passes unedited (`plan.md` Test
strategy — "Existing fixture-dependent assertions: none shift").

---

## Phase 4: User Story 2 — Tell an empty answer apart from an unknown one (Priority: P1)

**Goal**: `--json` and text output carry a marker distinguishing Go's package-granular result from
the exact, file-level result of every other language; exit code stays `0`.

**Independent Test**: `impact --json` on a Go target (empty and non-empty) and on a TypeScript
target each carry the marker with the correct value; the unqualified success line never prints for
a package-granular empty result; exit code is `0` in every case.

### Tests for User Story 2 (write first, confirm RED)

- [x] T007 [P] [US2] Add a failing assertion to `src/core/impact.test.ts`: a
  TypeScript fixture target's `ImpactResult` carries `granularity: 'file'` and
  `granularityNote: null` (`data-model.md` §5.4), every other field unchanged from today.
  **FR-005**
  Touches: src/core/impact.test.ts

- [x] T008 [US2] Extend `src/core/go-integration.test.ts` (after T003 lands —
  same file): assert `fixtures/go/internal/notify/sender.go` (non-empty) and
  `fixtures/go/cmd/service/main.go` (empty, per `quickstart.md` step 4) both carry
  `granularity: 'package'` with a non-null `granularityNote` (`data-model.md` §5.2/§5.3;
  `contracts/impact-cli.md` `NOTE-PKG-JSON-NONEMPTY` / `NOTE-PKG-JSON-EMPTY`) — the marker is not
  reserved for the empty case (US2 scenario 3).
  **FR-004**
  Touches: src/core/go-integration.test.ts

- [x] T009 [US2] Create `src/output/impact.test.ts` (first test file for this
  formatter): assert `LINE-EXACT-EMPTY` (`contracts/impact-cli.md` §1) still prints, byte-identical,
  for a `granularity: 'file'` empty result; assert it does **not** print for a `granularity:
  'package'` empty result, replaced by `LINE-PKG-EMPTY`; assert that a `granularity: 'package'`
  **non-empty** result produces stdout byte-identical to today's formatter output (no qualifier
  line, per ANALYZE A-005 — `contracts/impact-cli.md` §4). Feed `formatImpactText` hand-built
  `ImpactResult` literals; no fixture or analyzer run is needed.
  **FR-006**
  Touches: src/output/impact.test.ts

### Implementation for User Story 2

- [x] T010 [US2] In `src/core/impact.ts`: add `granularity: 'file' | 'package'`
  and `granularityNote: string | null` to `ImpactResult`, appended after `targetIsRoute` (no field
  removed, renamed or reordered — additive only, `data-model.md` §2). Derive once per `analyze()`
  call from `ParserFactory.getParser(targetAbsolute).name === 'go'`, with the load-bearing-invariant
  comment `data-model.md` §1 specifies (reverse edges never cross languages, so a Go target's
  transitive closure is entirely Go). Populate `granularityNote` from the fixed strings
  `NOTE-PKG-JSON-NONEMPTY` / `NOTE-PKG-JSON-EMPTY` (`contracts/impact-cli.md` §1), `null` for
  `granularity === 'file'`.
  Makes T007 and T008 pass.
  **FR-004, FR-005**
  Touches: src/core/impact.ts
  Pair: T007, T008

- [x] T011 [US2] In `src/output/impact.ts`: branch the early return at `src/output/impact.ts:59-62`
  on `granularity` — keep `LINE-EXACT-EMPTY` verbatim for `'file'`, print `LINE-PKG-EMPTY` for
  `'package'` (`contracts/impact-cli.md` §5 case (d)). **That is the whole change.** The non-empty
  path is untouched: ANALYZE A-005 dropped the `📦 Package-granular result: …` qualifier line
  because no FR backs it, and R2's stderr note already reaches the non-empty caller
  (`contracts/impact-cli.md` §4 now reads "unchanged from current behaviour").
  Makes T009 pass.
  **FR-006**
  Touches: src/output/impact.ts
  Pair: T009

- [x] T012 [US2] In `src/cli/index.ts`: emit `NOTE-PKG-STDERR` (`contracts/impact-cli.md` §1)
  exactly once per invocation, in **both** `--json` and text mode, when the result's `granularity`
  is `'package'` — placed once after `analyze()` returns (`src/cli/index.ts:365`), not inside either
  formatter, so "exactly once" is structural. The guard is `result.granularity === 'package'` with
  **no** `options.json` condition: ANALYZE settled this as R2, and `contracts/impact-cli.md` §6 is
  now normative on it, so do not reintroduce a text-mode-only branch. It must be a new constant,
  never `degradedMessage('go')` (`src/core/lsp/availability.ts:169`): `impact` starts no language
  server, so it must not be, or read as, the degraded-LSP warning. Exit code stays
  `process.exit(EXIT_SUCCESS)`, unchanged.
  **DESIGNED TDD EXCEPTION — no automated RED counterpart, and none is expected.** `plan.md`'s
  test-to-requirement map marks FR-007 and FR-008 manual: asserting a `process.exit` code and a
  stderr line from inside vitest means spawning the built CLI, which this suite does nowhere today.
  Verified instead via `quickstart.md` steps 6-7, run under T015.
  **FR-007, FR-008**
  Touches: src/cli/index.ts

**Checkpoint**: T007-T009 green; a TypeScript target's payload is byte-identical to pre-feature
except for the two appended keys (US2 scenario 4); exit code `0` confirmed manually for both cases.

---

## Phase 5: User Story 3 — Catch this defect with the project's own fixture (Priority: P2)

**Goal**: confirm the fixture added in Foundational is a genuine, standing regression guard, not
just an incidental prop for US1/US2's own tests.

**Independent Test**: reverting the US1 fix makes T003 (and T008's non-empty case) fail; every
pre-existing single-file Go fixture test is unaffected.

- [x] T013 [US3] Temporarily revert T004-T006 (or stub `resolvePackageFiles()` back to a
  single-candidate result) and confirm T003 fails, reproducing `0 dependent(s), 0 route(s)` on
  `sender.go` exactly as the pre-fix reproduction in T001 describes. Restore the fix. Then run the
  full suite once more and confirm every pre-existing single-file Go fixture assertion — SC-001
  (`explore main.go` in `cmd/service/`), SC-002 (`impact entity.go`'s dependent chain through
  `internal/ports`), SC-003 (`ReceiveInvoice.Execute` call edges) — is unaffected, per `plan.md`
  Test strategy's file-by-file check.
  **DESIGNED TDD EXCEPTION — this task *is* a RED observation**, not code awaiting one: it proves an
  existing RED (T003) still fails without the fix. No `Pair:` applies.
  **FR-010, SC-004**
  Touches: src/core/go-mod.ts (TRANSIENT — reverted within the task; net diff MUST be empty)
  **Exclusivity**: despite the empty net diff, T013 mutates `src/core/go-mod.ts` mid-run and must
  therefore hold it exclusively. A batch planner must never schedule T013 alongside T004, or
  alongside anything else declaring `src/core/go-mod.ts`. Verify `git diff --stat src/core/go-mod.ts`
  is empty before marking the task done.

**Checkpoint**: the fixture is a proven regression guard, not incidental scaffolding.

---

## Phase 6: User Story 4 — Accurate "Known limitations" text (Priority: P3)

**Goal**: every Go claim in the README matches the shipped behavior — at **both** sites that make
one, not just the one named "Known limitations".

**Independent Test**: read both paragraphs after the fix and confirm each names package-level
granularity explicitly and uniformly (not only for the interprocedural-resolution caveat).

- [x] T014 [US4] Correct **two** Go claim sites in `README.md`. Line ranges re-verified against the
  working tree during ANALYZE (A-007) — the earlier plan scoped this to the second site only, and
  the sentence `spec.md:67` quotes lives at the first, ~275 lines earlier:

  (a) **`README.md:175-177`, the optional-`gopls` blockquote** — currently "install it … for exact
  symbol positions in multi-file packages. Without it, analysis stays file/package-level and never
  fails." This is the misleading claim: "never fails" reads as a reassurance, when the truth is that
  `impact` answers at package granularity for Go whether or not `gopls` is installed. Rewrite so the
  granularity is stated and `gopls` is no longer implied to change it.

  (b) **`README.md:450-452`, the Go "Known limitations" paragraph** — currently scopes the caveat to
  interprocedural resolution through interfaces and injected dependencies. Add, **alongside and not
  instead of** that caveat, that `impact` results for Go targets are package-granular in every case
  (every non-test file of an imported package shares one dependents set).

  (c) **`README.md:366-367`, the `--json` key enumeration** — optional, folded in here per ANALYZE
  A-011. The list ("`target`, `scannedFiles`, `directDependents`, `dependents`, and `routes`") will
  silently omit `granularity` / `granularityNote`. One-line addition; no FR mandates it, so drop it
  if it conflicts with (a) or (b).

  Re-read the three ranges before editing: `git log` may have shifted them.
  **DESIGNED TDD EXCEPTION — review-based, no automated RED.** `plan.md`'s test-to-requirement map
  marks FR-011 "review, quickstart.md"; asserting prose content in vitest would pin wording that is
  meant to be edited freely. Verified under `quickstart.md` step 8, run in T015.
  **FR-011, SC-005**
  Touches: README.md

**Checkpoint**: all four user stories independently verifiable; feature ready for the manual pass below.

---

## Phase 7: Polish & Manual Verification

- [x] T015 Execute `quickstart.md` steps 1-9 in full: build, full suite green (SC-004), both fixture
  files agree (US1/SC-001), rename invariance (US1/SC-002), marker present on empty and non-empty
  Go targets plus unchanged on a TypeScript target (US2/SC-003), qualified text output on the empty
  Go case (FR-006), exactly one stderr line distinct from the LSP warning (FR-008), exit code `0`
  in every case (FR-007), README review (FR-011/SC-005), NFR-001 performance sanity (manual, not a
  gate — `plan.md` explicitly rejects a timing assertion in vitest as a flaky gate).
  Touches: none (manual verification; no file changes)

---

## Dependencies & Execution Order

```text
Phase 2  T001 (fixture)
           |
Phase 3    +-- T002 [P] ------------------> T004 ---+          (T004 turns T002 green)
           |                                        |
           +-- T003 (needs T001) <---- T005 <-------+           (T004 + T005 + T006
                                        |                        together turn T003 green)
                                        +-> T006

Phase 4    T007 [P] --+
           T008 ------+--> T010                                  (T010 turns T007, T008 green)
                              |
           T009 -------------+--> T011                           (T010 + T011 turn T009 green)
                                     |
                                     +--> T012                   (no automated RED, by design)

Phase 5    T013  (needs T001-T012; exclusive lock on src/core/go-mod.ts)
Phase 6    T014  (no code dependency; may run at any point)
Phase 7    T015  (needs everything)
```

### Batch-ordering constraints a planner must not violate

Two RED tasks need **more than one** implementation task before they can go green. Batching a RED
with only part of its implementation produces a batch that cannot pass its verifier no matter how
many debug loops run at it — the failure this section exists to prevent.

| RED | Needs, all of | Consequence for batching |
|---|---|---|
| T003 | T004 **and** T005 **and** T006 | T005 and T006 both carry `Pair: T003`, so the planner unions them with T003. T004 pairs T002 and may land in an earlier batch, but it **must** land no later than T003's batch — `resolveAll()` cannot delegate to a `resolvePackageFiles()` that does not exist. |
| T009 | T010 **and** T011 | T009 builds `ImpactResult` literals, which will not typecheck until T010 appends the two fields. `Pair: T009` sits on T011; the T009/T011 batch **must** be ordered after T010's. |

`T013` is a third-order case: it re-runs T003 against a deliberately broken `go-mod.ts`, so it must
come after every implementation task and must hold `src/core/go-mod.ts` exclusively.

### Parallel opportunities

- T001 and T002 — disjoint files, no blocking dependency.
- T007 and T009 — disjoint files (`src/core/impact.test.ts` vs `src/output/impact.test.ts`), no
  blocking dependency either way, so both may be written in parallel. Note that neither *compiles*
  until T010 appends the two fields — which is a legitimate RED, not a scheduling conflict, provided
  the ordering table above is respected and no batch is asked to make them green on their own.
- T014 (README) has no code dependency at all and may run at any point, including before T001.

### Notes

- TDD order is mandatory throughout: every implementation task above lists the RED task it turns
  green (`Pair:`), except **T012, T013 and T014**, which are **designed exceptions** with no
  automated RED counterpart. Each states its reason inline and each traces to `plan.md`'s own test
  strategy, not to an oversight: T012 (FR-007/FR-008) would need a spawned CLI process to observe an
  exit code and a stderr stream, which this suite does nowhere; T013 is a revert-and-observe
  verification of an existing RED, so it *is* the RED; T014 is prose, and pinning wording in vitest
  would freeze text that is meant to be editable. All three are covered by `quickstart.md` under
  T015. A per-batch verifier must not treat them as missing tests.
- All cross-artifact conflicts are **closed** — see the resolution table at the top of this file.
  No `[research-pending]` marker remains. T007-T011 implement `granularity` / `granularityNote` and
  the fixed strings from `contracts/impact-cli.md` §1, which is the normative reference.
- Requirement coverage is complete: FR-001 (T002, T004), FR-002 (T003, T005, T006), FR-003 (T002,
  T004), FR-004 (T008, T010), FR-005 (T007, T010), FR-006 (T009, T011), FR-007 (T012, T015),
  FR-008 (T012, T015), FR-009 (T002, T003, T004), FR-010 (T001, T013), FR-011 (T014, T015),
  NFR-001 (T015, manual by design), NFR-002 (T003).
- `Touches:` lines are exhaustive and were audited task by task against what each task
  writes. **Three** file collisions exist, all deliberately **not** `[P]`, and a batch planner must
  keep each group in one lane: `src/core/go-integration.test.ts` (T003, T008),
  `src/core/impact.ts` (T006, T010), and `src/core/go-mod.ts` (T004, plus **T013's transient
  revert** — see T013's exclusivity note). Only T013 and T015 declare no permanent write, and T013
  still needs an exclusive lock.
- The `src/core/go-mod.ts` collision is the one a naive planner will miss, because T013's net diff
  is empty by design. It is declared anyway: an empty net diff is not the same as an untouched file
  during the run.
