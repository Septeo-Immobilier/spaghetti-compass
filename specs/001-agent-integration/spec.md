# Feature Specification: Agent Integration pour Spaghetti-Compass

**Feature Branch**: `001-agent-integration`
**Created**: 2026-02-04
**Status**: Draft

---

## Contexte et Analyse

### Objectif Principal
Permettre aux agents IA (Cursor, GitHub Copilot, Claude, etc.) d'utiliser spaghetti-compass pour explorer les dépendances de code de manière programmatique.

### Analyse des Options

| Option | Complexité | Accessibilité Agent | Maintenance | Recommandation |
|--------|------------|---------------------|-------------|----------------|
| Extension VSCode | Haute | ❌ Agents n'utilisent pas les extensions | Haute | Non |
| Task VSCode | Basse | ⚠️ Limitée aux tasks | Basse | Non |
| Publication npm + CLI | Basse | ✅ Via `npx` ou terminal | Basse | **OUI** |
| MCP Server | Moyenne | ✅✅ Intégration native | Moyenne | **OUI (Phase 2)** |

### Décision Architecturale

**Approche en 2 phases :**

1. **Phase 1 (MVP)** : Publication npm + amélioration sortie JSON pour agents
2. **Phase 2 (Optionnelle)** : Serveur MCP pour intégration native Cursor/Claude

**Justification** :
- Les agents IA comme Cursor utilisent principalement le **terminal** pour exécuter des commandes
- `npx spaghetti-compass explore <file> --json` est immédiatement utilisable
- Un serveur MCP permettrait une intégration plus riche (sans passer par le terminal)

---

## User Scenarios & Testing

### User Story 1 - Agent explore un fichier via CLI (Priority: P0)

Un agent IA (Cursor) veut comprendre les dépendances d'un fichier pour effectuer un refactoring sécurisé.

**Why this priority**: C'est le cas d'usage principal demandé par l'utilisateur.

**Independent Test**: 
```bash
npx spaghetti-compass explore src/main.ts --json | jq '.nodes[].name'
```

**Acceptance Scenarios**:
1. **Given** un projet avec spaghetti-compass installé globalement ou via npx, **When** l'agent exécute `npx spaghetti-compass explore <file> --json`, **Then** il reçoit un JSON structuré avec les dépendances
2. **Given** un fichier TypeScript avec des imports, **When** l'agent analyse le JSON de sortie, **Then** il peut identifier tous les fichiers impactés par une modification
3. **Given** une fonction spécifique, **When** l'agent exécute `npx spaghetti-compass explore <file>:<function> --json`, **Then** il reçoit le graphe d'appels de cette fonction

---

### User Story 2 - Agent détecte les dépendances circulaires (Priority: P1)

Un agent veut vérifier qu'un changement n'introduit pas de dépendance circulaire.

**Why this priority**: Critique pour la qualité du code mais secondaire par rapport à l'exploration.

**Independent Test**:
```bash
npx spaghetti-compass explore src/index.ts --json | jq '.stats.circularDependencies'
```

**Acceptance Scenarios**:
1. **Given** un projet avec des dépendances circulaires, **When** l'agent analyse le JSON, **Then** le champ `stats.circularDependencies` contient la liste des cycles
2. **Given** un projet sans cycles, **When** l'agent analyse le JSON, **Then** `stats.circularDependencies` est un tableau vide

---

### User Story 3 - Agent utilise MCP pour exploration native (Priority: P2)

Un agent Cursor/Claude utilise le protocole MCP pour explorer les dépendances sans passer par le terminal.

**Why this priority**: Amélioration UX mais nécessite Phase 2.

**Independent Test**: Configurer le serveur MCP et appeler `explore_dependencies` depuis Cursor.

**Acceptance Scenarios**:
1. **Given** le serveur MCP configuré dans `.cursor/mcp.json`, **When** l'agent appelle l'outil `explore_dependencies`, **Then** il reçoit directement le graphe de dépendances
2. **Given** un fichier ouvert dans l'éditeur, **When** l'agent demande les dépendances, **Then** le serveur MCP utilise le fichier actif comme point d'entrée

---

## Requirements

### Functional Requirements

#### Phase 1 - Publication npm (P0)

- **FR-001**: Le package DOIT être publiable sur npm sous le nom `spaghetti-compass`
- **FR-002**: La commande `npx spaghetti-compass explore <file> --json` DOIT retourner un JSON valide parsable
- **FR-003**: Le JSON de sortie DOIT inclure tous les champs définis dans `DependencyGraph` (types/index.ts)
- **FR-004**: Le CLI DOIT supporter l'exploration de fichiers TypeScript, JavaScript, Python et PHP
- **FR-005**: Le CLI DOIT supporter l'exploration au niveau fonction avec la syntaxe `file:function`
- **FR-006**: Les chemins dans le JSON DOIT être relatifs au répertoire courant par défaut
- **FR-007**: Le CLI DOIT retourner des codes de sortie standardisés (0=succès, 1=fichier non trouvé, etc.)

#### Phase 1.5 - CI/CD GitHub Actions (P0)

- **FR-008**: Une GitHub Action DOIT permettre la publication manuelle sur npm via `workflow_dispatch`
- **FR-009**: Le workflow npm DOIT avoir un mode "dry-run" par défaut pour tester sans publier
- **FR-010**: Le workflow npm DOIT exécuter les tests avant publication
- **FR-011**: Le workflow npm DOIT tester l'installation locale du package avant publication
- **FR-012**: Le workflow DOIT utiliser les secrets GitHub pour le token npm

#### Phase 2 - Serveur MCP (P2)

- **FR-014**: Le serveur MCP DOIT exposer un outil `explore_dependencies` avec les paramètres `file` et `function` (optionnel)
- **FR-015**: Le serveur MCP DOIT retourner le même format JSON que le CLI
- **FR-016**: Le serveur MCP DOIT supporter la configuration via `.cursor/mcp.json`
- **FR-017**: Le serveur MCP DOIT pouvoir être lancé via `npx spaghetti-compass-mcp`

### Non-Functional Requirements

- **NFR-001**: Le temps d'analyse d'un fichier de 1000 lignes DOIT être < 2 secondes
- **NFR-002**: Le package npm DOIT avoir une taille < 500KB (sans node_modules)
- **NFR-003**: Le CLI DOIT fonctionner avec Node.js >= 20.0.0

### Key Entities

- **DependencyGraph**: Structure racine contenant nodes, edges, stats et metadata
- **GraphNode**: Représente un fichier, fonction, classe ou module externe
- **GraphEdge**: Représente une relation (import, call, re-export)
- **GraphStats**: Statistiques agrégées (counts, circular dependencies)

---

## Success Criteria

- **SC-001**: Un agent Cursor peut exécuter `npx spaghetti-compass explore <file> --json` et parser le résultat
- **SC-002**: Le package est publié sur npm et installable via `npm install -g spaghetti-compass`
- **SC-003**: La documentation README inclut des exemples d'utilisation par des agents IA
- **SC-004**: Les tests automatisés couvrent > 80% du code core
- **SC-005**: La publication npm peut être déclenchée manuellement via GitHub Actions
- **SC-006**: Le mode dry-run permet de valider le package avant publication réelle

---

## Edge Cases & Error Handling

### Fichiers non supportés
- Si l'extension n'est pas supportée (.rs, .go, etc.), retourner code 3 avec message explicite

### Imports non résolus
- Les imports dynamiques ou non résolus sont marqués `resolved: false` dans le JSON
- Le champ `stats.unresolvedEdges` compte ces cas

### Dépendances circulaires
- Les cycles sont détectés et listés dans `stats.circularDependencies`
- L'analyse continue malgré les cycles (pas de boucle infinie)

### Fichiers volumineux
- Pour les fichiers > 10000 lignes, afficher un warning mais continuer l'analyse

### Erreurs de parsing
- Les erreurs de syntaxe sont capturées et retournées dans `parseResult.errors`
- Le CLI retourne code 3 si le fichier d'entrée ne peut pas être parsé

---

## Out of Scope (Phase 1)

- Extension VSCode (complexité trop élevée pour le bénéfice agent)
- Interface graphique web
- Support de langages autres que TS/JS/Python/PHP
- Analyse de projets multi-root
- Cache persistant des analyses
- Publication automatique sur npm (toujours manuelle pour éviter les erreurs)
- Verdaccio ou registre npm privé (nécessite un serveur à gérer)

---

## Documentation Agent

### Exemple d'utilisation par Cursor

```markdown
# Pour explorer les dépendances d'un fichier
npx spaghetti-compass explore src/core/analyzer.ts --json

# Pour explorer une fonction spécifique
npx spaghetti-compass explore src/core/analyzer.ts:analyze --json

# Pour vérifier les dépendances circulaires
npx spaghetti-compass explore src/index.ts --json | jq '.stats.circularDependencies'
```

### Structure JSON de sortie

```json
{
  "version": "1.0.0",
  "generatedAt": "2026-02-04T10:00:00Z",
  "context": { "rootPath": "/project", ... },
  "entryPoint": "/project/src/main.ts",
  "nodes": [
    { "id": "/project/src/main.ts", "type": "file", "name": "main.ts", "location": "internal" }
  ],
  "edges": [
    { "from": "/project/src/main.ts", "to": "/project/src/utils.ts", "type": "import-static", "resolved": true }
  ],
  "stats": {
    "totalNodes": 5,
    "internalNodes": 3,
    "externalNodes": 0,
    "thirdPartyNodes": 2,
    "circularDependencies": []
  }
}
```
