---
description: "Template de liste de tâches pour implémentation de fonctionnalité"
---

# Tasks: [FEATURE NAME]

**Input**: Documents de conception depuis `.specify/specs/[###-feature-name]/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Les exemples ci-dessous incluent des tâches de test. Les Tests sont OPTIONNELS - les inclure seulement si explicitement demandé dans la spécification de fonctionnalité.

**Organization**: Les tâches sont groupées par user story pour permettre implémentation et test indépendants de chaque story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Peut s'exécuter en parallèle (fichiers différents, pas de dépendances)
- **[Story]**: À quelle user story cette tâche appartient (ex: US1, US2, US3)
- Inclure les chemins de fichiers exacts dans les descriptions

## Conventions de Chemins

- **Projet unique**: `src/`, `tests/` à la racine du repository
- **Web app**: `backend/src/`, `frontend/src/`
- **Mobile**: `api/src/`, `ios/src/` ou `android/src/`
- Les chemins ci-dessous assument un projet unique - ajuster basé sur la structure de plan.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialisation du projet et structure de base

- [ ] T001 Créer structure projet selon plan d'implémentation
- [ ] T002 Initialiser projet [langage] avec dépendances [framework]
- [ ] T003 [P] Configurer outils de linting et formatting

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infrastructure core qui DOIT être complète avant TOUTE user story

**⚠️ CRITICAL**: Aucun travail de user story ne peut commencer avant que cette phase soit complète

Exemples de tâches foundational (ajuster basé sur votre projet):

- [ ] T004 Setup schéma base de données et framework de migrations
- [ ] T005 [P] Implémenter framework authentification/autorisation
- [ ] T006 [P] Setup structure routing API et middleware
- [ ] T007 Créer modèles/entités de base dont toutes les stories dépendent
- [ ] T008 Configurer infrastructure gestion d'erreurs et logging
- [ ] T009 Setup gestion configuration environnement

**Checkpoint**: Foundation prête - implémentation user story peut maintenant commencer en parallèle

---

## Phase 3: User Story 1 - [Title] (Priority: P1) 🎯 MVP

**Goal**: [Brève description de ce que cette story délivre]

**Independent Test**: [Comment vérifier que cette story fonctionne seule]

### Tests for User Story 1 (OPTIONAL - seulement si tests demandés) ⚠️

> **NOTE: Écrire ces tests EN PREMIER, s'assurer qu'ils ÉCHOUENT avant implémentation**

- [ ] T010 [P] [US1] Contract test pour [endpoint] dans tests/contract/test_[name].py
- [ ] T011 [P] [US1] Integration test pour [parcours utilisateur] dans tests/integration/test_[name].py

### Implementation for User Story 1

- [ ] T012 [P] [US1] Créer modèle [Entity1] dans src/models/[entity1].py
- [ ] T013 [P] [US1] Créer modèle [Entity2] dans src/models/[entity2].py
- [ ] T014 [US1] Implémenter [Service] dans src/services/[service].py (dépend de T012, T013)
- [ ] T015 [US1] Implémenter [endpoint/feature] dans src/[location]/[file].py
- [ ] T016 [US1] Ajouter validation et gestion d'erreurs
- [ ] T017 [US1] Ajouter logging pour opérations user story 1

**Checkpoint**: À ce point, User Story 1 devrait être entièrement fonctionnelle et testable indépendamment

---

## Phase 4: User Story 2 - [Title] (Priority: P2)

**Goal**: [Brève description de ce que cette story délivre]

**Independent Test**: [Comment vérifier que cette story fonctionne seule]

### Tests for User Story 2 (OPTIONAL - seulement si tests demandés) ⚠️

- [ ] T018 [P] [US2] Contract test pour [endpoint] dans tests/contract/test_[name].py
- [ ] T019 [P] [US2] Integration test pour [parcours utilisateur] dans tests/integration/test_[name].py

### Implementation for User Story 2

- [ ] T020 [P] [US2] Créer modèle [Entity] dans src/models/[entity].py
- [ ] T021 [US2] Implémenter [Service] dans src/services/[service].py
- [ ] T022 [US2] Implémenter [endpoint/feature] dans src/[location]/[file].py
- [ ] T023 [US2] Intégrer avec composants User Story 1 (si nécessaire)

**Checkpoint**: À ce point, User Stories 1 ET 2 devraient toutes deux fonctionner indépendamment

---

## Phase 5: User Story 3 - [Title] (Priority: P3)

**Goal**: [Brève description de ce que cette story délivre]

**Independent Test**: [Comment vérifier que cette story fonctionne seule]

### Tests for User Story 3 (OPTIONAL - seulement si tests demandés) ⚠️

- [ ] T024 [P] [US3] Contract test pour [endpoint] dans tests/contract/test_[name].py
- [ ] T025 [P] [US3] Integration test pour [parcours utilisateur] dans tests/integration/test_[name].py

### Implementation for User Story 3

- [ ] T026 [P] [US3] Créer modèle [Entity] dans src/models/[entity].py
- [ ] T027 [US3] Implémenter [Service] dans src/services/[service].py
- [ ] T028 [US3] Implémenter [endpoint/feature] dans src/[location]/[file].py

**Checkpoint**: Toutes les user stories devraient maintenant être indépendamment fonctionnelles

---

[Ajouter plus de phases user story si nécessaire, suivant le même pattern]

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Améliorations qui affectent plusieurs user stories

- [ ] TXXX [P] Mises à jour documentation dans docs/
- [ ] TXXX Nettoyage code et refactoring
- [ ] TXXX Optimisation performance à travers toutes les stories
- [ ] TXXX [P] Tests unitaires additionnels (si demandés) dans tests/unit/
- [ ] TXXX Renforcement sécurité
- [ ] TXXX Exécuter validation quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Pas de dépendances - peut commencer immédiatement
- **Foundational (Phase 2)**: Dépend de complétion Setup - BLOQUE toutes les user stories
- **User Stories (Phase 3+)**: Toutes dépendent de complétion phase Foundational
  - Les user stories peuvent ensuite procéder en parallèle (si équipe disponible)
  - Ou séquentiellement dans l'ordre de priorité (P1 → P2 → P3)
- **Polish (Final Phase)**: Dépend de complétion de toutes les user stories désirées

### User Story Dependencies

- **User Story 1 (P1)**: Peut commencer après Foundational (Phase 2) - Pas de dépendances sur autres stories
- **User Story 2 (P2)**: Peut commencer après Foundational (Phase 2) - Peut s'intégrer avec US1 mais devrait être testable indépendamment
- **User Story 3 (P3)**: Peut commencer après Foundational (Phase 2) - Peut s'intégrer avec US1/US2 mais devrait être testable indépendamment

### Within Each User Story

- Tests (si inclus) DOIVENT être écrits et ÉCHOUER avant implémentation
- Modèles avant services
- Services avant endpoints
- Implémentation core avant intégration
- Story complète avant de passer à la priorité suivante

### Parallel Opportunities

- Toutes les tâches Setup marquées [P] peuvent s'exécuter en parallèle
- Toutes les tâches Foundational marquées [P] peuvent s'exécuter en parallèle (dans Phase 2)
- Une fois phase Foundational complète, toutes les user stories peuvent commencer en parallèle
- Tous les tests pour une user story marqués [P] peuvent s'exécuter en parallèle
- Les modèles dans une story marqués [P] peuvent s'exécuter en parallèle
- Différentes user stories peuvent être travaillées en parallèle par différents membres de l'équipe

---

## Parallel Example: User Story 1

```bash
# Lancer tous les tests pour User Story 1 ensemble (si tests demandés):
Task: "Contract test pour [endpoint] dans tests/contract/test_[name].py"
Task: "Integration test pour [parcours utilisateur] dans tests/integration/test_[name].py"

# Lancer tous les modèles pour User Story 1 ensemble:
Task: "Créer modèle [Entity1] dans src/models/[entity1].py"
Task: "Créer modèle [Entity2] dans src/models/[entity2].py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Compléter Phase 1: Setup
2. Compléter Phase 2: Foundational (CRITICAL - bloque toutes les stories)
3. Compléter Phase 3: User Story 1
4. **STOP and VALIDATE**: Tester User Story 1 indépendamment
5. Deploy/demo si prêt

### Incremental Delivery

1. Compléter Setup + Foundational → Foundation prête
2. Ajouter User Story 1 → Tester indépendamment → Deploy/Demo (MVP!)
3. Ajouter User Story 2 → Tester indépendamment → Deploy/Demo
4. Ajouter User Story 3 → Tester indépendamment → Deploy/Demo
5. Chaque story ajoute de la valeur sans casser les stories précédentes

### Parallel Team Strategy

Avec plusieurs développeurs:

1. L'équipe complète Setup + Foundational ensemble
2. Une fois Foundational terminé:
   - Développeur A: User Story 1
   - Développeur B: User Story 2
   - Développeur C: User Story 3
3. Les stories se complètent et s'intègrent indépendamment

---

## Notes

- Les tâches [P] = fichiers différents, pas de dépendances
- Le label [Story] mappe la tâche à une user story spécifique pour la traçabilité
- Chaque user story devrait être indépendamment complétable et testable
- Vérifier que les tests échouent avant d'implémenter
- Commit après chaque tâche ou groupe logique
- S'arrêter à tout checkpoint pour valider la story indépendamment
- Éviter: tâches vagues, conflits de même fichier, dépendances cross-story qui cassent l'indépendance
