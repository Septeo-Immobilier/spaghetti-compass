# Research: Signal Degraded LSP Mode and Diagnose PATH

**Feature**: `9-lsp-degraded-diagnostics`
**Date**: 2026-07-05

Phase 0 output. All unknowns from the Technical Context are resolved below. There were no `[NEEDS CLARIFICATION]` markers in the spec; the research focuses on grounding the design in the existing code and choosing conventions.

## Current-state findings (grounded in code)

### How availability is detected today (duplicated)

- `src/core/lsp/php.ts` → `isAvailable()` runs `which intelephense` / `where intelephense` via `execSync` and, on failure, logs `[LSP] Intelephense not found. Install with: npm install -g intelephense`.
- `src/core/lsp/python.ts` → `isAvailable()` tries `npx pyright-langserver --version`, then falls back to `which/where pyright-langserver`; logs an install hint on failure.
- `src/core/lsp/go.ts` → `isAvailable()` runs `<goplsPath> version` via `execSync`, then falls back to `which/where gopls`.
- `src/core/lsp/typescript.ts` → bundled; `isAvailable()` is effectively always true (TS Language Service ships via the `typescript` npm dependency).
- `src/core/lsp/factory.ts` → `getProvider()` calls `provider.isAvailable()` and, when false, swaps to `NullLspProvider`. The only user signal today is a `console.warn` gated behind `this.config.debug`.

**Decision**: Extract detection + messaging + install hints into a single shared module `src/core/lsp/availability.ts`. The three providers and the factory call into it; the new `doctor` command reuses it. This satisfies FR-019 and removes the current triplication.

**Rationale**: Constitution "Architecture Modulaire" and DRY. One source of truth for the language→command map and the message strings.

**Alternatives considered**: Leave detection in each provider and have `doctor` re-implement it — rejected: duplicates logic and drifts message wording.

### Where the warning must be emitted

- `src/core/analyzer.ts` obtains the provider via `this.lspFactory.getProvider(...)` (line ~106) and holds `lspFactory` + `lspProvider`. This is the natural place to know that a degraded fallback occurred.
- `src/cli/index.ts` orchestrates output: JSON goes to `stdout` via `console.log(formatJson(graph))`; errors already go to `stderr` via `console.error`. Exit codes: `EXIT_SUCCESS=0`, `EXIT_FILE_NOT_FOUND=1`, `EXIT_CONTEXT_NOT_FOUND=2`, `EXIT_PARSE_ERROR=3`, `EXIT_FUNCTION_NOT_FOUND=4`.

**Decision**: The factory records a per-instance `LspProviderStatus` for each provider it resolves. The analyzer exposes `getLspStatuses()` (or the factory does). The **CLI** — not the core — decides to print the warning to `stderr`. Core stays free of presentation concerns.

**Rationale**: Keeps `stdout`/`stderr` policy and de-duplication (one warning per provider per invocation) in the CLI layer, where the command lifecycle lives. The `Map` cache in the factory (`projectRoot:providerType`) already guarantees a provider is resolved once per type — a natural dedup key for FR-008.

**Alternatives considered**: Emit the warning directly from the factory/provider via `console.error`. Rejected: couples core to a stream policy, and makes the once-per-invocation guarantee and testability harder.

### Warning wording (from spec examples)

- PHP: `Warning: PHP LSP unavailable: \`intelephense\` was not found in PATH. Continuing with parser fallback; symbol resolution may be less precise.`
- Python: `Warning: Python LSP unavailable: \`pyright-langserver\` was not found in PATH. Continuing with parser fallback; symbol resolution may be less precise.`
- Go: `Warning: Go LSP unavailable: \`gopls\` was not found in PATH. Continuing with parser fallback; symbol positions may be less precise.`

**Decision**: Store these strings in `availability.ts` as the single source, keyed by language.

### `doctor` command

- CLI uses `commander`. New subcommand `doctor` with a `--json` boolean option, mirroring the `explore`/`impact` option style.
- Text renderer produces the `OK`/`MISS` aligned layout from the spec plus the LSP note footer.
- JSON renderer produces the `{ runtime, lsp }` shape from the spec.

**Decision**: Detection for `doctor`:
- `node` → `process.execPath` (always available since we are running under Node) + `which node` for a PATH-resolved path.
- `spaghetti-compass` → resolve via `which spaghetti-compass` (PATH); if absent (e.g. run via `npx`/local `bin`), report available with the running entry path.
- TypeScript → always `available: true`, `mode: "bundled"`.
- php/python/go → the shared availability checker (`which` + optional version probe).

**Rationale**: FR-010..FR-017. `doctor` never fails just because optional LSPs are missing (FR-013); it returns non-zero only on an unexpected internal error (FR-014).

### Python direct-binary distinction (FR-017)

`python.ts` currently accepts `npx pyright-langserver --version` as "available". For runtime resolution we keep that tolerance, but the shared checker MUST expose a separate signal for "direct `pyright-langserver` present in PATH" so `doctor` reports the binary honestly.

**Decision**: `availability.ts` checks the direct binary via `which pyright-langserver`. The provider MAY still use its existing `npx` tolerance for actual resolution, but `doctor` reports the direct-binary result.

## Technology / convention decisions

| Topic | Decision | Rationale |
|-------|----------|-----------|
| Detection primitive | `execSync('which <cmd>' \| 'where <cmd>')` with `stdio: 'pipe'`, wrapped in try/catch, plus optional version probe | Matches existing provider code; no new dependency |
| Path resolution | Capture stdout of `which`/`where`, first line, trimmed | Needed for `doctor` "resolved path" |
| Shared module location | `src/core/lsp/availability.ts` | Suggested by spec; sits with the LSP module |
| Warning stream | `stderr` only, from CLI layer | FR-004/FR-005 |
| Dedup strategy | One `LspProviderStatus` per provider type per factory instance; CLI prints each degraded status once | FR-008 |
| Testing | `vitest` (existing), mock `child_process`/availability checker | Matches repo test stack; FR unit + CLI tests |

## Open questions

None. All resolved.
