# Quickstart: Signal Degraded LSP Mode and Diagnose PATH

**Feature**: `9-lsp-degraded-diagnostics`

## Scenario A — Degraded warning (PHP LSP missing)

```bash
# intelephense not installed
spaghetti-compass explore src/Controller.php
# → analysis prints to stdout
# → stderr shows:
#   Warning: PHP LSP unavailable: `intelephense` was not found in PATH. Continuing with parser fallback; symbol resolution may be less precise.
# → exit code 0
echo $?   # 0
```

## Scenario B — Clean JSON with a missing LSP (Python)

```bash
# pyright-langserver not installed
spaghetti-compass explore src/main.py --json > graph.json
# → graph.json contains ONLY valid JSON
# → warning appears on stderr (not in graph.json)
cat graph.json | python -c "import json,sys; json.load(sys.stdin); print('valid JSON')"
```

## Scenario C — No warning for TypeScript

```bash
spaghetti-compass explore src/index.ts
# → no LSP-unavailable warning on stderr (TypeScript is bundled)
```

## Scenario D — Single warning across many files

```bash
# many .go files traversed, gopls missing
spaghetti-compass explore src/cmd/root.go
# → exactly ONE gopls warning on stderr, regardless of how many .go files are visited
```

## Scenario E — Environment diagnosis

```bash
spaghetti-compass doctor
# → OK/MISS table for spaghetti-compass, node, TypeScript(bundled), intelephense, pyright-langserver, gopls
# → footer LSP note
echo $?   # 0 as long as node + spaghetti-compass are available

spaghetti-compass doctor --json | jq .
# → stable { runtime, lsp } JSON
```

## Acceptance-criteria mapping

| Spec AC | Scenario |
|---------|----------|
| US1 #1–#4 | A, C |
| US2 #1–#3 | B |
| US3 #1–#4 | E |
| Edge: single warning | D |
