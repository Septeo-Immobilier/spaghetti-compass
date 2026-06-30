# Contract: Go CLI and JSON Output

**Feature Branch**: `003-go-language-support`
**Created**: 2026-06-30

## CLI contract

No new top-level command is introduced. Go uses the existing commands.

```bash
spaghetti-compass explore <file.go> [options]
spaghetti-compass explore <file.go>:<Function> [options]
spaghetti-compass explore <file.go>:<Type.Method> [options]
spaghetti-compass impact <file.go> [options]
```

### Supported entry forms

```text
path/to/file.go
path/to/file.go:FunctionName
path/to/file.go:Type.Method
path/to/file.go:Type/Method
path/to/file.go:Type:Method
```

`Type/Method` and `Type:Method` normalize to `Type.Method`.

### Defaults

`explore` and `impact` include `.go` files by default:

```text
**/*.ts, **/*.tsx, **/*.js, **/*.jsx, **/*.py, **/*.pyi, **/*.php, **/*.go
```

Go-heavy cache directories should be excluded by default where scans recurse:

```text
**/vendor/**, **/.gomodcache/**
```

## JSON contract

The existing dependency graph shape remains unchanged.

```json
{
  "version": "1.0.0",
  "generatedAt": "2026-06-30T00:00:00.000Z",
  "context": {
    "rootPath": "/repo/fixtures/go",
    "includePatterns": ["**/*.go"],
    "excludePatterns": ["**/vendor/**", "**/.gomodcache/**"]
  },
  "entryPoint": "/repo/fixtures/go/cmd/service/main.go",
  "nodes": [
    {
      "id": "/repo/fixtures/go/cmd/service/main.go",
      "type": "file",
      "name": "main.go",
      "path": "cmd/service/main.go",
      "location": "internal"
    }
  ],
  "edges": [
    {
      "from": "/repo/fixtures/go/cmd/service/main.go",
      "to": "/repo/fixtures/go/internal/application/usecases/receive_invoice.go",
      "type": "import-static",
      "resolved": true,
      "line": 8,
      "targetLine": 12,
      "targetColumn": 1,
      "importedNames": ["usecases"],
      "resolvedVia": "go-mod"
    }
  ],
  "stats": {
    "totalNodes": 2,
    "totalEdges": 1,
    "internalNodes": 2,
    "externalNodes": 0,
    "thirdPartyNodes": 0,
    "unresolvedEdges": 0,
    "circularDependencies": []
  }
}
```

## Resolution markers

`GraphEdge.resolvedVia` may use:

- `go-mod`: resolved by `go.mod` module path.
- `gopls`: resolved by Go LSP.
- existing values for other languages remain unchanged.

If adding `go-mod` requires a type update, extend the existing union rather than introducing a Go-specific edge type.
