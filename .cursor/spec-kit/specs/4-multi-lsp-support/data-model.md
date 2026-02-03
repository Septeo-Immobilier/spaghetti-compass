# Data Model: Multi-LSP Support

## Core Interfaces

### LspProvider

Interface abstraite pour tous les providers LSP.

```typescript
interface LspProvider {
  /** Nom du provider pour les logs/debug */
  readonly name: string;
  
  /** Extensions de fichiers supportées (ex: ['.php']) */
  readonly supportedExtensions: string[];
  
  /** Vérifie si le LSP est disponible sur le système */
  isAvailable(): Promise<boolean>;
  
  /** Initialise le provider pour un projet donné */
  initialize(projectRoot: string): Promise<void>;
  
  /** Ajoute un fichier au contexte du LSP */
  addFile(filePath: string, content?: string): void;
  
  /** Trouve la définition d'un symbole à une position */
  getDefinition(filePath: string, position: number): Promise<DefinitionResult | null>;
  
  /** Trouve la définition d'un symbole par son nom */
  getDefinitionByName(filePath: string, symbolName: string): Promise<DefinitionResult | null>;
  
  /** Libère les ressources (processus, mémoire) */
  dispose(): Promise<void>;
}
```

### DefinitionResult

Résultat de la recherche de définition (existant, inchangé).

```typescript
interface DefinitionResult {
  /** Chemin absolu du fichier contenant la définition */
  filePath: string;
  /** Numéro de ligne (1-indexed) */
  line: number;
  /** Numéro de colonne (1-indexed) */
  column: number;
  /** Nom du symbole défini (optionnel) */
  name?: string;
}
```

## JSON-RPC Types

### LspRequest

```typescript
interface LspRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: unknown;
}
```

### LspResponse

```typescript
interface LspResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}
```

### LspNotification

```typescript
interface LspNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}
```

## LSP Protocol Types

### Position

```typescript
interface Position {
  line: number;      // 0-indexed
  character: number; // 0-indexed
}
```

### Range

```typescript
interface Range {
  start: Position;
  end: Position;
}
```

### Location

```typescript
interface Location {
  uri: string;  // file:// URI
  range: Range;
}
```

### TextDocumentIdentifier

```typescript
interface TextDocumentIdentifier {
  uri: string;
}
```

### TextDocumentPositionParams

```typescript
interface TextDocumentPositionParams {
  textDocument: TextDocumentIdentifier;
  position: Position;
}
```

## Provider Implementations

### TypeScriptLspProvider

- **Source**: TypeScript Compiler API (direct, pas de processus externe)
- **Extensions**: `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`
- **Config**: `tsconfig.json`

### PhpLspProvider

- **Source**: Intelephense via JSON-RPC
- **Command**: `npx intelephense --stdio`
- **Extensions**: `.php`
- **Config**: `composer.json` (optionnel)

### PythonLspProvider

- **Source**: Pyright via JSON-RPC
- **Command**: `npx pyright-langserver --stdio`
- **Extensions**: `.py`, `.pyi`
- **Config**: `pyproject.toml`, `pyrightconfig.json` (optionnels)

### NullLspProvider

- **Source**: No-op (fallback)
- **Extensions**: Toutes les autres
- **Comportement**: Retourne toujours `null` pour `getDefinition()`

## Factory

### LspProviderFactory

```typescript
class LspProviderFactory {
  /** Cache des providers par projet */
  private providers: Map<string, LspProvider>;
  
  /** Crée ou récupère un provider pour un fichier */
  getProvider(filePath: string, projectRoot: string): Promise<LspProvider>;
  
  /** Libère tous les providers */
  disposeAll(): Promise<void>;
}
```

## Process Management

### LspProcessManager

```typescript
class LspProcessManager {
  /** Processus actifs par projet */
  private processes: Map<string, ChildProcess>;
  
  /** Démarre un processus LSP */
  spawn(command: string, args: string[], projectRoot: string): ChildProcess;
  
  /** Envoie une requête JSON-RPC et attend la réponse */
  request<T>(process: ChildProcess, method: string, params?: unknown): Promise<T>;
  
  /** Envoie une notification JSON-RPC (pas de réponse) */
  notify(process: ChildProcess, method: string, params?: unknown): void;
  
  /** Arrête un processus */
  kill(projectRoot: string): void;
  
  /** Arrête tous les processus */
  killAll(): void;
}
```

## Configuration

### LspConfig

```typescript
interface LspConfig {
  /** Timeout pour les requêtes LSP (ms) */
  timeout: number;  // default: 5000
  
  /** Activer les logs debug */
  debug: boolean;
  
  /** Chemins personnalisés vers les LSP */
  paths?: {
    intelephense?: string;
    pyright?: string;
  };
}
```

## Extension Mapping

| Extension | Provider | LSP Command |
|-----------|----------|-------------|
| `.ts`, `.tsx`, `.js`, `.jsx` | TypeScriptLspProvider | (API directe) |
| `.php` | PhpLspProvider | `intelephense --stdio` |
| `.py`, `.pyi` | PythonLspProvider | `pyright-langserver --stdio` |
| autres | NullLspProvider | (none) |
