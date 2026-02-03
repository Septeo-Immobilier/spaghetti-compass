# Research: Multi-LSP Support

## LSP Protocol Overview

Le **Language Server Protocol (LSP)** est un protocole standardisé par Microsoft pour la communication entre un éditeur (client) et un serveur de langage.

### Communication

- **Transport**: stdin/stdout (typique pour CLI) ou TCP/WebSocket
- **Format**: JSON-RPC 2.0
- **Pattern**: Request/Response + Notifications

### Lifecycle

```
Client                          Server
   |                               |
   |--- initialize -------------->|
   |<-- initialize result --------|
   |--- initialized ------------->|
   |                               |
   |--- textDocument/didOpen ---->|  (notification)
   |--- textDocument/definition ->|  (request)
   |<-- definition result --------|
   |                               |
   |--- shutdown ---------------->|
   |<-- shutdown result ----------|
   |--- exit -------------------->|
```

## Intelephense (PHP)

### Overview

- **Auteur**: Ben Mewburn
- **Licence**: Proprietary (free tier + premium)
- **GitHub**: https://github.com/bmewburn/intelephense
- **NPM**: `intelephense`

### Installation

```bash
npm install -g intelephense
# ou
npx intelephense --version
```

### Usage CLI

```bash
intelephense --stdio
```

### Capabilities

- Go to Definition ✅
- Find References ✅
- Hover ✅
- Completion ✅
- Diagnostics ✅
- Workspace Symbols ✅

### Configuration

Le serveur lit automatiquement `composer.json` pour l'autoloading PSR-4.

### Exemple Initialize

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "processId": 12345,
    "rootUri": "file:///path/to/project",
    "capabilities": {
      "textDocument": {
        "definition": { "dynamicRegistration": false }
      }
    }
  }
}
```

## Pyright (Python)

### Overview

- **Auteur**: Microsoft
- **Licence**: MIT
- **GitHub**: https://github.com/microsoft/pyright
- **NPM**: `pyright`

### Installation

```bash
npm install -g pyright
# ou
npx pyright --version
```

### Usage CLI

```bash
pyright-langserver --stdio
```

Note: Le binaire LSP est `pyright-langserver`, pas `pyright` (qui est le CLI de diagnostic).

### Capabilities

- Go to Definition ✅
- Find References ✅
- Hover ✅
- Completion ✅
- Diagnostics ✅
- Type Inference ✅

### Configuration

Le serveur lit automatiquement :
- `pyproject.toml` (section `[tool.pyright]`)
- `pyrightconfig.json`

### Exemple Definition Request

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "textDocument/definition",
  "params": {
    "textDocument": { "uri": "file:///path/to/file.py" },
    "position": { "line": 10, "character": 15 }
  }
}
```

### Exemple Response

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "uri": "file:///path/to/module.py",
    "range": {
      "start": { "line": 5, "character": 4 },
      "end": { "line": 5, "character": 20 }
    }
  }
}
```

## Comparaison des LSP

| Aspect | TypeScript | Intelephense | Pyright |
|--------|------------|--------------|---------|
| Communication | API directe | JSON-RPC | JSON-RPC |
| Démarrage | ~100ms | ~500ms | ~300ms |
| Mémoire | ~50MB | ~100MB | ~80MB |
| Config | tsconfig.json | composer.json | pyproject.toml |
| Licence | Apache 2.0 | Proprietary | MIT |

## Alternatives Considérées

### PHP

| LSP | Avantages | Inconvénients |
|-----|-----------|---------------|
| **Intelephense** | Populaire, rapide, bien maintenu | Premium pour certaines features |
| phpactor | Open source | Moins de features |
| php-language-server | Open source | Peu maintenu |

**Choix**: Intelephense - meilleur compromis popularité/qualité

### Python

| LSP | Avantages | Inconvénients |
|-----|-----------|---------------|
| **Pyright** | Microsoft, excellent types | Dépendance Node.js |
| Pylsp (pylsp) | Python natif | Plus lent |
| Jedi | Léger | Moins de features |

**Choix**: Pyright - meilleur support des types et performances

## JSON-RPC Implementation

### Library Options

1. **vscode-jsonrpc** (npm) - Officiel Microsoft, complet
2. **json-rpc-2.0** (npm) - Léger
3. **Custom** - Simple pour notre use case

**Recommandation**: Custom - On n'a besoin que de `request()` et `notify()`, pas de la complexité complète.

### Custom Implementation

```typescript
class JsonRpcClient {
  private nextId = 1;
  private pending = new Map<number, { resolve, reject, timeout }>();
  
  constructor(private process: ChildProcess) {
    process.stdout.on('data', this.handleData.bind(this));
  }
  
  async request<T>(method: string, params?: unknown): Promise<T> {
    const id = this.nextId++;
    const message = JSON.stringify({ jsonrpc: '2.0', id, method, params });
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
      this.pending.set(id, { resolve, reject, timeout });
      this.process.stdin.write(message + '\n');
    });
  }
  
  private handleData(data: Buffer) {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      const response = JSON.parse(line);
      const pending = this.pending.get(response.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pending.delete(response.id);
        if (response.error) pending.reject(response.error);
        else pending.resolve(response.result);
      }
    }
  }
}
```

## Performance Considerations

### Startup Time

Les LSP externes ont un temps de démarrage non négligeable (~300-500ms). Stratégies :

1. **Lazy initialization**: Ne démarrer le LSP qu'au premier fichier du langage
2. **Process caching**: Garder le processus actif entre les requêtes
3. **Parallel startup**: Démarrer les LSP en parallèle si plusieurs langages

### Memory Usage

Chaque LSP consomme de la mémoire (~50-100MB). Stratégies :

1. **Dispose on idle**: Arrêter les LSP inactifs après un certain temps
2. **Single instance**: Un seul processus par langage par projet

## References

- [LSP Specification](https://microsoft.github.io/language-server-protocol/specifications/specification-current/)
- [Intelephense Documentation](https://intelephense.com/)
- [Pyright Documentation](https://github.com/microsoft/pyright/blob/main/docs/getting-started.md)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)
