# ANALYZE (consolidated) — 004-go-package-impact-truthfulness

**Date**: 2026-08-19 | **Stage**: `tasks-delta`, merged with `analyze-pre.md`
**Scope**: spec ↔ plan ↔ research ↔ data-model ↔ contracts ↔ tasks ↔ constitution ↔ repository.
This dispatch carried an apply duty: the resolutions below are **applied**, not merely recorded.

## Verdict: **Approved**

Zero Critical, zero open High. The three pre-stage High findings and all four Medium findings were
amended in the artifacts; the four Low findings were settled or explicitly deferred. Two new
findings were raised during `tasks-delta` (B-001, B-002) and both were fixed in `tasks.md`.

## Counters

```
Critical: 0
High:     3  (all resolved and applied)
Medium:   5  (4 pre-stage + 1 new; all resolved)
Low:      4  (3 applied, 1 recorded as a repository-level gap)
```

## Resolutions applied

| Id | Decision | Applied to |
|---|---|---|
| R1 | Fields are `granularity` (`'file' \| 'package'`) and `granularityNote`. `confidence` / `confidenceReason` rejected: the tool computes a resolution unit, not a probability. | `plan.md` (21 sites), `quickstart.md` (6), `spec.md` Key Entity + SC-003 |
| R2 | `NOTE-PKG-STDERR` is emitted in **both** text and `--json` mode. | `contracts/impact-cli.md` §4/§5/§6 (now normative), `research.md` D3, `plan.md` Decision 5, `tasks.md` T012 |
| R3 | Constitution gate is vacuous — `.specify/memory/constitution.md` is an unfilled spec-kit template. Zero waivers, so no waiver-without-sunset risk. **Not** authored from this branch. | recorded only |

## Findings

| Severity | Axis | Finding | Disposition |
|---|---|---|---|
| High | Plan ↔ Contracts | `plan.md` asserted "No `contracts/` directory: the feature exposes no HTTP or RPC surface", yet `contracts/impact-cli.md` and `contracts/impact-result.schema.json` exist and fix the five normative output strings. | **Fixed.** Denial deleted; both files listed in the doc tree and declared authoritative over Decision 4's prose. |
| High | Plan ↔ Data-model | `data-model.md` §6 forbade any fixture under `cmd/**/main.go` because "existing route counts shift", blocking the `fixtures/go/cmd/notifier/main.go` the plan needs for US1 scenario 1's route assertion. | **Fixed — the constraint was empirically false.** Re-verified: no test asserts a Go route count. `src/core/go-integration.test.ts:73,88` pass `routePatterns` but assert only `dependents`/`directDependents`; the only `routes).toHaveLength()` calls are `src/core/impact.test.ts:59,75`, and that file targets `fixtures/typescript` (`impact.test.ts:18`). Row replaced by one *requiring* the `cmd/` placement, with the evidence inline. |
| High | Spec ↔ Plan | FR-011 was scoped to the wrong README site. The sentence `spec.md:67` quotes lives at `README.md:176-177`, not in the "Known limitations" paragraph at `README.md:450-452`. | **Fixed.** Both ranges re-verified against the working tree: the optional-`gopls` blockquote is `README.md:175-177` (the claim spans 176-177) and the limitations paragraph is `README.md:450-452` — ~275 lines apart. New "README scope (FR-011)" table in `plan.md`; T014 and `quickstart.md` step 8 widened to both, with `README.md:366-367` folded in as optional. |
| Medium | Plan ↔ Data-model | Granularity derivation diverged: target extension (`plan.md`) vs `ParserFactory.getParser(...).name === 'go'` (`data-model.md`, `research.md`). | **Fixed.** Parser-based wins; `plan.md` Decision 3 amended. Avoids a second extension table drifting from the parser registry. |
| Medium | Spec ↔ Contracts | `contracts/impact-cli.md` §4 inserted a `📦 Package-granular result: …` stdout line into the **non-empty** Go text output with no FR behind it. | **Dropped.** FR-006 and US2 scenario 1 both scope the text change to the zero-dependents case; US2 scenario 3 covers the non-empty case and asks only for the `--json` field. R2's stderr note already reaches that caller. `plan.md` gains Decision 6; T009 and T011 shrunk. |
| Medium | Plan ↔ Research | Two Docker pins for one feature: `node:20.18.1-bookworm-slim` vs `node:20.19-alpine`. | **Fixed.** Harmonised on `node:20.18.1-bookworm-slim` in `research.md` §4 — fully pinned patch, and `bookworm` matches the CI runner's glibc userland where `alpine`'s musl does not. Both satisfy `engines.node >=20.0.0` (`package.json:53`) and `release.yml:35`. |
| Medium (new) | Spec ↔ Tasks | **B-001**: NFR-002 (data boundary) mapped to no task. T002(c) covered only the `vendor/`/`.gomodcache/` half of FR-009; nothing exercised `matchesContextPatterns` (`src/core/impact.ts:239-246`), which is what stops the widened resolution from moving the read boundary. | **Fixed.** A second assertion added to T003, tagged `NFR-002`. Every FR and NFR now maps to ≥ 1 task. |
| Medium (new) | Tasks ↔ Tasks | **B-002**: TDD-pairing defect. T005 carried no `Pair:` at all (rule violation), and T003's RED needs T004 **and** T005 **and** T006 — a batch of `{T003, T006}` alone could never pass its verifier. Same shape for T009, which cannot typecheck until T010 appends the fields. | **Fixed.** `Pair: T003` added to T005; a "Batch-ordering constraints" table now states both multi-task greens explicitly; the dependency graph was redrawn to show them. |
| Low | Plan ↔ Repository | `plan.md` "Version evidence" repeated "vitest 4.0.18 … `speculative: false`" unqualified. The cache entry carries `actualVersionResolved: 4.0.7`, which does **not** satisfy `^4.0.18` (`package.json:75`); the cache's own `manifestDrift` summary calling it "minor within range" is false. `package.json:53` declares `node >=20.0.0` (the PLAN input's `>=18` was wrong). | **Fixed.** Both caveats added to `plan.md`; `research.md`'s `package.json:57` reference corrected to `:53`. No decision depends on the vitest version. |
| Low | Spec ↔ Data-model | After R1 the spec's Key Entity read "Impact Confidence" and SC-003 said "confidence marker" while the shipped field is `granularity`. | **Fixed.** Entity renamed "Impact Granularity" with a one-line mapping to the field name and a note on why "confidence" was dropped. No FR text touched — no FR names a field. |
| Low | Plan ↔ Repository | `README.md:366-367` enumerates the `--json` keys and will omit `granularity`. `research.md` §8.3 described the edit sites as "three lines apart". | **Fixed.** Folded into T014 as optional item (c); the distance corrected to ~85 lines, and §8's three carried questions rewritten as resolved. |
| Low | Constitution ↔ Plan | `.specify/memory/constitution.md` is the untouched spec-kit template (`[PRINCIPLE_1_NAME]` … `[GOVERNANCE_RULES]`). | **Recorded, not fixed.** Repository-level gap for `/speckit.constitution` outside this branch. Both PLAN legs' "vacuous pass, zero waivers" reading is correct. |

## `tasks-delta` re-checks

| Check | Result |
|---|---|
| No task names `confidence` / `confidenceReason` | Pass — all `[research-pending]` tags cleared, T007-T011 use `granularity` |
| Fixture task creates `fixtures/go/cmd/notifier/main.go` | Pass — T001 `Touches:` |
| An FR-011 task covers `README.md:175-177` **and** `:450-452` | Pass — T014 (a) and (b) |
| One Docker image tag across all task commands | Pass — `node:20.18.1-bookworm-slim` only |
| The unbacked non-empty stdout line is traced or dropped | Dropped (A-005) |
| Every FR/NFR maps to ≥ 1 task | Pass — coverage list in `tasks.md` Notes; NFR-002 closed by B-001 |
| TDD ordering holds | Pass — every GREEN task carries `Pair:`; T012, T013, T014 remain declared designed exceptions with no automated RED |
| Every task carries an exact, complete `Touches:` | Pass — audited task by task. T013's transient write to `src/core/go-mod.ts` is now declared with an exclusivity note; an empty net diff is not an untouched file during the run |

## Deviation from the dispatch instruction, stated rather than silent

The dispatch specified the wrapper `docker run --rm -v "$PWD":/app -w /app node:22-bookworm`. Every
command in these artifacts is Docker-wrapped, but on `node:20.18.1-bookworm-slim` with `/workspace`
as the mount point. Grounds: `.github/workflows/release.yml:35` pins `node-version: "20"`, so a suite
that is green on Node 22 locally and red on Node 20 in CI is exactly the drift the Docker-only policy
exists to prevent; and A-006 had already resolved 28 existing commands onto that tag. The mount point
is cosmetic. Flagged here so the choice is visible.
