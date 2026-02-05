# Task Breakdown: Agent Integration pour Spaghetti-Compass

**Feature Branch**: `001-agent-integration`
**Created**: 2026-02-04

---

## Phase 1: Préparation npm (4 tasks)

### [X] T001 - Compléter les métadonnées package.json
**Complexity**: Simple
**Prerequisites**: None
**Files**: `package.json`

Ajouter les champs requis pour une publication npm professionnelle :
- `repository` : URL du repo GitHub
- `bugs` : URL pour les issues
- `homepage` : URL du README ou documentation
- `author` : Nom et email
- Vérifier les `keywords` pour la découvrabilité

---

### [X] T002 - Vérifier la disponibilité du nom sur npm
**Complexity**: Simple
**Prerequisites**: None
**Files**: None
**Result**: ✅ Le nom `spaghetti-compass` est disponible sur npm

```bash
npm view spaghetti-compass
```

Si le nom est pris, choisir une alternative (`@username/spaghetti-compass` ou `code-spaghetti-compass`).

---

### [X] T003 - Valider le format JSON de sortie
**Complexity**: Simple
**Prerequisites**: None
**Files**: `src/output/json.ts`
**Result**: ✅ Format JSON complet avec version, timestamp, nodes, edges, stats

Vérifier que la sortie JSON inclut :
- Champ `version` du format (ex: "1.0.0")
- Tous les champs de `DependencyGraph`
- Chemins relatifs par défaut
- Timestamps ISO 8601

---

### [X] T004 - Tester le packaging local
**Complexity**: Simple
**Prerequisites**: T001, T003
**Files**: None
**Result**: ✅ Package size: 98.5 kB (< 500KB), 107 fichiers

```bash
npm run build
npm pack
# Tester le tarball généré
npx ./spaghetti-compass-0.1.0.tgz explore fixtures/typescript/main.ts --json
```

---

## Phase 2: Documentation Agent (3 tasks)

### [X] T005 [Story: US1] - Ajouter section "Usage by AI Agents" au README
**Complexity**: Medium
**Prerequisites**: T003
**Files**: `README.md`
**Result**: ✅ Section ajoutée avec exemples de commandes, schéma JSON, et prompts

Ajouter une section dédiée avec :
- Exemples de commandes pour Cursor/Claude
- Description du format JSON de sortie
- Cas d'usage typiques (refactoring, détection cycles, impact analysis)

---

### [X] T006 [Story: US1] - Documenter le schéma JSON complet
**Complexity**: Simple
**Prerequisites**: T003
**Files**: `README.md` ou `docs/json-schema.md`
**Result**: ✅ Schéma TypeScript documenté dans la section "Usage by AI Agents"

Documenter chaque champ de `DependencyGraph` avec :
- Type
- Description
- Exemple de valeur

---

### [X] T007 [Story: US1] - Créer des exemples de prompts pour agents
**Complexity**: Simple
**Prerequisites**: T005
**Files**: `README.md`
**Result**: ✅ 3 exemples de prompts ajoutés dans "Example Agent Prompts"

Ajouter des exemples de prompts que les utilisateurs peuvent donner à Cursor :
- "Analyse les dépendances de ce fichier avec spaghetti-compass"
- "Vérifie s'il y a des dépendances circulaires"
- "Montre-moi quels fichiers seraient impactés si je modifie cette fonction"

---

## Phase 3: CI/CD GitHub Actions (3 tasks)

**Story Goal**: Permettre la publication manuelle sur npm avec mode dry-run par défaut
**Independent Test**: Déclencher le workflow npm en dry-run

### [X] T008 - Créer le workflow publication npm (manuel avec dry-run)
**Complexity**: Medium
**Prerequisites**: T001
**Files**: `.github/workflows/publish-npm.yml`
**Result**: ✅ Workflow créé avec workflow_dispatch, version input, dry-run par défaut

Créer le workflow avec `workflow_dispatch` qui :
- Permet de spécifier une version (optionnel)
- Mode dry-run par défaut (sécurité)
- Teste le package localement avant publication
- Publie sur npm registry public

```yaml
name: Publish to npm
on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to publish'
        required: false
      dry_run:
        description: 'Dry run mode'
        type: boolean
        default: true  # Dry-run par défaut
```

---

### [X] T009 [P] - Documenter le secret GitHub requis
**Complexity**: Simple
**Prerequisites**: T008
**Files**: `README.md`
**Result**: ✅ Section "Publishing" ajoutée au README

Documenter :
- `NPM_TOKEN` : Comment le générer (`npm token create --type=automation`)

---

### T010 - Tester le workflow npm (dry-run)
**Complexity**: Simple
**Prerequisites**: T008, T009
**Files**: None

1. Aller dans Actions > "Publish to npm"
2. Cliquer "Run workflow"
3. Laisser "Dry run" coché (par défaut)
4. Vérifier les logs

**Checkpoint**: CI/CD configuré - publication manuelle prête

---

## Phase 4: User Story 1 - Publication npm (2 tasks)

**Story Goal**: Un agent peut utiliser `npx spaghetti-compass` pour explorer les dépendances
**Independent Test**: `npx spaghetti-compass explore <file> --json | jq '.nodes'`

### T011 [Story: US1] - Publier sur npm via GitHub Actions
**Complexity**: Simple
**Prerequisites**: T008, T010, Tests passent
**Files**: None

1. Aller dans Actions > "Publish to npm"
2. Cliquer "Run workflow"
3. **Décocher** "Dry run"
4. Vérifier la publication : `npm view spaghetti-compass`

---

### T012 [Story: US1] - Tester l'installation via npx
**Complexity**: Simple
**Prerequisites**: T011
**Files**: None

Dans un nouveau répertoire :
```bash
npx spaghetti-compass --version
npx spaghetti-compass explore <file> --json
```

**Checkpoint**: User Story 1 complete - agents peuvent utiliser spaghetti-compass via npx

---

## Phase 5: User Story 2 - Détection cycles (2 tasks)

**Story Goal**: Un agent peut détecter les dépendances circulaires
**Independent Test**: `npx spaghetti-compass explore <file> --json | jq '.stats.circularDependencies'`

### [X] T013 [Story: US2] - Vérifier la détection de cycles existante
**Complexity**: Simple
**Prerequisites**: T012
**Files**: `src/core/graph.ts`
**Result**: ✅ Détection fonctionnelle - cycle détecté: user_service.py ↔ auth_service.py

Tester avec les fixtures Python qui ont des cycles :
```bash
npx spaghetti-compass explore fixtures/python/app/main.py --json | jq '.stats.circularDependencies'
```

---

### [X] T014 [Story: US2] - Documenter la détection de cycles
**Complexity**: Simple
**Prerequisites**: T013
**Files**: `README.md`
**Result**: ✅ Exemples CI/CD ajoutés dans la section "CI/CD Integration"

Ajouter un exemple CI/CD pour bloquer les PRs avec cycles.

**Checkpoint**: User Story 2 complete - détection de cycles documentée

---

## Phase 6: User Story 3 - Serveur MCP (6 tasks) [OPTIONNEL - P2]

**Story Goal**: Intégration native avec Cursor via MCP
**Independent Test**: Configurer MCP et appeler `explore_dependencies` depuis Cursor

### T015 [Story: US3] - Installer le SDK MCP
**Complexity**: Simple
**Prerequisites**: T012
**Files**: `package.json`

```bash
npm install @modelcontextprotocol/sdk
```

---

### T016 [Story: US3] - Créer la structure du serveur MCP
**Complexity**: Medium
**Prerequisites**: T015
**Files**: `src/mcp/server.ts`, `src/mcp/index.ts`

Créer le squelette du serveur MCP avec :
- Initialisation du serveur
- Enregistrement des outils
- Gestion des erreurs

---

### T017 [Story: US3] [P] - Implémenter l'outil explore_dependencies
**Complexity**: Medium
**Prerequisites**: T016
**Files**: `src/mcp/tools/explore.ts`

Créer l'outil MCP qui :
- Accepte `file`, `function` (optionnel), `context` (optionnel)
- Appelle `Analyzer.analyze()`
- Retourne le `DependencyGraph` en JSON

---

### T018 [Story: US3] [P] - Créer le point d'entrée bin/spaghetti-compass-mcp.js
**Complexity**: Simple
**Prerequisites**: T016
**Files**: `bin/spaghetti-compass-mcp.js`, `package.json`

Ajouter le bin dans package.json et créer le script de lancement.

---

### T019 [Story: US3] - Tester le serveur MCP localement
**Complexity**: Medium
**Prerequisites**: T017, T018
**Files**: None

Tester avec le MCP Inspector ou un client de test.

---

### T020 [Story: US3] - Documenter la configuration Cursor
**Complexity**: Simple
**Prerequisites**: T019
**Files**: `README.md`

Ajouter la configuration `.cursor/mcp.json` et les instructions.

**Checkpoint**: User Story 3 complete - serveur MCP fonctionnel

---

## Dependency Graph

```
Phase 1: Préparation npm
T001 (package.json) ─┬─► T004 (test pack)
T002 (check name)   ─┤
T003 (JSON format)  ─┘
                      │
                      ▼
Phase 2: Documentation
T005 (README agents) ─► T006 (JSON schema) ─► T007 (prompts)
                      │
                      ▼
Phase 3: CI/CD GitHub Actions
T008 (npm workflow) ─► T009 (docs secret) ─► T010 (test dry-run)
                      │
                      ▼
Phase 4: Publication npm
T011 (publish npm) ─► T012 (test npx)
                      │
         ┌────────────┴────────────┐
         ▼                         ▼
Phase 5: Cycles              Phase 6: MCP (optionnel)
T013 ─► T014                 T015 ─► T016 ─┬─► T017 [P]
                                           └─► T018 [P]
                                                │
                                                ▼
                                           T019 ─► T020
```

---

## Parallel Execution Opportunities

- **T001**, **T002**, **T003** peuvent être faits en parallèle (pas de dépendances entre eux)
- **T017** (outil MCP) et **T018** (bin MCP) peuvent être développés en parallèle [P]

---

## Summary

| Metric | Value |
|--------|-------|
| **Total tasks** | 20 |
| **Phase 1 (Préparation)** | 4 tasks |
| **Phase 2 (Documentation)** | 3 tasks |
| **Phase 3 (CI/CD)** | 3 tasks |
| **Phase 4 (Publication)** | 2 tasks |
| **Phase 5 (Cycles)** | 2 tasks |
| **Phase 6 (MCP - optionnel)** | 6 tasks |
| **Parallel opportunities** | 5 tasks |
| **MVP (Phases 1-5)** | 14 tasks |
| **Estimated effort MVP** | ~3-4 heures |
| **Estimated effort complet** | ~6-8 heures |

---

## Suggested MVP

Pour atteindre l'objectif principal (agents peuvent utiliser l'outil) :

1. ✅ Phase 1 : Préparation npm (T001-T004)
2. ✅ Phase 2 : Documentation Agent (T005-T007)
3. ✅ Phase 3 : CI/CD GitHub Actions (T008-T012)
4. ✅ Phase 4 : Publication npm (T013-T014)
5. ✅ Phase 5 : Détection cycles (T015-T016)

La Phase 6 (MCP) est optionnelle et peut être implémentée ultérieurement si l'intégration CLI ne suffit pas.
