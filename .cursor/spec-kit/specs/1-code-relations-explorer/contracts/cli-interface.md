# CLI Interface Contract - Code Relations Explorer

**Version**: 1.0.0  
**Date**: 2026-02-02

## Command: `spaghetti-compass`

### Synopsis

```bash
spaghetti-compass explore <entry> --context <dir> [options]
```

### Description

Explore et affiche le graphe de dépendances à partir d'un point d'entrée (fichier ou fonction).

### Arguments

| Argument | Requis | Description |
|----------|--------|-------------|
| `<entry>` | ✅ | Point d'entrée de l'exploration. Format: `path/to/file.ts` ou `path/to/file.ts:functionName` |

### Options

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--context <dir>` | `-c` | string | `.` | Dossier définissant le périmètre interne/externe |
| `--json` | `-j` | boolean | `false` | Sortie au format JSON structuré |
| `--include <glob>` | `-i` | string[] | `["**/*.ts", "**/*.js"]` | Patterns de fichiers à inclure |
| `--exclude <glob>` | `-e` | string[] | `["**/node_modules/**"]` | Patterns de fichiers à exclure |
| `--no-transitive` | | boolean | `false` | Afficher uniquement les relations directes |
| `--help` | `-h` | | | Afficher l'aide |
| `--version` | `-v` | | | Afficher la version |

### Exit Codes

| Code | Signification |
|------|---------------|
| `0` | Succès |
| `1` | Erreur : fichier d'entrée non trouvé |
| `2` | Erreur : contexte non trouvé ou invalide |
| `3` | Erreur : parsing échoué (syntaxe invalide) |
| `4` | Erreur : fonction spécifiée non trouvée |

### Exemples

```bash
# Explorer un fichier avec contexte src/
spaghetti-compass explore src/main.ts --context src/

# Explorer une fonction spécifique
spaghetti-compass explore src/services/auth.ts:login --context src/

# Sortie JSON
spaghetti-compass explore src/main.ts -c src/ --json

# Exclure les tests
spaghetti-compass explore src/main.ts -c src/ -e "**/*.test.ts" -e "**/*.spec.ts"

# Relations directes uniquement
spaghetti-compass explore src/main.ts -c src/ --no-transitive
```

---

## Output Format: Text (default)

### Structure

```
═══════════════════════════════════════════════════════════════
 📍 Entry Point: src/main.ts
 📁 Context: src/
 📊 Stats: 12 internal, 3 external, 5 third-party, 2 unresolved
═══════════════════════════════════════════════════════════════

src/main.ts
├── 📥 IMPORTS (internal)
│   ├── ./services/user-service.ts
│   │   ├── ./models/user.ts
│   │   └── ./utils/validation.ts
│   └── ./utils/helpers.ts
│
├── 📥 IMPORTS (external)
│   └── ../shared/constants.ts
│
├── 📦 IMPORTS (third-party)
│   ├── lodash
│   └── express
│
├── 📤 EXPORTS
│   ├── function main()
│   └── const VERSION
│
└── ⚠️  DYNAMIC IMPORTS (unresolved)
    └── ./plugins/* (line 42)

───────────────────────────────────────────────────────────────
 🔄 Circular Dependencies Detected:
    src/services/auth.ts ↔ src/services/user.ts
───────────────────────────────────────────────────────────────
```

### Symboles

| Symbole | Signification |
|---------|---------------|
| 📍 | Point d'entrée |
| 📁 | Contexte |
| 📥 | Import |
| 📤 | Export |
| 📦 | Package tiers |
| ⚠️ | Non résolu |
| 🔄 | Dépendance circulaire |

---

## Output Format: JSON (`--json`)

### Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["version", "generatedAt", "context", "entryPoint", "nodes", "edges", "stats"],
  "properties": {
    "version": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" },
    "generatedAt": { "type": "string", "format": "date-time" },
    "context": {
      "type": "object",
      "properties": {
        "rootPath": { "type": "string" },
        "includePatterns": { "type": "array", "items": { "type": "string" } },
        "excludePatterns": { "type": "array", "items": { "type": "string" } }
      }
    },
    "entryPoint": { "type": "string" },
    "nodes": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "type", "name", "location"],
        "properties": {
          "id": { "type": "string" },
          "type": { "enum": ["file", "function", "class", "external-module"] },
          "name": { "type": "string" },
          "path": { "type": "string" },
          "location": { "enum": ["internal", "external", "third-party"] }
        }
      }
    },
    "edges": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["from", "to", "type", "resolved"],
        "properties": {
          "from": { "type": "string" },
          "to": { "type": "string" },
          "type": { "enum": ["import-static", "import-dynamic", "require", "export", "re-export", "call"] },
          "resolved": { "type": "boolean" },
          "line": { "type": "integer" },
          "importedNames": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "stats": {
      "type": "object",
      "properties": {
        "totalNodes": { "type": "integer" },
        "totalEdges": { "type": "integer" },
        "internalNodes": { "type": "integer" },
        "externalNodes": { "type": "integer" },
        "thirdPartyNodes": { "type": "integer" },
        "unresolvedEdges": { "type": "integer" },
        "circularDependencies": { 
          "type": "array", 
          "items": { 
            "type": "array", 
            "items": { "type": "string" } 
          } 
        }
      }
    }
  }
}
```

### Exemple

```json
{
  "version": "1.0.0",
  "generatedAt": "2026-02-02T14:30:00Z",
  "context": {
    "rootPath": "/project/src",
    "includePatterns": ["**/*.ts"],
    "excludePatterns": ["**/node_modules/**"]
  },
  "entryPoint": "/project/src/main.ts",
  "nodes": [
    { "id": "/project/src/main.ts", "type": "file", "name": "main.ts", "path": "main.ts", "location": "internal" },
    { "id": "/project/src/services/user.ts", "type": "file", "name": "user.ts", "path": "services/user.ts", "location": "internal" },
    { "id": "lodash", "type": "external-module", "name": "lodash", "location": "third-party" }
  ],
  "edges": [
    { "from": "/project/src/main.ts", "to": "/project/src/services/user.ts", "type": "import-static", "resolved": true, "line": 1 },
    { "from": "/project/src/main.ts", "to": "lodash", "type": "import-static", "resolved": true, "line": 2 },
    { "from": "/project/src/main.ts", "to": "./plugins/*", "type": "import-dynamic", "resolved": false, "line": 42 }
  ],
  "stats": {
    "totalNodes": 3,
    "totalEdges": 3,
    "internalNodes": 2,
    "externalNodes": 0,
    "thirdPartyNodes": 1,
    "unresolvedEdges": 1,
    "circularDependencies": []
  }
}
```
