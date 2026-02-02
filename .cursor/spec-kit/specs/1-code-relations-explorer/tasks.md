# Tasks: Code Relations Explorer

**Input**: Documents de conception depuis `.cursor/spec-kit/specs/1-code-relations-explorer/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/cli-interface.md ✅

**Tests**: Non inclus (non demandés explicitement). Ajouter avec `/speckit.tasks --with-tests` si nécessaire.

**Organization**: Les tâches sont groupées par user story pour permettre implémentation et test indépendants de chaque story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Peut s'exécuter en parallèle (fichiers différents, pas de dépendances)
- **[Story]**: À quelle user story cette tâche appartient (ex: US1, US2)
- Inclure les chemins de fichiers exacts dans les descriptions

---

## Phase 1: Setup (Shared Infrastructure) ✅

**Purpose**: Initialisation du projet et structure de base

- [x] T001 Créer structure dossiers selon plan: `src/cli/`, `src/core/`, `src/parser/`, `src/output/`, `src/types/`, `tests/unit/`, `tests/integration/`
- [x] T002 Initialiser projet Node.js avec `package.json` (name: spaghetti-compass, type: module)
- [x] T003 [P] Installer dépendances: `typescript@^5.0`, `commander@^12.0`, `vitest` (dev)
- [x] T004 [P] Configurer `tsconfig.json` (target: ESNext, module: ESNext, strict: true)
- [x] T005 [P] Configurer ESLint + Prettier pour TypeScript
- [x] T006 Créer script `bin/spaghetti-compass` comme point d'entrée CLI

---

## Phase 2: Foundational (Blocking Prerequisites) ✅

**Purpose**: Infrastructure core qui DOIT être complète avant TOUTE user story

**⚠️ CRITICAL**: Aucun travail de user story ne peut commencer avant que cette phase soit complète

- [x] T007 Définir types partagés `GraphNode`, `GraphEdge`, `DependencyGraph` dans `src/types/index.ts`
- [x] T008 Définir types `ContextInfo`, `GraphStats` dans `src/types/index.ts`
- [x] T009 [P] Implémenter classe `DependencyGraph` (add/get nodes, add edges) dans `src/core/graph.ts`
- [x] T010 [P] Implémenter `PathResolver` (résolution chemins relatifs/absolus, détection node_modules) dans `src/core/resolver.ts`
- [x] T011 Créer helper détection import dynamique `isDynamicImport()` dans `src/parser/imports.ts`
- [x] T012 Créer helper extraction imports/exports d'un AST dans `src/parser/imports.ts`
- [x] T013 Implémenter `TypeScriptParser` utilisant TypeScript Compiler API dans `src/parser/typescript.ts`
- [x] T014 Setup structure CLI de base avec Commander.js dans `src/cli/index.ts` (commande `explore`, options)

**Checkpoint**: Foundation prête - implémentation user story peut maintenant commencer

---

## Phase 3: User Story 1 - Explorer les relations d'un fichier (Priority: P1) 🎯 MVP ✅

**Goal**: Sélectionner un fichier et visualiser toutes ses relations (imports, exports) avec le graphe transitif complet

**Independent Test**: Exécuter `spaghetti-compass explore fixtures/ts-app/main.ts -c fixtures/ts-app/` et vérifier que toutes les relations sont listées

### Implementation for User Story 1

- [x] T015 [US1] Implémenter `analyzeFile()` dans `src/core/analyzer.ts` - parse un fichier et extrait ses imports/exports
- [x] T016 [US1] Implémenter traversée transitive récursive dans `src/core/analyzer.ts` - suit tous les imports
- [x] T017 [US1] Implémenter détection de cycles dans `src/core/analyzer.ts` - évite boucles infinies, enregistre dans `stats.circularDependencies`
- [x] T018 [US1] Connecter commande CLI `explore <entry>` à `analyzeFile()` dans `src/cli/index.ts`
- [x] T019 [US1] Implémenter formatter texte arborescent dans `src/output/text.ts` (symboles: 📥, 📤, ⚠️)
- [x] T020 [US1] Ajouter gestion erreur "fichier non trouvé" (exit code 1) dans `src/cli/index.ts`
- [x] T021 [US1] Ajouter gestion erreur "parsing échoué" (exit code 3) dans `src/cli/index.ts`

**Checkpoint**: US1 fonctionnelle - peut explorer un fichier et voir ses relations transitives

---

## Phase 4: User Story 2 - Définir un dossier comme contexte/boîte (Priority: P1) 🎯 MVP ✅

**Goal**: Définir un périmètre d'analyse pour distinguer dépendances internes vs externes

**Independent Test**: Changer `--context` entre `fixtures/ts-app/` et `fixtures/` et vérifier que la classification interne/externe change

### Implementation for User Story 2

- [x] T022 [US2] Implémenter logique classification `location` (internal/external/third-party) dans `src/core/resolver.ts`
- [x] T023 [US2] Intégrer option `--context <dir>` dans CLI avec validation du dossier dans `src/cli/index.ts`
- [x] T024 [US2] Passer `ContextInfo` à l'analyzer pour classifier chaque noeud dans `src/core/analyzer.ts`
- [x] T025 [US2] Mettre à jour formatter texte pour grouper par location (internal/external/third-party) dans `src/output/text.ts`
- [x] T026 [US2] Ajouter gestion erreur "contexte non trouvé" (exit code 2) dans `src/cli/index.ts`
- [x] T027 [US2] Implémenter options `--include` et `--exclude` pour filtrer fichiers dans `src/core/analyzer.ts`

**Checkpoint**: US1 + US2 fonctionnelles - MVP complet pour exploration fichier avec classification

---

## Phase 5: User Story 3 - Explorer depuis une fonction spécifique (Priority: P2) ✅

**Goal**: Explorer les relations à partir d'une fonction pour voir son graphe d'appels

**Independent Test**: Exécuter `spaghetti-compass explore fixtures/ts-app/main.ts:main -c fixtures/ts-app/`

### Implementation for User Story 3

- [x] T028 [US3] Étendre parser pour extraire les fonctions/méthodes d'un fichier dans `src/parser/typescript.ts`
- [x] T029 [US3] Implémenter parsing du format `file:function` dans argument `<entry>` dans `src/cli/index.ts`
- [x] T030 [US3] Implémenter analyse des appels de fonction (type edge: `call`) dans `src/parser/imports.ts`
- [x] T031 [US3] Créer noeuds de type `function` avec ID format `file:functionName` dans `src/core/analyzer.ts`
- [x] T032 [US3] Mettre à jour formatter texte pour afficher graphe d'appels dans `src/output/text.ts`
- [x] T033 [US3] Ajouter gestion erreur "fonction non trouvée" (exit code 4) dans `src/cli/index.ts`

**Checkpoint**: US3 fonctionnelle - peut explorer depuis une fonction

---

## Phase 6: User Story 4 - Visualiser les dépendances externes (Priority: P2) ✅

**Goal**: Voir clairement les dépendances tierces (npm packages) utilisées dans le contexte

**Independent Test**: Explorer un fichier avec imports npm et vérifier que les packages sont listés distinctement avec 📦

### Implementation for User Story 4

- [x] T034 [US4] Améliorer détection packages npm dans `src/core/resolver.ts` (bare imports, @scope packages)
- [x] T035 [US4] Collecter quels fichiers internes utilisent chaque package tiers dans `src/core/analyzer.ts`
- [x] T036 [US4] Afficher section "third-party" avec détail des utilisateurs dans `src/output/text.ts`
- [x] T037 [US4] Enrichir stats avec `thirdPartyNodes` count dans `src/core/graph.ts`

**Checkpoint**: US4 fonctionnelle - vision complète des dépendances externes

---

## Phase 7: Output JSON & Polish ✅

**Purpose**: Sortie JSON structurée et finitions cross-cutting

- [x] T038 Implémenter formatter JSON conforme au schema dans `src/output/json.ts`
- [x] T039 Connecter option `--json` au formatter JSON dans `src/cli/index.ts`
- [x] T040 Implémenter option `--no-transitive` (relations directes uniquement) dans `src/core/analyzer.ts`
- [x] T041 Ajouter header/footer avec stats dans sortie texte (📊 Stats ligne) dans `src/output/text.ts`
- [x] T042 Ajouter affichage cycles détectés (🔄) en fin de sortie texte dans `src/output/text.ts`
- [x] T043 Ajouter `--help` et `--version` dans CLI dans `src/cli/index.ts`
- [x] T044 [P] Configurer build TypeScript et script npm "build" dans `package.json`
- [x] T045 [P] Tester manuellement tous les scénarios de `quickstart.md` avec les fixtures existantes
- [ ] T046 Valider performance < 5s sur projet 1000 fichiers (SC-001, SC-004)

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
    │
    ▼
Phase 2 (Foundational) ──── BLOQUE toutes les User Stories
    │
    ├──────────────────┬──────────────────┐
    ▼                  ▼                  ▼
Phase 3 (US1)    Phase 4 (US2)     [Optionnel en parallèle]
    │                  │
    └─────┬────────────┘
          ▼
    ✅ MVP COMPLET
          │
    ┌─────┴─────┐
    ▼           ▼
Phase 5 (US3)  Phase 6 (US4)  [Peuvent être parallèles]
    │           │
    └─────┬─────┘
          ▼
Phase 7 (Polish)
```

### User Story Dependencies

| Story | Dépend de | Peut commencer après |
|-------|-----------|---------------------|
| US1 (P1) | Phase 2 | Foundational complet |
| US2 (P1) | Phase 2 | Foundational complet (parallélisable avec US1) |
| US3 (P2) | US1 | Phase 3 complet |
| US4 (P2) | US1, US2 | Phases 3 et 4 complètes |

### Within Each Phase

- Types (`src/types/`) avant Graph/Resolver (`src/core/`)
- Parser (`src/parser/`) avant Analyzer (`src/core/analyzer.ts`)
- Core avant CLI (`src/cli/`) et Output (`src/output/`)

### Parallel Opportunities

```bash
# Phase 1 - parallélisables:
T003, T004, T005  # Peuvent tourner ensemble

# Phase 2 - parallélisables:
T009, T010        # Graph et Resolver indépendants

# Phase 7 - parallélisables:
T044, T045        # Build et tests manuels
```

---

## Parallel Example: Phase 2 Foundational

```bash
# Séquence obligatoire (types d'abord):
T007 → T008 → ...

# Puis en parallèle:
Task T009: "Implémenter classe DependencyGraph dans src/core/graph.ts"
Task T010: "Implémenter PathResolver dans src/core/resolver.ts"

# Séquence obligatoire (imports dépend de types):
T011 → T012 → T013 → T014
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. ✅ Phase 1: Setup projet
2. ✅ Phase 2: Foundational (parser, graph, types)
3. ✅ Phase 3: US1 - Explorer un fichier
4. ✅ Phase 4: US2 - Contexte interne/externe
5. **STOP and VALIDATE**: Tester MVP avec fixtures
6. Deploy v0.1.0

### Incremental Delivery

| Version | Stories | Valeur livrée |
|---------|---------|---------------|
| v0.1.0 | US1 + US2 | MVP: Explorer fichier avec contexte |
| v0.2.0 | + US3 | Exploration niveau fonction |
| v0.3.0 | + US4 | Audit dépendances tierces |
| v1.0.0 | + Phase 7 | JSON output, polish, performance |

---

## Résumé

| Métrique | Valeur |
|----------|--------|
| **Total tâches** | 46 |
| **Tâches Setup** | 6 |
| **Tâches Foundational** | 8 |
| **Tâches US1** | 7 |
| **Tâches US2** | 6 |
| **Tâches US3** | 6 |
| **Tâches US4** | 4 |
| **Tâches Polish** | 9 |
| **Tâches parallélisables [P]** | 8 |
| **MVP (Setup + Foundation + US1 + US2)** | 27 tâches |
