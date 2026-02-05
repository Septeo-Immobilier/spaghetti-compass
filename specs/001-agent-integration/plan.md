# Implementation Plan: Agent Integration pour Spaghetti-Compass

**Feature Branch**: `001-agent-integration`
**Created**: 2026-02-04

---

## Architecture Decision

### Approche Retenue : Publication npm + MCP Server (optionnel)

L'objectif est de rendre spaghetti-compass utilisable par les agents IA. Après analyse :

1. **Les agents Cursor/Claude utilisent principalement le terminal** pour exécuter des commandes
2. **`npx` est le moyen le plus simple** pour qu'un agent utilise un outil sans installation préalable
3. **Un serveur MCP** permettrait une intégration plus riche mais n'est pas indispensable

### Diagramme d'Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Agent IA (Cursor)                        │
└─────────────────────────────────────────────────────────────────┘
                    │                           │
                    │ Terminal                  │ MCP Protocol
                    ▼                           ▼
┌─────────────────────────────┐   ┌─────────────────────────────┐
│   npx spaghetti-compass     │   │  spaghetti-compass-mcp      │
│   explore <file> --json     │   │  (Phase 2 - optionnel)      │
└─────────────────────────────┘   └─────────────────────────────┘
                    │                           │
                    └───────────┬───────────────┘
                                ▼
                    ┌─────────────────────────────┐
                    │     Core Library            │
                    │  src/core/analyzer.ts       │
                    │  src/parser/*               │
                    └─────────────────────────────┘
                                │
                                ▼
                    ┌─────────────────────────────┐
                    │     JSON Output             │
                    │  DependencyGraph            │
                    └─────────────────────────────┘
```

---

## Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Runtime | Node.js >= 20 | Déjà utilisé, support ESM natif |
| Package Manager | npm | Standard, publication facile |
| CLI Framework | Commander.js | Déjà utilisé dans le projet |
| MCP Server | @modelcontextprotocol/sdk | SDK officiel pour MCP |
| Build | TypeScript + tsc | Déjà configuré |
| Tests | Vitest | Déjà configuré |
| CI/CD | GitHub Actions | Standard, intégration native GitHub |

---

## Implementation Strategy

### Phase 1: Publication npm (P0) - ~2h

#### 1.1 Préparation du package.json

Le `package.json` actuel est déjà bien configuré :
- ✅ `name`: "spaghetti-compass"
- ✅ `bin`: défini pour le CLI
- ✅ `files`: ["dist", "bin"]
- ✅ `engines`: Node >= 20

**Actions requises** :
- Ajouter `repository`, `bugs`, `homepage` pour npm
- Vérifier que `prepublishOnly` build correctement
- Ajouter des keywords pertinents pour la découvrabilité

#### 1.2 Amélioration de la sortie JSON

La sortie JSON actuelle (`src/output/json.ts`) est déjà fonctionnelle.

**Actions requises** :
- Vérifier que tous les champs de `DependencyGraph` sont présents
- Ajouter un champ `version` au format de sortie (pour compatibilité future)
- S'assurer que les chemins sont cohérents (relatifs par défaut)

#### 1.3 Documentation pour Agents

**Actions requises** :
- Ajouter une section "Usage by AI Agents" dans le README
- Documenter le format JSON de sortie
- Fournir des exemples de commandes pour Cursor

#### 1.4 Tests et Publication

**Actions requises** :
- Exécuter les tests existants
- Tester manuellement avec `npm pack` puis `npx`
- Publier sur npm avec `npm publish`

---

### Phase 1.5: CI/CD GitHub Actions (P0) - ~1h

#### 1.5.1 Workflow Publication npm (manuel avec dry-run)

Déclenché manuellement via `workflow_dispatch` avec mode dry-run par défaut :

```yaml
# .github/workflows/publish-npm.yml
name: Publish to npm

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to publish (patch, minor, major, or semver)'
        required: false
        type: string
      dry_run:
        description: 'Dry run (test without publishing)'
        required: false
        type: boolean
        default: true  # Dry-run par défaut pour éviter les erreurs

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      
      - run: npm ci
      - run: npm run build
      - run: npm run test:run
      
      - name: Update version (if specified)
        if: ${{ inputs.version != '' }}
        run: npm version ${{ inputs.version }} --no-git-tag-version
      
      - name: Test package locally
        run: |
          npm pack
          mkdir -p /tmp/test-install
          cp *.tgz /tmp/test-install/
          cd /tmp/test-install
          npm init -y
          npm install ./*.tgz
          npx spaghetti-compass --version
      
      - name: Publish to npm (dry run)
        if: ${{ inputs.dry_run }}
        run: npm publish --dry-run --access public
      
      - name: Publish to npm
        if: ${{ !inputs.dry_run }}
        run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

#### 1.5.2 Secret GitHub requis

| Secret | Description |
|--------|-------------|
| `NPM_TOKEN` | Token npm pour publication (généré via `npm token create --type=automation`) |

---

### Phase 2: Serveur MCP (P2) - ~4h (optionnel)

#### 2.1 Structure du serveur MCP

```
src/
├── mcp/
│   ├── server.ts          # Point d'entrée du serveur MCP
│   ├── tools/
│   │   └── explore.ts     # Outil explore_dependencies
│   └── index.ts           # Export du serveur
```

#### 2.2 Définition de l'outil MCP

```typescript
// src/mcp/tools/explore.ts
export const exploreTool = {
  name: "explore_dependencies",
  description: "Explore code dependencies from an entry point",
  inputSchema: {
    type: "object",
    properties: {
      file: {
        type: "string",
        description: "Path to the entry file"
      },
      function: {
        type: "string",
        description: "Optional function name to explore"
      },
      context: {
        type: "string",
        description: "Context directory for classification"
      }
    },
    required: ["file"]
  }
};
```

#### 2.3 Configuration Cursor

```json
// .cursor/mcp.json
{
  "mcpServers": {
    "spaghetti-compass": {
      "command": "npx",
      "args": ["spaghetti-compass-mcp"]
    }
  }
}
```

---

## File Structure

### Phase 1 (Modifications)

```
spaghetti-compass/
├── package.json              # ✏️ Ajouter metadata npm
├── README.md                 # ✏️ Ajouter section agents
├── .github/
│   └── workflows/
│       └── publish-npm.yml       # 🆕 Publication manuelle npm (avec dry-run)
├── src/
│   └── output/
│       └── json.ts           # ✏️ Vérifier format complet
└── specs/
    └── 001-agent-integration/
        ├── prompt.md         # ✅ Créé
        ├── spec.md           # ✅ Créé
        ├── plan.md           # ✅ Ce fichier
        └── tasks.md          # ✅ Créé
```

### Phase 2 (Ajouts)

```
spaghetti-compass/
├── package.json              # ✏️ Ajouter bin pour mcp
├── src/
│   └── mcp/
│       ├── server.ts         # 🆕 Serveur MCP
│       ├── tools/
│       │   └── explore.ts    # 🆕 Outil explore
│       └── index.ts          # 🆕 Export
└── bin/
    └── spaghetti-compass-mcp.js  # 🆕 Point d'entrée MCP
```

---

## Dependencies

### Phase 1
- Aucune nouvelle dépendance requise

### Phase 2
- `@modelcontextprotocol/sdk` : SDK officiel MCP
- `zod` : Validation des schémas (optionnel, déjà utilisé par MCP SDK)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Nom `spaghetti-compass` déjà pris sur npm | Bloquant | Vérifier disponibilité avant publication |
| Format JSON incompatible avec agents | Moyen | Tester avec Cursor avant publication |
| MCP SDK instable | Faible | Phase 2 optionnelle, CLI suffit |
| Publication npm accidentelle | Moyen | Workflow manuel avec dry-run par défaut |
| Secrets GitHub exposés | Critique | Utiliser les secrets GitHub, jamais en clair |

---

## Validation Checklist

### Phase 1
- [ ] `npm pack` crée un tarball valide
- [ ] `npx spaghetti-compass explore <file> --json` fonctionne
- [ ] Le JSON est parsable par `jq`
- [ ] Les tests passent
- [ ] README documenté pour agents

### Phase 1.5 (CI/CD)
- [ ] Workflow `publish-npm.yml` existe et est valide
- [ ] Secret GitHub configuré (`NPM_TOKEN`)
- [ ] `workflow_dispatch` permet publication npm manuelle
- [ ] Dry run (par défaut) teste le package sans publier
- [ ] Test local du package avant publication

### Phase 2
- [ ] Serveur MCP démarre sans erreur
- [ ] Outil `explore_dependencies` retourne le bon format
- [ ] Configuration Cursor fonctionne
