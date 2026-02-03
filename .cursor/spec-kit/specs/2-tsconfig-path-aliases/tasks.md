# Tasks: TSConfig Path Aliases

**Input**: Documents de conception depuis `.cursor/spec-kit/specs/2-tsconfig-path-aliases/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Non demandés explicitement - tâches de test omises.

**Organization**: Tâches groupées par user story pour implémentation et test indépendants.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Peut s'exécuter en parallèle (fichiers différents, pas de dépendances)
- **[Story]**: User story associée (US1, US2, US3, US4)
- Chemins de fichiers exacts inclus

---

## Phase 1: Setup

**Purpose**: Aucune nouvelle dépendance requise - projet existant avec TypeScript déjà configuré.

- [x] T001 Vérifier version typescript >= 5.0.0 dans package.json

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infrastructure core - DOIT être complète avant TOUTE user story

**⚠️ CRITICAL**: Les user stories dépendent de ces tâches foundational.

- [x] T002 Ajouter types TsConfigInfo et PathMapping dans src/types/index.ts
- [x] T003 Ajouter type ResolvedAlias dans src/types/index.ts
- [x] T004 Étendre interface ContextInfo avec projectRoot et tsConfigPath dans src/types/index.ts
- [x] T005 Créer src/core/tsconfig.ts avec classe TsConfigResolver vide
- [x] T006 Implémenter findPackageJson(fromFile) dans src/core/tsconfig.ts
- [x] T007 Implémenter findTsConfig(fromFile) dans src/core/tsconfig.ts
- [x] T008 Implémenter loadTsConfig(configPath) avec ts.readConfigFile dans src/core/tsconfig.ts
- [x] T009 Implémenter support extends dans loadTsConfig via ts.parseJsonConfigFileContent
- [x] T010 Ajouter cache TsConfigCache dans src/core/tsconfig.ts

**Checkpoint**: Foundation prête - implémentation user story peut commencer

---

## Phase 3: User Story 1 - Résolution alias @/ (Priority: P1) 🎯 MVP

**Goal**: Résoudre les imports `@/core/service` vers `src/core/service.ts` via tsconfig paths

**Independent Test**: Exécuter `spaghetti-compass explore` sur fichier avec alias `@/` → imports classés "internal"

### Implementation for User Story 1

- [x] T011 [US1] Implémenter extractPathMappings(parsedConfig) dans src/core/tsconfig.ts
- [x] T012 [US1] Implémenter compilePatternRegex(pattern) pour wildcards dans src/core/tsconfig.ts
- [x] T013 [US1] Implémenter resolveAlias(specifier) dans TsConfigResolver
- [x] T014 [US1] Modifier PathResolver.resolve() pour appeler TsConfigResolver.resolveAlias() en premier dans src/core/resolver.ts
- [x] T015 [US1] Modifier PathResolver.isNpmPackage() pour exclure les alias matchés dans src/core/resolver.ts
- [x] T016 [US1] Modifier Analyzer constructor pour initialiser TsConfigResolver dans src/core/analyzer.ts
- [x] T017 [US1] Passer tsConfigPath depuis CLI vers Analyzer dans src/cli/index.ts

**Checkpoint**: US1 fonctionnelle - alias `@/` résolus vers fichiers internes

---

## Phase 4: User Story 2 - Alias multiples et patterns complexes (Priority: P2)

**Goal**: Support de plusieurs alias (`@core/*`, `@modules/*`) et fallback sur plusieurs cibles

**Independent Test**: tsconfig avec 3+ alias différents → tous résolus correctement

### Implementation for User Story 2

- [x] T018 [US2] Supporter plusieurs PathMappings dans TsConfigResolver.resolveAlias()
- [x] T019 [US2] Implémenter fallback targets (essayer chaque cible jusqu'à trouver le fichier) dans src/core/tsconfig.ts
- [x] T020 [US2] Gérer pattern exact (sans wildcard) vs pattern wildcard dans compilePatternRegex

**Checkpoint**: US2 fonctionnelle - multiples alias et fallbacks supportés

---

## Phase 5: User Story 3 - Découverte automatique tsconfig (Priority: P2)

**Goal**: Trouver automatiquement tsconfig.json sans option CLI

**Independent Test**: Exécuter depuis sous-répertoire → tsconfig racine utilisé automatiquement

### Implementation for User Story 3

- [x] T021 [US3] Appeler findTsConfig(entryFile) automatiquement dans Analyzer si pas de --tsconfig
- [x] T022 [US3] Appeler findPackageJson(entryFile) pour déterminer projectRoot automatiquement
- [x] T023 [US3] Implémenter dégradation gracieuse si pas de tsconfig (comportement actuel) dans src/core/analyzer.ts
- [x] T024 [US3] Ajouter message info "No tsconfig.json found, alias resolution disabled" dans src/cli/index.ts

**Checkpoint**: US3 fonctionnelle - découverte automatique sans config

---

## Phase 6: User Story 4 - Configuration explicite tsconfig (Priority: P3)

**Goal**: Options CLI `--tsconfig`, `--root`, `--no-tsconfig`

**Independent Test**: Passer `--tsconfig ./custom.json` → ce fichier utilisé

### Implementation for User Story 4

- [x] T025 [P] [US4] Ajouter option --tsconfig/-t dans src/cli/index.ts
- [x] T026 [P] [US4] Ajouter option --root/-r dans src/cli/index.ts
- [x] T027 [P] [US4] Ajouter option --no-tsconfig dans src/cli/index.ts
- [x] T028 [US4] Valider existence fichier --tsconfig avec message d'erreur explicite
- [x] T029 [US4] Valider existence répertoire --root avec message d'erreur explicite
- [x] T030 [US4] Passer options tsConfigPath et projectRoot à Analyzer

**Checkpoint**: US4 fonctionnelle - configuration CLI complète

---

## Phase 7: Output & Polish

**Purpose**: Améliorer l'affichage et finaliser

- [x] T031 [P] Modifier formatTextOutput pour afficher alias original entre parenthèses dans src/output/text.ts
- [x] T032 [P] Modifier formatJsonOutput pour ajouter aliasInfo aux edges dans src/output/json.ts
- [x] T033 [P] Ajouter aliasResolutions aux stats JSON dans src/output/json.ts
- [x] T034 Améliorer messages warning pour alias non résolus dans src/output/text.ts
- [ ] T035 Créer fixture projet tests/fixtures/tsconfig-project/ avec alias multiples
- [ ] T036 Valider scénarios quickstart.md manuellement
- [ ] T037 Mettre à jour README.md avec documentation des nouvelles options CLI

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
    │
    ▼
Phase 2 (Foundational) ← BLOQUE tout
    │
    ├──────────────────────────────┐
    ▼                              ▼
Phase 3 (US1 - P1) 🎯 MVP    Phase 5 (US3 - P2)
    │                              │
    ▼                              │
Phase 4 (US2 - P2)                 │
    │                              │
    ├──────────────────────────────┤
    ▼                              ▼
Phase 6 (US4 - P3)
    │
    ▼
Phase 7 (Polish)
```

### User Story Dependencies

| Story | Dépend de | Parallélisable avec |
|-------|-----------|---------------------|
| US1 (P1) | Foundational | US3 |
| US2 (P2) | US1 | - |
| US3 (P2) | Foundational | US1 |
| US4 (P3) | US1, US3 | - |

### Within Each User Story

1. Types et interfaces d'abord
2. Core logic (TsConfigResolver)
3. Intégration (PathResolver, Analyzer)
4. CLI et Output

### Parallel Opportunities

```bash
# Phase 2 - Tâches parallèles:
T002, T003, T004  # Types (fichiers différents dans même fichier mais sections distinctes)

# Phase 6 - Tâches parallèles:
T025, T026, T027  # Options CLI indépendantes

# Phase 7 - Tâches parallèles:
T031, T032, T033  # Output text/json indépendants
```

---

## Implementation Strategy

### MVP First (Recommandé)

1. ✅ Phase 1: Setup (T001)
2. ✅ Phase 2: Foundational (T002-T010)
3. ✅ Phase 3: User Story 1 (T011-T017) → **STOP & TEST**
4. 🚀 **Deploy MVP** - Alias `@/` fonctionnels

### Incremental Delivery

| Milestone | Stories incluses | Valeur livrée |
|-----------|-----------------|---------------|
| MVP | US1 | Résolution alias @/ basique |
| v1.1 | US1 + US2 | Alias multiples et fallbacks |
| v1.2 | US1 + US2 + US3 | Découverte automatique |
| v1.3 | Toutes | Configuration CLI complète |

---

## Summary

| Métrique | Valeur |
|----------|--------|
| **Total tâches** | 37 |
| **Tâches US1 (MVP)** | 7 |
| **Tâches US2** | 3 |
| **Tâches US3** | 4 |
| **Tâches US4** | 6 |
| **Tâches Foundational** | 9 |
| **Tâches Polish** | 7 |
| **Opportunités parallèles** | 9 tâches marquées [P] |

### MVP Scope

**17 tâches** pour le MVP complet (Phase 1 + 2 + 3):
- T001 (Setup)
- T002-T010 (Foundational)
- T011-T017 (US1)

Cela permet de résoudre les alias `@/` sur un projet NestJS standard sans configuration supplémentaire.
