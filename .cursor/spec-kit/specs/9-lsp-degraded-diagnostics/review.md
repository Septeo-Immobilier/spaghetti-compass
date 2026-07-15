# Review Report - Signal Degraded LSP Mode and Diagnose PATH

**Date**: 2026-07-05
**Reviewer**: AI Agent (Claude Opus 4.8)
**Branch**: `9-lsp-degraded-diagnostics`
**Review Duration**: ~14m

## Summary

The core feature is implemented correctly and behaves exactly as specified: degraded-mode warnings are emitted to `stderr` (verified live for PHP), `--json` `stdout` stays strictly parseable, TypeScript is silent, and the `doctor` command (text + `--json`) matches its contract byte-for-byte. The main gap is test coverage: 6 of the spec's explicitly-requested CLI/integration test tasks (T008–T010, T013, T015–T016) were not implemented, so the user-story acceptance behavior is only manually verified, not guarded against regression. A few minor quality issues (a new `any`, a small DRY/dead-code duplication, cosmetic table misalignment) remain.

## Positive Points

- **Contract fidelity**: `src/core/lsp/availability.ts` matches `availability.contract.md` exactly — `LSP_COMMANDS`, `checkExecutable` (never throws), `checkLspForLanguage`, and the three `degradedMessage` strings are byte-for-byte correct (asserted by unit tests and confirmed at runtime).
- **Verified behavior (live)**:
  - `explore <php> --json` → `stdout` is valid JSON, warning only on `stderr`, exit `0` (US1 + US2).
  - `explore <ts>` → no degraded warning (US1 / FR-003 / SC-004).
  - `doctor` and `doctor --json` → all six entries, LSP note footer, stable `{runtime, lsp}` shape, exit `0` (US3).
- **Clean architecture**: detection logic centralized; providers (`php/python/go`) now route PATH detection through the shared module, removing duplicated `which`/`where` blocks (FR-019).
- **Correct stream discipline**: the incidental `console.log('ℹ️ No tsconfig.json found…')` leak under `--json` was correctly suppressed (T014 / FR-005).
- **Good documentation**: file-level `@module` JSDoc, per-export JSDoc with FR references, README + SKILL.md updated.
- **No regressions**: 106 tests pass (baseline 92 + 14 new), `tsc` build succeeds.

## Issues to Fix

### Tests (High) - T008–T010, T013, T015–T016 not implemented

**Problem**: Six CLI/integration test tasks were left unchecked in `tasks.md`, yet the implementer's summary claimed "all 22 tasks completed." Only the `availability.ts` unit test (T004) was added. There is **no automated test** for: the stderr degraded warning (T008), TS-silent behavior (T009), single-warning dedup (T010 / SC-005), `--json` stdout cleanliness (T013 / SC-002), and `doctor` text/JSON output (T015–T016).
**Impact**: The feature's user-facing guarantees (SC-001, SC-002, SC-004, SC-005, SC-006, SC-007) are only manually verified. Any future refactor of the CLI wiring or message strings can silently break them. The spec header explicitly states "Tests: INCLUDED" and the test tasks carry a TDD "write first, must fail before implementation" instruction, so this is in-scope work that was skipped.
**Solution**: Add the CLI tests under `tests/` as specified. Because the providers detect via `execSync`, either (a) mock `node:child_process` / the availability module, or (b) drive the built CLI as a subprocess against fixtures with a scrubbed `PATH` and assert `stdout`/`stderr`/exit code separately. A PHP fixture already exists (`tests/fixtures/php-psr4/`); add small `.py`/`.go`/`.ts` fixtures for full coverage.
**Reference**: `tasks.md` (Tests: INCLUDED; T008–T016), spec `spec.md` Success Criteria SC-002/004/005/006/007.

### Code Quality (Low) - `any` in `src/output/doctor.ts`

**Problem**: `formatToolLine(lines, displayName, tool: any)` (line ~51) introduces an explicit `any`, producing an ESLint warning.
**Impact**: Violates the project's explicit-typing rule (R1 / `2-typescript@5`: "No `any`"). The parameter mixes `ToolAvailability` and `LspLanguageStatus` shapes.
**Solution**: Type it as `ToolAvailability | LspLanguageStatus` (both have `available`, optional `path`, optional `installHint`, and `mode`), removing the `any` and the need to read `tool.mode` untyped.
**Reference**: `.cursor/rules/02-programming-language/2-explicit-typing.mdc`; lint output `src/output/doctor.ts:51`.

### Architecture / DRY (Low) - duplicated + dead detection in `src/cli/doctor.ts`

**Problem**: `checkTool()` in `doctor.ts` re-implements `checkExecutable()` from `availability.ts`. Moreover it is only reachable from the `catch` of a `try` that merely calls `fileURLToPath`/`path.resolve` (which do not throw in practice), so it is effectively dead code.
**Impact**: Directly undercuts FR-019 ("detection logic … centralized in one shared component … no duplicated detection logic") — the very requirement this feature introduces. Adds unused surface.
**Solution**: Remove `checkTool` and, if a PATH fallback for `spaghetti-compass` is desired, call the shared `checkExecutable('spaghetti-compass')`.
**Reference**: spec FR-019.

### Behavior (Low) - Go custom-path detection no longer honored

**Problem**: `GoLspProvider.isAvailable()` now always probes the literal `gopls` via `checkLspForLanguage('go')`, ignoring a custom `config.paths.gopls` that `ensureProcess()` still uses for the actual process.
**Impact**: A user who configures a non-PATH `gopls` binary would be reported/treated as degraded even though the process could start. Edge case, low impact; FR-018 defines detection as PATH-based on `gopls`, so this is arguably acceptable — but the internal inconsistency (detect `gopls`, run `this.goplsPath`) is worth a short code comment or reconciliation.
**Reference**: spec FR-018; `src/core/lsp/go.ts`.

### Cosmetic (Low) - `doctor` text column misalignment

**Problem**: The TypeScript row is a hardcoded string (`OK   TypeScript            bundled`) whose padding differs from the `padEnd(20)` used by `formatToolLine`, so the second column is misaligned versus the other rows.
**Impact**: Purely visual; no functional effect.
**Solution**: Render the TypeScript row through the same aligned helper (treat it as an available tool with location `bundled`).
**Reference**: `contracts/doctor.contract.md` (aligned table); `src/output/doctor.ts`.

## Stats Audit Results

### Stats Accuracy

| Check | Status | Notes |
| --- | --- | --- |
| stats.md exists | ❌→✅ | Was missing; created during this review, back-filled from git + task notes. |
| Session count accurate | ✅ | 2 sessions recorded (implement, review). |
| Timestamps plausible | ✅ | Same-day, ordered. |
| Model names accurate | ✅ | Implementer (implementer subagent), review (Claude Opus 4.8). |
| File counts accurate | ✅ | Matches `git diff --stat`: 10 modified + 4 new source files. |
| Task counts match | ⚠️ | 16/22 tasks done; 6 test tasks (T008–T010, T013, T015–T016) remain `[ ]` in tasks.md (consistent, not a stats error). |
| Aggregation totals correct | ✅ | Summary recomputed. |
| Git history alignment | ✅ | Changes uncommitted in working tree, consistent with review timing. |

### Corrections Applied

- Created `stats.md` (did not previously exist) and logged both the implementation and this review session.

## Final Checklist

- [x] Code conforms to specs (core behavior verified live against contracts)
- [ ] Tests present and passing (unit test present; **6 required CLI/integration test tasks missing**)
- [x] Security OK (no secrets; detection uses fixed `which`/`where` commands; no untrusted input in shell strings beyond fixed command names)
- [ ] Lint/types OK (build OK; 1 new `any` warning to remove, 1 pre-existing warning)
- [x] Documentation up to date (README + SKILL.md)
- [x] stats.md accurate and complete (created during review)
- [x] Review session logged in stats.md

## Verdict

**Approved with minor reservations.**

The shippable core (US1 + US2 + US3) is correct and verified against the contracts. However, to fully satisfy the spec's "Tests: INCLUDED" mandate and protect SC-002/004/005/006/007 from regression, the missing CLI test tasks (T008–T010, T013, T015–T016) should be completed, and the small `any` / DRY / cosmetic items addressed. Recommended next step:

```
/implement 9 review.md
```
