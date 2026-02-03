# Tasks: Clickable Navigation in Markdown Output

**Input**: Documents de conception depuis `.cursor/spec-kit/specs/3-md-clickable-navigation/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Non demandés explicitement - tâches de test non incluses.

**Organization**: Tâches groupées par user story pour permettre implémentation et test indépendants.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Peut s'exécuter en parallèle (fichiers différents, pas de dépendances)
- **[Story]**: À quelle user story cette tâche appartient (ex: US1, US2, US3)
- Chemins de fichiers exacts inclus dans les descriptions

---

## Phase 1: Setup

**Purpose**: Préparation et compréhension du code existant

- [x] T001 Lire et comprendre `src/output/text.ts` (formatage actuel)
- [x] T002 Lire et comprendre `src/cli/index.ts` (options CLI existantes)
- [x] T003 Identifier les types à modifier dans `src/types/index.ts`

---

## Phase 2: Foundational (Infrastructure partagée)

**Purpose**: Types et utilitaires nécessaires à toutes les user stories

**⚠️ CRITICAL**: Aucun travail de user story ne peut commencer avant que cette phase soit complète

- [x] T004 Ajouter interface `MarkdownFormatOptions` dans `src/output/text.ts`
- [x] T005 Créer fonction utilitaire `formatClickablePath()` dans `src/output/text.ts`
- [x] T006 Ajouter options `--absolute-paths` et `--no-links` dans `src/cli/index.ts`

**Checkpoint**: Infrastructure prête - implémentation user story peut commencer ✅

---

## Phase 3: User Story 1 + 2 - Navigation fichier et ligne (Priority: P1) 🎯 MVP

**Goal**: Ctrl+click sur un chemin ouvre le fichier à la bonne ligne dans VSCode/Cursor

**Independent Test**: Exécuter `spaghetti-compass explore src/cli/index.ts` dans terminal VSCode, ctrl+click sur un chemin → fichier s'ouvre à la ligne

### Implementation for User Story 1 + 2

- [x] T007 [US1] Modifier `formatText()` pour utiliser `formatClickablePath()` sur le fichier d'entrée dans `src/output/text.ts`
- [x] T008 [US1] Modifier `formatEdgeGroup()` pour formater les chemins avec ligne dans `src/output/text.ts`
- [x] T009 [US2] Ajouter le numéro de colonne (défaut: 1) au format de sortie dans `src/output/text.ts`
- [x] T010 [US1] Implémenter option `--absolute-paths` : passer `absolutePaths` à `formatText()` dans `src/cli/index.ts`
- [x] T011 [US1] Implémenter option `--no-links` : passer `noLinks` à `formatText()` dans `src/cli/index.ts`
- [x] T012 [US1] Gérer l'échappement des chemins avec espaces/caractères spéciaux dans `src/output/text.ts`

**Checkpoint**: US1 + US2 fonctionnelles - navigation fichier:ligne:colonne opérationnelle ✅

---

## Phase 4: User Story 3 - Fichiers externes (Priority: P2)

**Goal**: Les fichiers dans node_modules affichent `package@version:path`

**Independent Test**: Analyser un fichier qui importe depuis node_modules, vérifier le format d'affichage

### Implementation for User Story 3

- [x] T013 [US3] Créer fonction `isExternalPath()` pour détecter les fichiers node_modules dans `src/output/text.ts`
- [x] T014 [US3] Créer fonction `extractPackageInfo()` pour extraire nom et version du package dans `src/output/text.ts`
- [x] T015 [US3] Modifier `formatClickablePath()` pour gérer les fichiers externes dans `src/output/text.ts`
- [x] T016 [US3] Gérer les scoped packages (`@org/package`) dans `extractPackageInfo()`

**Checkpoint**: US3 fonctionnelle - fichiers externes formatés correctement ✅

---

## Phase 5: User Story 4 - Compatibilité multi-terminal (Priority: P3)

**Goal**: Le format fonctionne dans bash, PowerShell, et terminaux externes

**Independent Test**: Exécuter la commande dans bash/PowerShell hors VSCode, vérifier que l'output est lisible

### Implementation for User Story 4

- [x] T017 [US4] Valider que le format `chemin:ligne:colonne` est correct pour bash/PowerShell
- [x] T018 [US4] Documenter les limitations des terminaux externes dans README ou output

**Checkpoint**: US4 validée - compatibilité multi-terminal confirmée ✅

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finalisation et documentation

- [x] T019 [P] Mettre à jour le README.md avec les nouvelles options CLI
- [x] T020 Valider tous les scénarios de `quickstart.md`
- [x] T021 Vérifier la non-régression de l'option `--hyperlinks` existante

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational) ← BLOQUE toutes les user stories
    ↓
Phase 3 (US1+US2) ← MVP
    ↓
Phase 4 (US3)
    ↓
Phase 5 (US4)
    ↓
Phase 6 (Polish)
```

### User Story Dependencies

- **US1 + US2 (P1)**: Peuvent être implémentées ensemble (même fichier, même logique)
- **US3 (P2)**: Dépend de US1 (utilise `formatClickablePath()`)
- **US4 (P3)**: Dépend de US1+US2 (validation du format)

### Within Each Phase

- T004 avant T005 (interface avant fonction)
- T005 avant T007-T012 (fonction utilitaire avant utilisation)
- T013-T014 avant T015 (fonctions helper avant intégration)

### Parallel Opportunities

- T001, T002, T003 peuvent s'exécuter en parallèle (lecture seule)
- T004, T005, T006 sont séquentiels (dépendances)
- T019 peut s'exécuter en parallèle avec T020, T021

---

## Implementation Strategy

### MVP First (US1 + US2 Only)

1. Compléter Phase 1: Setup (lecture code)
2. Compléter Phase 2: Foundational (types + options CLI)
3. Compléter Phase 3: US1 + US2
4. **STOP and VALIDATE**: Tester navigation fichier:ligne dans VSCode
5. Deploy/demo si prêt

### Incremental Delivery

1. Setup + Foundational → Infrastructure prête
2. US1 + US2 → Navigation basique (MVP!)
3. US3 → Fichiers externes formatés
4. US4 → Validation multi-terminal
5. Polish → Documentation à jour

---

## Summary

| Métrique | Valeur |
|----------|--------|
| **Total tâches** | 21 |
| **Tâches US1+US2** | 6 |
| **Tâches US3** | 4 |
| **Tâches US4** | 2 |
| **Tâches Setup/Foundational** | 6 |
| **Tâches Polish** | 3 |
| **Opportunités parallèles** | 4 groupes |
| **MVP (US1+US2)** | 12 tâches |
