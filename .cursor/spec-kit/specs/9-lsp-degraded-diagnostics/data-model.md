# Data Model: Signal Degraded LSP Mode and Diagnose PATH

**Feature**: `9-lsp-degraded-diagnostics`
**Date**: 2026-07-05

This feature is not persistent-data-oriented; the "entities" are in-memory value objects exchanged between the shared availability module, the factory/analyzer, and the CLI renderers.

## Entities

### `LanguageId`

Enumeration of languages the tool reasons about for LSP status.

```
'typescript' | 'php' | 'python' | 'go' | 'unknown'
```

### `ExecutableAvailability`

Result of inspecting one executable in the environment.

| Field | Type | Notes |
|-------|------|-------|
| `command` | `string` | Logical command name, e.g. `intelephense`, `gopls`, `pyright-langserver`, `node`. |
| `available` | `boolean` | True if found (via PATH and/or version probe). |
| `path` | `string \| undefined` | Resolved absolute path when found. |
| `installHint` | `string \| undefined` | Present for optional LSPs when relevant. |

### `LspProviderStatus`

Status of the LSP provider actually selected for a language during a command. Exposed by the factory/analyzer to the CLI.

| Field | Type | Notes |
|-------|------|-------|
| `language` | `LanguageId` | Language of the analyzed file(s). |
| `providerName` | `string` | e.g. `php-intelephense`, `NullLspProvider`. |
| `available` | `boolean` | Whether the optional provider was available. |
| `degraded` | `boolean` | True when an optional provider was expected but fell back. Always `false` for TypeScript. |
| `message` | `string \| undefined` | User-facing degraded-mode warning (stderr text) when `degraded`. |

**Rules**:
- TypeScript/JavaScript: `available: true`, `degraded: false`, no message (FR-003/FR-016).
- A `degraded: true` status MUST carry a non-empty `message` (FR-002).
- The CLI emits each distinct degraded status's `message` at most once per invocation (FR-008).

### `LspLanguageStatus` (doctor JSON, per language)

Shape inside the `doctor --json` `lsp` object.

- TypeScript: `{ available: true, mode: 'bundled' }`
- php/python/go: `{ available: boolean, command: string, path?: string, installHint: string }`

### `DoctorReport`

Aggregate used to render both text and JSON.

| Field | Type | Notes |
|-------|------|-------|
| `runtime.node` | `{ available: boolean, path?: string }` | |
| `runtime.spaghettiCompass` | `{ available: boolean, path?: string }` | |
| `lsp.typescript` | `LspLanguageStatus` | Always available, `mode: 'bundled'`. |
| `lsp.php` | `LspLanguageStatus` | `command: 'intelephense'`. |
| `lsp.python` | `LspLanguageStatus` | `command: 'pyright-langserver'`; distinguishes direct binary (FR-017). |
| `lsp.go` | `LspLanguageStatus` | `command: 'gopls'`. |

**Exit-code rule**: `doctor` returns `0` iff `runtime.node.available && runtime.spaghettiCompass.available`; non-zero only on unexpected internal failure (FR-013/FR-014).

## Language → executable map (single source of truth)

| Language | Command | Install hint |
|----------|---------|--------------|
| php | `intelephense` | `npm install -g intelephense` |
| python | `pyright-langserver` | `npm install -g pyright` |
| go | `gopls` | `go install golang.org/x/tools/gopls@latest` |
| typescript | (bundled) | — |
