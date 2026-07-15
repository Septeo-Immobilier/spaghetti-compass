# Contract: Shared Availability Module

**File**: `src/core/lsp/availability.ts`
**Consumers**: `LspProviderFactory`, PHP/Python/Go providers, `doctor` command.

## Types

```ts
export type LanguageId = 'typescript' | 'php' | 'python' | 'go' | 'unknown';

export interface ExecutableAvailability {
  command: string;
  available: boolean;
  path?: string;
  installHint?: string;
}

export interface LspProviderStatus {
  language: LanguageId;
  providerName: string;
  available: boolean;
  degraded: boolean;
  message?: string;
}
```

## Language → command map

```ts
export const LSP_COMMANDS: Record<'php' | 'python' | 'go', { command: string; installHint: string }> = {
  php:    { command: 'intelephense',       installHint: 'npm install -g intelephense' },
  python: { command: 'pyright-langserver', installHint: 'npm install -g pyright' },
  go:     { command: 'gopls',              installHint: 'go install golang.org/x/tools/gopls@latest' },
};
```

## Functions

### `checkExecutable(command: string): ExecutableAvailability`
- MUST resolve via `which <command>` (POSIX) / `where <command>` (win32) using `execSync` with `stdio: 'pipe'`.
- MUST return `{ command, available: false }` on any error (never throw).
- On success: `{ command, available: true, path: <first line, trimmed> }`.

### `checkLspForLanguage(language: 'php'|'python'|'go'): ExecutableAvailability`
- Uses `LSP_COMMANDS[language]`, attaches `installHint`.
- Python: MUST reflect presence of the **direct** `pyright-langserver` binary in PATH (FR-017).
- MAY additionally run a version probe (e.g. `gopls version`) but availability is primarily PATH-based (FR-018).

### `degradedMessage(language: 'php'|'python'|'go'): string`
Returns the exact spec wording:
- php → `Warning: PHP LSP unavailable: \`intelephense\` was not found in PATH. Continuing with parser fallback; symbol resolution may be less precise.`
- python → `Warning: Python LSP unavailable: \`pyright-langserver\` was not found in PATH. Continuing with parser fallback; symbol resolution may be less precise.`
- go → `Warning: Go LSP unavailable: \`gopls\` was not found in PATH. Continuing with parser fallback; symbol positions may be less precise.`

## Invariants
- No function writes to `stdout` or `stderr` (presentation is the caller's job).
- Pure w.r.t. process state except read-only environment probes.
