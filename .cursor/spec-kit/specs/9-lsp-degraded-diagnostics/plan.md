# Implementation Plan: Signal Degraded LSP Mode and Diagnose PATH

**Branch**: `9-lsp-degraded-diagnostics` | **Date**: 2026-07-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `.cursor/spec-kit/specs/9-lsp-degraded-diagnostics/spec.md`

## Summary

Make the intentional parser-only fallback **visible** without polluting machine-readable output, and add a `doctor` command for PATH diagnosis. Approach: introduce a single shared availability module (`src/core/lsp/availability.ts`) that owns the language→command map, detection, install hints, and the exact warning wording. The `LspProviderFactory` records an `LspProviderStatus` for each provider it resolves; the `Analyzer` exposes those statuses; the **CLI layer** prints degraded warnings to `stderr` once per unavailable provider and keeps `stdout` JSON strictly clean. A new `doctor` subcommand (text + `--json`) reuses the same module.

## Technical Context

**Language/Version**: TypeScript 5.9 (ESM, `"type": "module"`), Node.js ≥ 20
**Primary Dependencies**: `commander` ^12 (CLI), `typescript` ^5.9 (bundled TS Language Service); Node `child_process` for detection
**Storage**: N/A (in-memory value objects only)
**Testing**: `vitest` (existing suite; `test` / `test:run` scripts)
**Target Platform**: Node CLI (macOS/Linux/Windows — `which`/`where` split already present in providers)
**Project Type**: single (CLI tool)
**Performance Goals**: no measurable regression on analysis; detection is a couple of `which` probes, cached per invocation
**Constraints**: warnings on `stderr` only; `--json` `stdout` strictly parseable; exit codes unchanged; one warning per provider per invocation; no duplicated detection logic
**Scale/Scope**: ~1 new module + 1 new CLI command + wiring in factory/analyzer/CLI; ~6 new test files

## Constitution Check

*GATE: verified before Phase 0 and re-verified after Phase 1 design.*

| Principle | Status | Note |
|-----------|--------|------|
| LSP-First | ✅ PASS | Reinforces LSP usage by making fallback visible and guiding install; does not reimplement semantic analysis. |
| Architecture Modulaire | ✅ PASS | New logic isolated in `src/core/lsp/availability.ts`; Core Graph Engine untouched. |
| Contrat des Language Adapters | ✅ PASS | Providers keep their interface; detection is refactored to call the shared module (no contract change). |
| Modèle de Données du Graphe | ✅ PASS | Graph JSON schema unchanged (FR-020). |
| Résolution Best-Effort / no silent assumptions | ✅ PASS | Directly furthers this principle: degraded resolution is now surfaced, not silent. |
| Extensibilité | ✅ PASS | Language→command map is data-driven; adding a language means one map entry. |
| Comportements Interdits | ✅ PASS | No hidden fallback anymore; no framework logic outside adapters. |

**Result**: PASS, no violations. Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
.cursor/spec-kit/specs/9-lsp-degraded-diagnostics/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── availability.contract.md
│   └── doctor.contract.md
├── checklists/
│   └── requirements.md
└── tasks.md            # created by /speckit.tasks
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── analyzer.ts                 # MODIFY: expose resolved LspProviderStatus[]
│   └── lsp/
│       ├── availability.ts         # NEW: shared detection + map + messages + hints
│       ├── availability.test.ts    # NEW: unit tests (mock child_process)
│       ├── factory.ts              # MODIFY: record LspProviderStatus per resolved provider
│       ├── php.ts                  # MODIFY: use shared checker (remove duplicated logic)
│       ├── python.ts               # MODIFY: use shared checker; keep npx tolerance
│       ├── go.ts                   # MODIFY: use shared checker
│       └── types.ts                # MODIFY (optional): re-export LspProviderStatus type
├── cli/
│   ├── index.ts                    # MODIFY: emit degraded warnings (stderr); add `doctor` command
│   └── doctor.ts                   # NEW: build DoctorReport (reuses availability.ts)
└── output/
    └── doctor.ts                   # NEW: formatDoctorText / formatDoctorJson

tests/
├── unit/ or alongside src (repo mixes both; follow existing convention)
└── cli/                            # NEW: doctor text, doctor --json, explore --json degraded, TS no-warning, single-warning
```

**Structure Decision**: Single-project CLI. Follow the repo's existing convention of colocating `*.test.ts` next to source (see `src/core/lsp/php-constructor.test.ts`) for unit tests, and use `tests/` for CLI/integration tests (a `tests/` dir already exists). Confirm exact test placement against current suite layout during Setup.

## Key implementation notes

1. **Shared module** owns: `LSP_COMMANDS` map, `checkExecutable`, `checkLspForLanguage`, `degradedMessage`, and the `LspProviderStatus`/`ExecutableAvailability` types. See [contracts/availability.contract.md](./contracts/availability.contract.md).
2. **Factory** (`getProvider`): when a provider is unavailable and falls back to `NullLspProvider`, record an `LspProviderStatus { degraded: true, message }`; when available or TypeScript, record `degraded: false`. Expose via `getStatuses(): LspProviderStatus[]`. The existing `providers` `Map` (keyed `projectRoot:providerType`) already dedups resolution → dedups status.
3. **Analyzer**: add `getLspStatuses()` delegating to the factory, so the CLI can read them after `analyze()`.
4. **CLI `explore`/`impact`**: after analysis, iterate statuses; for each `degraded` status not already printed, `console.error(status.message)`. Never touches `stdout`. Exit code logic unchanged.
5. **`doctor` command**: build `DoctorReport` via `src/cli/doctor.ts`; render with `src/output/doctor.ts` (text or JSON per `--json`); exit `0` unless node/spaghetti-compass unavailable or an unexpected error occurs.
6. **Python distinction (FR-017)**: `doctor` reports the direct `pyright-langserver` binary; the provider keeps its `npx` tolerance for actual resolution.

## Stop & Report

Phase 1 planning complete. Artifacts generated: `research.md`, `data-model.md`, `contracts/*`, `quickstart.md`, this `plan.md`. Next: `/speckit.tasks`.
