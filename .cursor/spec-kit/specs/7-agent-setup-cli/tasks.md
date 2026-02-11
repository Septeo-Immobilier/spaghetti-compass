# Tasks: Agent-setup CLI

**Input**: Documents de conception depuis `.cursor/spec-kit/specs/7-agent-setup-cli/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/cli-interface.md

**Organization**: Tâches groupées par user story pour implémentation et test indépendants.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Peut s'exécuter en parallèle (fichiers différents, pas de dépendances)
- **[Story]**: À quelle user story cette tâche appartient (US1, US2, US3)
- Chemins : `src/`, `tests/` à la racine du repository

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Structure et emplacements pour le module agent-setup

- [x] T001 Créer le répertoire `src/cli/agent-setup/` et le fichier `src/cli/agent-setup/index.ts` (exports vides ou stub)
- [x] T002 [P] Créer le répertoire des templates `src/cli/agent-setup/templates/cursor/` pour le workflow cursor

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Registry des workflows, validation du chemin cible, et intégration de la sous-commande dans le CLI

**⚠️ CRITICAL**: Aucun travail de user story ne peut commencer avant que cette phase soit complète

- [x] T003 Définir le type/interface Workflow et le registry des workflows (cursor uniquement en MVP) dans `src/cli/agent-setup/index.ts` ou `src/cli/agent-setup/workflows.ts`
- [x] T004 Implémenter la résolution et validation du répertoire cible (existe, est un répertoire, résolution absolue) dans `src/cli/agent-setup/index.ts` ou `src/cli/agent-setup/path.ts`
- [x] T005 Enregistrer la sous-commande `agent-setup` dans `src/cli/index.ts` avec options `--workflow`, `--path` et argument positionnel optionnel selon contrat `contracts/cli-interface.md`
- [x] T006 Définir les codes de sortie (0, 2 chemin invalide, 5 workflow inconnu) et les utiliser dans les handlers

**Checkpoint**: Foundation prête — implémentation des user stories peut commencer

---

## Phase 3: User Story 1 - Initialiser la config agent (P1)

**Goal**: Exécuter une commande avec un workflow choisi et obtenir les fichiers créés ou mis à jour au chemin cible

**Independent Test**: Exécuter `spaghetti-compass agent-setup --workflow cursor` et vérifier la présence des fichiers dans `.cursor/` et `.agents/`

### Implementation for User Story 1

- [x] T007 [US1] Créer les templates embarqués pour le workflow cursor (règles, commandes, skills) dans `src/cli/agent-setup/templates/cursor/` en s'appuyant sur le contenu existant `.cursor/rules/spaghetti-compass-exploration.md`, `.cursor/commands/spaghetti-compass-explore.md`, `.agents/skills/spaghetti-compass-exploration/SKILL.md`
- [x] T008 [US1] Implémenter la fonction d'écriture des fichiers gérés pour un workflow donné : pour chaque FileArtifact du workflow, résoudre le chemin absolu (targetDir + relativePath), créer les sous-dossiers si nécessaire, écrire le contenu (overwrite) dans `src/cli/agent-setup/index.ts`
- [x] T009 [US1] Brancher l'action de la sous-commande agent-setup : après validation du path et du workflow, appeler l'écriture des fichiers du workflow sélectionné ; afficher un message de succès et exit 0

**Checkpoint**: User Story 1 fonctionnelle — `agent-setup -w cursor` crée/écrase les fichiers attendus

---

## Phase 4: User Story 2 - Choisir le workflow IA (P1)

**Goal**: Workflow valide appliqué ; workflow inconnu refusé avec message et liste des workflows supportés

**Independent Test**: Lancer `agent-setup --workflow cursor` (succès) puis `agent-setup --workflow inconnu` (erreur, code 5, message listant les workflows)

### Implementation for User Story 2

- [x] T010 [US2] Valider l'option `--workflow` : si id absent, utiliser la valeur par défaut `cursor` (ou exiger l'option et afficher l'erreur avec liste des workflows)
- [x] T011 [US2] Si workflow inconnu : afficher un message d'erreur explicite listant les workflows supportés (ex. "Supported workflows: cursor"), exit code 5, ne pas écrire de fichier
- [x] T012 [US2] Documenter les workflows supportés dans le --help de la sous-commande (option --workflow avec liste ou description)

**Checkpoint**: User Stories 1 et 2 fonctionnent — choix de workflow et erreur workflow inconnu gérés

---

## Phase 5: User Story 3 - Cibler un répertoire (P2)

**Goal**: Permettre de configurer un sous-dossier ou un autre répertoire via --path ou argument positionnel

**Independent Test**: Exécuter `spaghetti-compass agent-setup -w cursor -p ./packages/app` et vérifier les fichiers sous `./packages/app/.cursor/` et `./packages/app/.agents/`

### Implementation for User Story 3

- [x] T013 [US3] Accepter l'argument positionnel optionnel `[path]` et l'option `--path` ; si les deux sont fournis, option --path prime (ou argument positionnel selon contrat)
- [x] T014 [US3] Résoudre le chemin par rapport à la CWD ; si le chemin existe mais n'est pas un répertoire (fichier), afficher erreur et exit 2 ; si inexistant, exit 2 avec message clair
- [x] T015 [US3] Lorsque le chemin est invalide, ne pas écrire aucun fichier et quitter avec code 2

**Checkpoint**: User Story 3 fonctionnelle — configuration d'un sous-projet ou répertoire personnalisé

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation et validation du quickstart

- [x] T016 [P] Mettre à jour le README (section Usage ou nouvelle section "Agent setup") avec la commande `agent-setup`, les options et les workflows supportés
- [x] T017 Exécuter les scénarios de `quickstart.md` et valider les exit codes et la présence des fichiers

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Aucune — peut commencer immédiatement
- **Phase 2 (Foundational)**: Dépend de Phase 1 — BLOQUE US1, US2, US3
- **Phase 3 (US1)**: Dépend de Phase 2
- **Phase 4 (US2)**: Dépend de Phase 2 ; peut être faite en parallèle avec US1 ou après
- **Phase 5 (US3)**: Dépend de Phase 2 ; peut être faite en parallèle avec US1/US2 ou après
- **Phase 6 (Polish)**: Dépend de complétion des phases 3, 4, 5

### Parallel Opportunities

- T001 et T002 peuvent s'exécuter en parallèle
- T007 (templates) peut avancer dès que T002 est fait ; T008 et T009 dépendent de T007
- T016 (README) peut être fait en parallèle avec T017 une fois les stories terminées

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Compléter Phase 1 et Phase 2
2. Compléter Phase 3 (US1) et Phase 4 (US2)
3. Valider : `agent-setup -w cursor` et `agent-setup -w inconnu`
4. Ajouter Phase 5 (US3) pour --path / argument
5. Phase 6 : docs et quickstart

### Résumé

- **Nombre total de tâches** : 17
- **Par user story** : US1 (3), US2 (3), US3 (3) ; Setup (2), Foundational (4), Polish (2)
- **Scope MVP suggéré** : Phases 1–4 (commande utilisable en racine avec workflow cursor + gestion erreurs)
