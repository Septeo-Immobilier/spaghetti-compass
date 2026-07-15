# Contract: `doctor` CLI Command

**Command**: `spaghetti-compass doctor [--json]`

## Text output (default)

Aligned status table, `OK`/`MISS` prefix, plus footer note. Example:

```text
Spaghetti Compass environment

OK   spaghetti-compass     /usr/local/bin/spaghetti-compass
OK   node                  /usr/local/bin/node
OK   TypeScript            bundled
MISS intelephense          install with: npm install -g intelephense
MISS pyright-langserver    install with: npm install -g pyright
OK   gopls                 /Users/me/go/bin/gopls

LSP note: spaghetti-compass starts its own LSP processes when available; it does not reuse VSCode/Cursor LSP sessions.
```

- All report lines go to `stdout`.
- `OK` when available (second column = resolved path, or `bundled` for TypeScript).
- `MISS` when unavailable (second column = `install with: <hint>`).

## JSON output (`--json`)

`stdout` MUST contain only this JSON (stable top-level shape `{ runtime, lsp }`):

```json
{
  "runtime": {
    "node": { "available": true, "path": "/usr/local/bin/node" },
    "spaghettiCompass": { "available": true, "path": "/usr/local/bin/spaghetti-compass" }
  },
  "lsp": {
    "typescript": { "available": true, "mode": "bundled" },
    "php":    { "available": false, "command": "intelephense",       "installHint": "npm install -g intelephense" },
    "python": { "available": false, "command": "pyright-langserver", "installHint": "npm install -g pyright" },
    "go":     { "available": true,  "command": "gopls", "path": "/Users/me/go/bin/gopls", "installHint": "go install golang.org/x/tools/gopls@latest" }
  }
}
```

- `path` present only when available (except TypeScript, which uses `mode: "bundled"`).

## Exit codes
- `0` when `runtime.node.available && runtime.spaghettiCompass.available` (even if all optional LSPs are missing).
- Non-zero only on an unexpected internal error while producing the report.

---

# Contract: Degraded-mode warning on `explore` / `impact`

- When a traversal resolves an optional-LSP language whose provider is unavailable, the CLI writes the `degradedMessage(language)` string to `stderr`.
- Emitted **at most once per unavailable provider per invocation** (FR-008).
- Never written to `stdout`; `--json` `stdout` remains strictly parseable (FR-004/FR-005).
- Never emitted for TypeScript/JavaScript (FR-003).
- Does not alter the exit code of an otherwise-successful analysis (stays `0`, FR-006). Existing error exit codes unchanged (FR-007).
