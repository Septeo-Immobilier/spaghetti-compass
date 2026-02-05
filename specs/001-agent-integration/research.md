# Research: Agent Integration pour Spaghetti-Compass

**Feature Branch**: `001-agent-integration`
**Created**: 2026-02-04

---

## Question 1: Comment les agents IA utilisent-ils les outils externes ?

### Recherche effectuée

Les agents IA comme Cursor, GitHub Copilot, et Claude ont plusieurs mécanismes pour utiliser des outils :

#### 1. Exécution de commandes terminal
- **Mécanisme** : L'agent génère une commande shell et l'exécute
- **Exemple** : `npx spaghetti-compass explore src/main.ts --json`
- **Avantages** : Universel, fonctionne avec n'importe quel CLI
- **Inconvénients** : Nécessite parsing de la sortie, pas de typage

#### 2. Model Context Protocol (MCP)
- **Mécanisme** : Protocole standardisé pour exposer des outils aux LLMs
- **Exemple** : Serveur MCP avec outil `explore_dependencies`
- **Avantages** : Intégration native, schéma typé, pas de parsing
- **Inconvénients** : Nécessite configuration, plus complexe à implémenter

#### 3. Extensions IDE (VSCode)
- **Mécanisme** : Extension qui expose des commandes
- **Avantages** : UI riche, intégration profonde
- **Inconvénients** : Les agents n'utilisent PAS les extensions directement

### Décision

**Approche hybride** :
1. **CLI via npx** (Phase 1) : Solution immédiate, universelle
2. **Serveur MCP** (Phase 2) : Intégration plus riche pour Cursor/Claude

---

## Question 2: Quel format de sortie JSON est optimal pour les agents ?

### Recherche effectuée

Les agents IA parsent le JSON et l'utilisent pour prendre des décisions. Le format doit être :

1. **Plat et prévisible** : Éviter les structures trop imbriquées
2. **Auto-descriptif** : Inclure des métadonnées (version, timestamp)
3. **Complet** : Toutes les informations nécessaires en une seule requête
4. **Filtrable** : Permettre de cibler des sous-ensembles (via jq)

### Format actuel de spaghetti-compass

```typescript
interface DependencyGraph {
  version: string;           // ✅ Présent
  generatedAt: string;       // ✅ Présent
  context: ContextInfo;      // ✅ Présent
  entryPoint: string;        // ✅ Présent
  nodes: GraphNode[];        // ✅ Présent
  edges: GraphEdge[];        // ✅ Présent
  stats: GraphStats;         // ✅ Présent
}
```

### Décision

Le format actuel est **déjà optimal**. Aucune modification majeure requise.

**Améliorations mineures** :
- S'assurer que `version` est bien le format de sortie (pas la version du package)
- Ajouter des exemples de requêtes jq dans la documentation

---

## Question 3: MCP vs CLI - Quelle priorité ?

### Recherche effectuée

#### Avantages CLI (npx)
- ✅ Fonctionne immédiatement avec tous les agents
- ✅ Pas de configuration requise
- ✅ Testable manuellement
- ✅ Utilisable en CI/CD
- ❌ Nécessite parsing de la sortie
- ❌ Overhead de démarrage Node.js à chaque appel

#### Avantages MCP
- ✅ Intégration native avec Cursor/Claude
- ✅ Schéma typé, pas de parsing
- ✅ Serveur persistant (pas d'overhead de démarrage)
- ❌ Configuration requise (.cursor/mcp.json)
- ❌ Limité aux agents supportant MCP
- ❌ Plus complexe à implémenter et maintenir

### Décision

**CLI d'abord (Phase 1)**, MCP ensuite (Phase 2 optionnelle).

**Justification** :
- Le CLI couvre 100% des cas d'usage
- MCP est un "nice to have" pour une meilleure UX
- L'effort CLI est minimal (le code existe déjà)

---

## Question 4: Comment publier sur npm ?

### Recherche effectuée

#### Prérequis
1. Compte npm (gratuit)
2. `package.json` avec les champs requis
3. Build TypeScript → JavaScript

#### Checklist publication
```bash
# 1. Vérifier le nom
npm view spaghetti-compass

# 2. Se connecter
npm login

# 3. Vérifier le package
npm pack --dry-run

# 4. Publier
npm publish --access public
```

#### Champs package.json requis
```json
{
  "name": "spaghetti-compass",
  "version": "0.1.0",
  "description": "CLI tool to explore code dependencies",
  "main": "dist/cli/index.js",
  "bin": {
    "spaghetti-compass": "./bin/spaghetti-compass.js"
  },
  "files": ["dist", "bin"],
  "repository": {
    "type": "git",
    "url": "https://github.com/user/spaghetti-compass"
  },
  "keywords": ["dependency", "graph", "typescript", "cli"],
  "license": "MIT"
}
```

### Décision

Le `package.json` actuel est presque complet. Ajouter :
- `repository`
- `bugs`
- `homepage`
- `author`

---

## Question 5: Comment implémenter un serveur MCP ?

### Recherche effectuée

Le SDK MCP officiel (`@modelcontextprotocol/sdk`) fournit :

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server({
  name: "spaghetti-compass",
  version: "0.1.0"
}, {
  capabilities: {
    tools: {}
  }
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: "explore_dependencies",
    description: "Explore code dependencies",
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string", description: "Entry file path" },
        function: { type: "string", description: "Optional function name" }
      },
      required: ["file"]
    }
  }]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "explore_dependencies") {
    const { file, function: funcName } = request.params.arguments;
    // Appeler Analyzer.analyze()
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Décision

L'implémentation MCP est straightforward avec le SDK officiel. Reporter à Phase 2.

---

## Références

- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [MCP SDK TypeScript](https://github.com/modelcontextprotocol/typescript-sdk)
- [npm publish documentation](https://docs.npmjs.com/cli/v10/commands/npm-publish)
- [Cursor MCP Configuration](https://docs.cursor.com/context/model-context-protocol)
