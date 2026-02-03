# CLI Interface Contract: Multi-LSP Support

## New CLI Options

### `--lsp <type>`

Force l'utilisation d'un LSP spécifique.

```bash
spaghetti-compass explore src/file.php --lsp intelephense
spaghetti-compass explore src/file.py --lsp pyright
spaghetti-compass explore src/file.ts --lsp typescript
```

**Values**: `typescript`, `intelephense`, `pyright`, `none`

**Default**: Auto-detect based on file extension

### `--no-lsp`

Désactive complètement la résolution LSP.

```bash
spaghetti-compass explore src/file.php --no-lsp
```

**Equivalent to**: `--lsp none`

### `--lsp-timeout <ms>`

Timeout pour les requêtes LSP en millisecondes.

```bash
spaghetti-compass explore src/file.php --lsp-timeout 10000
```

**Default**: `5000` (5 secondes)

### `--lsp-debug`

Active les logs de debug pour le LSP.

```bash
spaghetti-compass explore src/file.php --lsp-debug
```

**Output**: Logs vers stderr avec préfixe `[LSP]`

## Updated Help Output

```
Usage: spaghetti-compass explore <entry> [options]

Explore code dependencies starting from an entry point

Arguments:
  entry                      Entry point file (e.g., src/main.ts)

Options:
  -c, --context <path>       Context directory for analysis
  -j, --json                 Output as JSON
  --no-transitive            Don't follow transitive dependencies
  -e, --exclude <glob...>    Glob patterns to exclude
  -t, --tsconfig <path>      Path to tsconfig.json
  -r, --root <path>          Project root directory
  --no-tsconfig              Disable TypeScript alias resolution
  --hyperlinks               Enable OSC 8 hyperlinks
  --absolute-paths           Use absolute paths
  --no-links                 Disable path:line:column format
  --lsp <type>               Force LSP type (typescript|intelephense|pyright|none)
  --no-lsp                   Disable LSP resolution
  --lsp-timeout <ms>         LSP request timeout (default: 5000)
  --lsp-debug                Enable LSP debug logging
  -h, --help                 Display help
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | File not found |
| 3 | LSP not available (warning only, continues) |

## Warning Messages

### LSP Not Installed

```
⚠️  Warning: Intelephense not found. Install with: npm install -g intelephense
    PHP definitions will not be resolved. Using fallback.
```

```
⚠️  Warning: Pyright not found. Install with: npm install -g pyright
    Python definitions will not be resolved. Using fallback.
```

### LSP Timeout

```
⚠️  Warning: LSP request timed out after 5000ms for: src/utils.php
    Using fallback for this file.
```

## Debug Output Format

Avec `--lsp-debug`:

```
[LSP] Starting intelephense for /home/user/project
[LSP] → initialize (id=1)
[LSP] ← initialize result (500ms)
[LSP] → textDocument/didOpen: file:///home/user/project/src/main.php
[LSP] → textDocument/definition (id=2) at line 10, col 15
[LSP] ← definition result: file:///home/user/project/src/utils.php:25:5 (150ms)
[LSP] Shutting down intelephense
```
