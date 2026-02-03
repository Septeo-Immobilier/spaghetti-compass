# Implementation Plan: Multi-LSP Support (PHP & Python)

**Feature Branch**: `4-multi-lsp-support`  
**Created**: 2026-02-03  
**Status**: Draft

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Analyzer                              │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   LspProviderFactory                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ createProvider(filePath) → LspProvider               │    │
│  │   .ts/.tsx/.js → TypeScriptLspProvider               │    │
│  │   .php        → PhpLspProvider                       │    │
│  │   .py         → PythonLspProvider                    │    │
│  │   other       → NullLspProvider                      │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┬───────────────┐
          ▼               ▼               ▼               ▼
┌─────────────────┐ ┌───────────────┐ ┌───────────────┐ ┌─────────────┐
│ TypeScriptLsp   │ │ PhpLsp        │ │ PythonLsp     │ │ NullLsp     │
│ Provider        │ │ Provider      │ │ Provider      │ │ Provider    │
├─────────────────┤ ├───────────────┤ ├───────────────┤ ├─────────────┤
│ API directe     │ │ JSON-RPC      │ │ JSON-RPC      │ │ No-op       │
│ (ts module)     │ │ (intelephense)│ │ (pyright)     │ │ (fallback)  │
└─────────────────┘ └───────┬───────┘ └───────┬───────┘ └─────────────┘
                            │                 │
                            ▼                 ▼
                    ┌─────────────────────────────────────┐
                    │         LspProcessManager           │
                    │  - spawn/kill processes             │
                    │  - JSON-RPC communication           │
                    │  - timeout handling                 │
                    └─────────────────────────────────────┘
```

## File Structure

```
src/
├── core/
│   ├── lsp/
│   │   ├── index.ts              # Re-exports
│   │   ├── types.ts              # LspProvider interface, DefinitionResult
│   │   ├── factory.ts            # LspProviderFactory
│   │   ├── process-manager.ts    # LspProcessManager (JSON-RPC)
│   │   ├── typescript.ts         # TypeScriptLspProvider (refactored from lsp.ts)
│   │   ├── php.ts                # PhpLspProvider (Intelephense)
│   │   ├── python.ts             # PythonLspProvider (Pyright)
│   │   └── null.ts               # NullLspProvider (fallback)
│   ├── lsp.ts                    # À supprimer après refactoring
│   └── analyzer.ts               # Modifier pour utiliser LspProviderFactory
```

## Implementation Phases

### Phase 1: Refactoring Architecture (P0)

**Objectif**: Extraire l'interface et refactorer le code TypeScript existant

1. Créer `src/core/lsp/types.ts` avec l'interface `LspProvider`
2. Créer `src/core/lsp/typescript.ts` en déplaçant le code de `lsp.ts`
3. Créer `src/core/lsp/null.ts` pour le fallback
4. Créer `src/core/lsp/factory.ts` pour la création des providers
5. Modifier `analyzer.ts` pour utiliser la factory
6. Supprimer l'ancien `lsp.ts`
7. Vérifier que tout fonctionne comme avant

### Phase 2: Infrastructure JSON-RPC (P0)

**Objectif**: Créer l'infrastructure pour communiquer avec les LSP externes

1. Créer `src/core/lsp/process-manager.ts`
   - Spawn de processus
   - Communication JSON-RPC via stdin/stdout
   - Gestion des timeouts
   - Pool de processus

2. Implémenter le protocole LSP de base :
   - `initialize` request
   - `textDocument/didOpen` notification
   - `textDocument/definition` request
   - `shutdown` request

### Phase 3: PHP Support (P1)

**Objectif**: Intégrer Intelephense

1. Créer `src/core/lsp/php.ts`
2. Implémenter `PhpLspProvider` :
   - Vérifier si `intelephense` est installé (`npx intelephense --version`)
   - Lancer le processus avec `npx intelephense --stdio`
   - Mapper les requêtes vers le protocole LSP

3. Tester avec les fixtures PHP existantes

### Phase 4: Python Support (P1)

**Objectif**: Intégrer Pyright

1. Créer `src/core/lsp/python.ts`
2. Implémenter `PythonLspProvider` :
   - Vérifier si `pyright` est installé (`npx pyright --version`)
   - Lancer le processus avec `npx pyright-langserver --stdio`
   - Mapper les requêtes vers le protocole LSP

3. Tester avec les fixtures Python existantes

### Phase 5: Polish & Documentation (P2)

1. Ajouter les options CLI pour forcer un LSP spécifique
2. Améliorer les messages d'erreur et warnings
3. Documenter l'installation des LSP dans le README
4. Ajouter des tests

## Technical Details

### Interface LspProvider

```typescript
interface LspProvider {
  /** Nom du provider pour les logs */
  readonly name: string;
  
  /** Extensions de fichiers supportées */
  readonly supportedExtensions: string[];
  
  /** Vérifie si le LSP est disponible */
  isAvailable(): Promise<boolean>;
  
  /** Initialise le provider pour un projet */
  initialize(projectRoot: string): Promise<void>;
  
  /** Ajoute un fichier au contexte */
  addFile(filePath: string, content?: string): void;
  
  /** Trouve la définition d'un symbole */
  getDefinition(filePath: string, position: number): Promise<DefinitionResult | null>;
  
  /** Trouve la définition par nom de symbole */
  getDefinitionByName(filePath: string, symbolName: string): Promise<DefinitionResult | null>;
  
  /** Libère les ressources */
  dispose(): Promise<void>;
}
```

### JSON-RPC Message Format

```typescript
// Request
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "textDocument/definition",
  "params": {
    "textDocument": { "uri": "file:///path/to/file.php" },
    "position": { "line": 10, "character": 15 }
  }
}

// Response
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "uri": "file:///path/to/definition.php",
    "range": {
      "start": { "line": 5, "character": 0 },
      "end": { "line": 5, "character": 20 }
    }
  }
}
```

### LSP Commands

| Language | Package | Command |
|----------|---------|---------|
| PHP | `intelephense` | `npx intelephense --stdio` |
| Python | `pyright` | `npx pyright-langserver --stdio` |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| LSP non installé | Pas de navigation | Warning + fallback gracieux |
| LSP lent à démarrer | UX dégradée | Démarrage lazy + cache du processus |
| Incompatibilités de version | Erreurs runtime | Vérifier version minimale au démarrage |
| Fuites mémoire (processus) | Crash | Cleanup automatique + timeout |

## Dependencies

### NPM Packages (optionnels pour l'utilisateur)

```json
{
  "optionalDependencies": {
    "intelephense": "^1.10.0",
    "pyright": "^1.1.350"
  }
}
```

Note: Ces packages sont optionnels. L'utilisateur les installe s'il veut le support PHP/Python.

## Testing Strategy

1. **Unit tests**: Mock des LSP pour tester la logique
2. **Integration tests**: Tests avec vrais LSP sur les fixtures
3. **Regression tests**: Vérifier que TypeScript fonctionne toujours
