# Tasks: Agent Setup — Skill-Only Output with Destination Picker

**Input**: Documents de conception depuis `.cursor/spec-kit/specs/8-agent-setup-skill-only/`  
**Prerequisites**: plan.md, spec.md, research.md

---

## Phase 1: Setup

**Purpose**: Ajouter la dépendance interactive et préparer la structure

- [ ] T001 Installer `@inquirer/prompts` comme dépendance dans package.json
- [ ] T002 Créer le module `src/cli/agent-setup/destinations.ts` avec le registre des 3 destinations standard

---

## Phase 2: Foundational — Simplifier le template

**Purpose**: Réduire le template à skill-only (supprimer rules + commands)

- [ ] T003 Refactorer `src/cli/agent-setup/templates/cursor/index.ts` : ne garder que le contenu SKILL et exporter `SKILL_DIR_NAME` + `SKILL_CONTENT`
- [ ] T004 Mettre à jour `src/cli/agent-setup/workflows.ts` : simplifier pour que `getArtifacts()` retourne uniquement le skill artifact

---

## Phase 3: User Story 1 + 2 — Skill-only output + sélection interactive (Priority: P1)

**Goal**: La commande écrit uniquement un SKILL.md et propose un prompt multi-select pour les destinations

**Independent Test**: Lancer `agent-setup .` → prompt apparaît avec 3 choix → skill écrit dans les destinations sélectionnées

### Implementation

- [ ] T005 [US1] Implémenter la logique de prompt multi-select dans `src/cli/agent-setup/destinations.ts` (checkbox @inquirer/prompts)
- [ ] T006 [US1] Ajouter la détection TTY et l'erreur pour mode non-interactif sans --dest dans `src/cli/agent-setup/destinations.ts`
- [ ] T007 [US1+US2] Réécrire `src/cli/agent-setup/index.ts` : orchestration skill-only avec écriture multi-destination
- [ ] T008 [US2] Mettre à jour la commande dans `src/cli/index.ts` : remplacer `--workflow` par `--dest` (repeatable), supprimer l'argument path ou le garder optionnel

**Checkpoint**: `agent-setup` fonctionne en mode interactif (prompt) et en mode non-interactif (--dest)

---

## Phase 4: User Story 3 — Compatibilité non-interactive (Priority: P2)

**Goal**: L'utilisateur peut passer `--dest claude --dest agents` pour un usage scriptable

**Independent Test**: `agent-setup --dest claude --dest agents` écrit le skill sans prompt

### Implementation

- [ ] T009 [US3] Valider les identifiants `--dest` passés en argument (erreur si invalide) dans `src/cli/agent-setup/index.ts`
- [ ] T010 [US3] S'assurer que le path de destination est créé avec `mkdir -p` (mkdirSync recursive) dans `src/cli/agent-setup/index.ts`

---

## Phase 5: Polish & Cross-Cutting

**Purpose**: Nettoyage et cohérence

- [ ] T011 [P] Supprimer le code mort : `RULE_SPAGHETTI_COMPASS` et `COMMAND_SPAGHETTI_COMPASS_EXPLORE` du template
- [ ] T012 [P] Mettre à jour la description de la commande `agent-setup` dans l'aide CLI
- [ ] T013 Vérifier que `npm run build` compile sans erreur

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Pas de dépendances
- **Phase 2 (Foundational)**: Dépend de Phase 1 (T001)
- **Phase 3 (US1+US2)**: Dépend de Phase 2
- **Phase 4 (US3)**: Dépend de Phase 3 (T008 pour --dest parsing)
- **Phase 5 (Polish)**: Dépend de Phase 3

### Parallel Opportunities

- T011 et T012 peuvent s'exécuter en parallèle
- T005 et T006 sont dans le même fichier mais logiquement séquentiels

---

## Implementation Strategy

### MVP (Phase 1→3)

1. Installer la dépendance
2. Simplifier le template
3. Implémenter le prompt + écriture multi-destination
4. **VALIDATE**: tester interactivement

### Full (Phase 4→5)

5. Valider le mode --dest
6. Nettoyage final

---

## Summary

- **Total tasks**: 13
- **User Stories**: US1 (skill-only), US2 (interactive prompt), US3 (non-interactive --dest)
- **MVP scope**: T001–T008 (Phases 1-3)
