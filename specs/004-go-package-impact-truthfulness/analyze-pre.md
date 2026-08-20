# ANALYZE (Stage: pre-tasks) — 004-go-package-impact-truthfulness

**Date**: 2026-08-19 | **Scope**: spec ↔ plan ↔ data-model ↔ contracts ↔ constitution.
`tasks.md` NOT read (owned by the concurrent TASKS dispatch). Verdict is advisory at this stage.

## Resolutions (binding — apply before IMPLEMENT)

- **R1 — Field name is `granularity` / `granularityNote`, values `'file' | 'package'`.** PLAN beta wins.
  Beta's recorded argument ("an enum beats a boolean") does not discriminate — alpha proposed a string
  union too, so both are extensible to `'symbol'`. What decides it is (a) accuracy: what varies is the
  resolution unit, a fact about the method, whereas "confidence" implies a probability the tool never
  computes, and `confidence: 'exact'` is a category error; (b) the spec's own dominant vocabulary is
  already granularity — `spec.md` uses "package-granular" 8×, and 3 of its 5 "confidence" uses are prose
  ("reduced confidence", `spec.md:43,97`) while **no FR names a field** (FR-004/FR-005 say "a field");
  (c) amendment cost: 27 mentions in plan.md + quickstart.md against 73 across data-model.md,
  contracts/ and research.md, including a machine-readable schema with `$defs`, `allOf` and 3 examples.
- **R2 — `NOTE-PKG-STDERR` is emitted in BOTH text and `--json` modes.** FR-008 says "per invocation"
  unqualified; US2 scenario 6 illustrates text mode, it does not exclude JSON. `src/cli/index.ts:182`
  already encodes the reasoning verbatim ("Under --json, send this to stderr to keep stdout clean").
  Promote `contracts/impact-cli.md` §6 from "recommended, ANALYZE should settle" to normative.
- **R3 — Constitution gate is vacuous. Confirmed.** `.specify/memory/constitution.md` is the untouched
  spec-kit template (`[PRINCIPLE_1_NAME]` … `[GOVERNANCE_RULES]`, French scaffolding comments). No
  principle to comply with, none to waive. Repository-level gap, to be filled by `/speckit.constitution`
  outside this branch — do NOT author constitution content from a bug-fix branch.

## Findings

| Severity | Axis | Finding |
|---|---|---|
| High | Plan ↔ Data-model/Contracts | Field naming collision. `plan.md` (Summary, Decision 4 table, Complexity Tracking) and `quickstart.md` §4 say `confidence`/`confidenceReason` = `exact`/`package-level`; `data-model.md` §1-2/§5, `contracts/impact-cli.md` §1, `contracts/impact-result.schema.json` say `granularity`/`granularityNote` = `file`/`package`. **Apply R1**: amend `plan.md` (21 occurrences) and `quickstart.md` (6). Leave data-model.md, contracts/ and research.md as they stand. |
| High | Plan ↔ Contracts | `plan.md` "Project Structure / Documentation" asserts "No `contracts/` directory: the feature exposes no HTTP or RPC surface", yet `contracts/impact-cli.md` and `contracts/impact-result.schema.json` exist, fix the five normative output strings, and are cited by `data-model.md` §2/§5.5 and `research.md` D4. Add both to plan.md's doc tree and delete the denial. |
| High | Plan ↔ Data-model | Fixture placement contradiction. `data-model.md` §6 forbids any new fixture file under `cmd/**/main.go` ("otherwise existing route counts shift"); `plan.md` test strategy deliberately creates `fixtures/go/cmd/notifier/main.go` and `quickstart.md` §2 asserts the resulting route. **Verified against the repository: the stated hazard does not exist.** No test asserts a Go route count — `src/core/go-integration.test.ts:73,88` passes route patterns but asserts only `dependents`/`directDependents`; the only `routes).toHaveLength()` assertions are `src/core/impact.test.ts:59,75`, on the TypeScript fixtures. **`plan.md` wins**: drop the `cmd/**/main.go` row from `data-model.md` §6, keep the `*handler.go`/`*handlers.go`/`*routes.go`/`*router.go`/`internal/handlers/` rows, which still bind `aaa_marker.go` and `sender.go`. |
| Medium | Plan ↔ Data-model | Granularity derivation source diverges: `plan.md` Decision 3 derives from the target extension (`=== '.go'`); `data-model.md` §1 and `research.md` D2 derive from `ParserFactory.getParser(targetAbsolute).name === 'go'` (`src/parser/go.ts:14`). **Parser-based wins** — it avoids a second extension table drifting from the parser registry. Amend plan.md Decision 3. |
| Medium | Spec ↔ Contracts | Unbacked scope: `contracts/impact-cli.md` §4 inserts a new stdout line (`📦 Package-granular result: …`) into the **non-empty** Go text output. No FR requires it — FR-006 and US2 scenario 1 both scope the text change to the zero-dependents case. Either trace it to an FR or drop it; as written TASKS will emit an implementation task with no requirement behind it. |
| Medium | Plan ↔ Research | Two Docker pins for one feature: `plan.md` "Commands" and `quickstart.md` use `node:20.18.1-bookworm-slim`; `research.md` §4 uses `node:20.19-alpine`. **`node:20.18.1-bookworm-slim` wins** (fully pinned patch; `20.19-alpine` is a floating minor). Both satisfy `engines.node >=20.0.0` and `.github/workflows/release.yml:35` (`node-version: "20"`). Amend research.md §4. |
| Medium | Spec ↔ Plan | FR-011 remediation is incomplete. `plan.md` maps FR-011 to the "Known limitations" paragraph at `README.md:450-452` only. The sentence `spec.md:67` actually quotes — "analysis stays file/package-level and never fails" — lives at `README.md:176-177`, in the optional-`gopls` blockquote, and no artifact plans to touch it. Fixing 450 alone leaves the misleading claim in place ~270 lines earlier. Add `README.md:176-177` to the FR-011 scope. |
| Low | Constitution ↔ Plan | R3 confirmed by direct read. Both PLAN legs' "vacuous pass, no waiver" reading is correct and no waiver-without-sunset risk exists (there are zero waivers). Record the unfilled constitution as a repo-level gap, not a defect of this feature. |
| Low | Plan ↔ Repository | Both of PLAN beta's input corrections confirmed. (a) `package.json:53` declares `"node": ">=20.0.0"` — the `>=18` in the PLAN input was wrong. (b) `.claude-flow/state/flow-context7-fetcher.json` vitest entry carries `"version": "4.0.18"` but `"actualVersionResolved": "4.0.7"` and links to `v4.0.7` docs, and its `manifestDrift` summary calls this "minor within range" — false: 4.0.7 does not satisfy `^4.0.18` (`package.json:75`). Declared range is authoritative. `research.md` §4 records this correctly; `plan.md` "Version evidence" repeats "vitest 4.0.18 … `speculative: false`" without the caveat — add it. No decision in either leg depends on the vitest version. |
| Low | Spec ↔ Data-model | Vocabulary drift after R1: `spec.md:111` names the Key Entity "Impact Confidence" and `spec.md:120` (SC-003) says "confidence marker", while the shipped field is `granularity`. No FR is invalidated (no FR names a field). At the next spec touch, add a one-line mapping so a reader does not hunt for a `confidence` key. |
| Low | Plan ↔ Repository | `README.md:367` enumerates the `--json` payload keys and will omit `granularity`. FR-011 mandates only the limitations paragraph, so this is optional — but fold it into the FR-011 task. Note `research.md` §8.3 misplaces it: the two edit sites are ~80 lines apart (`367` and `450`), not "three lines apart". |

## Counters

```
Critical: 0
High:     3
Medium:   4
Low:      4
```

**Verdict: CHANGES REQUIRED**

No Critical: every conflict has a decided resolution above and none is a correctness or security
regression. The three High findings are artifact-consistency defects that MUST be amended before
IMPLEMENT, because TASKS reads `plan.md` and the contracts as a single source. Stage `tasks-delta`
must re-check that (a) no task names `confidence`/`confidenceReason`, (b) the fixture task creates
`fixtures/go/cmd/notifier/main.go`, (c) an FR-011 task covers both `README.md:176-177` and `:450-452`.
