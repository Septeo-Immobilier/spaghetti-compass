# Tasks: PHP Links Target Definition

**Input**: Documents de conception depuis `.cursor/spec-kit/specs/6-php-link-definition-target/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅

**Tests**: Non demandés explicitement - tâches de test optionnelles incluses pour validation.

**Organization**: Tâches groupées par user story pour permettre implémentation et test indépendants.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Peut s'exécuter en parallèle (fichiers différents, pas de dépendances)
- **[Story]**: À quelle user story cette tâche appartient (US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: Préparation de l'environnement et fixtures de test

- [x] T001 Créer le répertoire de fixtures PSR-4 dans `tests/fixtures/php-psr4/`
- [x] T002 [P] Créer `tests/fixtures/php-psr4/composer.json` avec mappings PSR-4 de test
- [x] T003 [P] Créer `tests/fixtures/php-psr4/src/Models/User.php` (classe de test)
- [x] T004 [P] Créer `tests/fixtures/php-psr4/src/Services/UserService.php` (avec use statements)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infrastructure core qui DOIT être complète avant TOUTE user story

**⚠️ CRITICAL**: US1 et US2 dépendent de cette phase

- [x] T005 Ajouter les types `ComposerConfig` et `Psr4Mapping` dans `src/types/index.ts`
- [x] T006 Créer `src/core/composer.ts` avec la classe `ComposerResolver`
- [x] T007 Implémenter `ComposerResolver.findComposerJson()` - recherche récursive vers le parent
- [x] T008 Implémenter `ComposerResolver.loadConfig()` - parsing du composer.json
- [x] T009 Implémenter `ComposerResolver.resolve()` - résolution namespace → fichier

**Checkpoint**: ✅ ComposerResolver fonctionnel - peut résoudre `App\Models\User` → `src/Models/User.php`

---

## Phase 3: User Story 1 - Résolution des Namespaces PSR-4 (Priority: P1) 🎯 MVP

**Goal**: Les `use` statements PHP pointent vers la définition de la classe, pas le use statement

**Independent Test**: `spaghetti-compass explore` sur un projet PSR-4 affiche les liens vers les fichiers de définition

### Implementation for User Story 1

- [x] T010 [US1] Ajouter `isPhpNamespace()` dans `src/core/resolver.ts` - détecte les namespaces PHP
- [x] T011 [US1] Ajouter `resolvePhpNamespace()` dans `src/core/resolver.ts` - utilise ComposerResolver
- [x] T012 [US1] Modifier `PathResolver.resolve()` pour appeler `resolvePhpNamespace()` si namespace PHP
- [x] T013 [US1] Modifier `PathResolver.classifyLocation()` pour détecter vendor/ comme third-party
- [x] T014 [US1] Ajouter initialisation de `ComposerResolver` dans `PathResolver` constructor
- [x] T015 [US1] Tester manuellement avec fixture PSR-4: `npm run build && node dist/cli/index.js explore tests/fixtures/php-psr4/src/Services/UserService.php`

**Checkpoint**: ✅ US1 complète - les imports PSR-4 sont résolus vers les bons fichiers

---

## Phase 4: User Story 2 - Support Intelephense pour Résolution (Priority: P1)

**Goal**: Le LSP Intelephense est utilisé correctement pour trouver les définitions

**Independent Test**: Avec Intelephense installé, les liens pointent vers la ligne exacte de définition

### Implementation for User Story 2

- [x] T016 [US2] Modifier `getDefinitionFromImport()` dans `src/core/lsp/php.ts` - ne plus déléguer à getDefinitionByName
- [x] T017 [US2] Implémenter résolution du namespace vers fichier dans `getDefinitionFromImport()`
- [x] T018 [US2] Utiliser LSP `textDocument/definition` sur une utilisation réelle (pas le use statement)
- [x] T019 [US2] Ajouter fallback: si LSP échoue, utiliser ComposerResolver
- [x] T020 [US2] Tester avec Intelephense: vérifier que la ligne de définition est correcte

**Checkpoint**: ✅ US2 complète - Intelephense retourne la ligne de définition de la classe

---

## Phase 5: User Story 3 - Distinction Imports Résolus vs Non-Résolus (Priority: P2)

**Goal**: L'output distingue visuellement les imports résolus des non-résolus

**Independent Test**: Un projet avec mix d'imports internes/third-party/non-résolus affiche correctement chaque catégorie

### Implementation for User Story 3

- [x] T021 [US3] Modifier `src/output/text.ts` pour afficher "(via composer.json)" ou "(via LSP)" selon la méthode
- [x] T022 [US3] Ajouter indicateur visuel "⚠️" pour les imports non-résolus
- [x] T023 [US3] Ajouter le champ `resolvedVia` dans `GraphEdge` (optionnel, pour debugging)
- [x] T024 [US3] Tester l'affichage avec un projet mixte (internes + vendor + non-résolus)

**Checkpoint**: ✅ US3 complète - l'output est clair sur l'état de résolution de chaque import

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Améliorations qui affectent plusieurs user stories

- [x] T025 [P] Ajouter cache des résolutions Composer dans `ComposerResolver`
- [x] T026 [P] Gérer le cas edge: pas de composer.json (fallback gracieux)
- [x] T027 [P] Gérer le cas edge: composer.json invalide (warning, pas erreur)
- [x] T028 Mettre à jour README.md avec la nouvelle fonctionnalité PHP PSR-4
- [x] T029 Exécuter validation quickstart.md sur les 5 scénarios

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Pas de dépendances - peut commencer immédiatement
- **Foundational (Phase 2)**: Dépend de Setup - BLOQUE toutes les user stories
- **User Story 1 (Phase 3)**: Dépend de Foundational
- **User Story 2 (Phase 4)**: Dépend de Foundational (peut être parallèle à US1)
- **User Story 3 (Phase 5)**: Dépend de US1 et US2 (utilise leurs résultats)
- **Polish (Phase 6)**: Dépend de toutes les user stories

### Within Each Phase

```
Phase 2: T005 → T006 → T007 → T008 → T009
Phase 3: T010 → T011 → T012 → T013 → T014 → T015
Phase 4: T016 → T017 → T018 → T019 → T020
Phase 5: T021 → T022 → T023 → T024
```

### Parallel Opportunities

```
Phase 1: T002, T003, T004 peuvent s'exécuter en parallèle
Phase 3 et Phase 4: Peuvent s'exécuter en parallèle (fichiers différents)
Phase 6: T025, T026, T027 peuvent s'exécuter en parallèle
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Compléter Phase 1: Setup (fixtures)
2. Compléter Phase 2: Foundational (ComposerResolver)
3. Compléter Phase 3: User Story 1 (résolution PSR-4)
4. **STOP and VALIDATE**: Tester sur fixture et projet réel
5. Si OK → continuer avec US2 et US3

### Suggested MVP Scope

**Tâches MVP**: T001-T015 (15 tâches)
**Estimation**: ~4-6 heures de développement

### Post-MVP

**Tâches Post-MVP**: T016-T029 (14 tâches)
**Estimation**: ~3-4 heures de développement

---

## Summary

| Phase | Tâches | Parallélisables |
|-------|--------|-----------------|
| Setup | 4 | 3 |
| Foundational | 5 | 0 |
| US1 (P1) | 6 | 0 |
| US2 (P1) | 5 | 0 |
| US3 (P2) | 4 | 0 |
| Polish | 5 | 3 |
| **Total** | **29** | **6** |

**MVP**: 15 tâches (Phases 1-3)
**Complet**: 29 tâches (toutes les phases)
