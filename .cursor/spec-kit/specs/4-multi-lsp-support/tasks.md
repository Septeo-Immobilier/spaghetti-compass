# Tasks: Multi-LSP Support (PHP & Python)

**Input**: Documents de conception depuis `.cursor/spec-kit/specs/4-multi-lsp-support/`
**Prerequisites**: plan.md, spec.md

**Tests**: Tests d'intégration avec fixtures PHP et Python existantes.

**Organization**: Tâches groupées par phase pour permettre des releases incrémentales.

## Format: `[ID] [P?] [Phase] Description`

- **[P]**: Peut s'exécuter en parallèle (fichiers différents, pas de dépendances)
- **[Phase]**: À quelle phase cette tâche appartient
- Chemins de fichiers exacts inclus dans les descriptions

---

## Phase 1: Refactoring Architecture (P0 - Prerequisite)

**Purpose**: Extraire l'interface LspProvider et refactorer le code TypeScript existant

**Checkpoint**: Le code TypeScript fonctionne identiquement après refactoring

- [x] T001 Créer `src/core/lsp/types.ts` avec interface `LspProvider` et `DefinitionResult`
- [x] T002 Créer `src/core/lsp/null.ts` avec `NullLspProvider` (no-op fallback)
- [x] T003 Créer `src/core/lsp/typescript.ts` en migrant le code de `src/core/lsp.ts`
- [x] T004 Créer `src/core/lsp/factory.ts` avec `LspProviderFactory`
- [x] T005 Créer `src/core/lsp/index.ts` pour les re-exports
- [x] T006 Modifier `src/core/analyzer.ts` pour utiliser `LspProviderFactory`
- [x] T007 Supprimer l'ancien `src/core/lsp.ts`
- [x] T008 Vérifier que `spaghetti-compass explore` fonctionne toujours pour TypeScript

---

## Phase 2: Infrastructure JSON-RPC (P0)

**Purpose**: Créer l'infrastructure pour communiquer avec les LSP externes

**Checkpoint**: Le `LspProcessManager` peut communiquer avec un processus LSP

- [ ] T009 Créer `src/core/lsp/json-rpc.ts` avec types JSON-RPC (Request, Response, Notification)
- [ ] T010 Créer `src/core/lsp/process-manager.ts` avec spawn, communication stdin/stdout
- [ ] T011 Implémenter les méthodes LSP de base: `initialize`, `shutdown`
- [ ] T012 Implémenter `textDocument/didOpen` notification
- [ ] T013 Implémenter `textDocument/definition` request
- [ ] T014 Ajouter gestion des timeouts (défaut 5s) dans `process-manager.ts`
- [ ] T015 Ajouter cache des processus LSP par projet

---

## Phase 3: PHP Support (P1)

**Purpose**: Intégrer Intelephense pour PHP

**Independent Test**: Analyser `fixtures/app/main.py` et vérifier les liens de définition

- [ ] T016 [P] Créer `src/core/lsp/php.ts` avec `PhpLspProvider`
- [ ] T017 Implémenter détection de `intelephense` (`which intelephense` ou `npx`)
- [ ] T018 Implémenter démarrage du processus `intelephense --stdio`
- [ ] T019 Implémenter `getDefinition()` via LSP protocol
- [ ] T020 Implémenter `getDefinitionByName()` avec recherche de position
- [ ] T021 Ajouter fallback gracieux si Intelephense non installé
- [ ] T022 Tester avec fixtures PHP (`fixtures/app/`)

---

## Phase 4: Python Support (P1)

**Purpose**: Intégrer Pyright pour Python

**Independent Test**: Analyser fixtures Python et vérifier les liens de définition

- [ ] T023 [P] Créer `src/core/lsp/python.ts` avec `PythonLspProvider`
- [ ] T024 Implémenter détection de `pyright-langserver`
- [ ] T025 Implémenter démarrage du processus `pyright-langserver --stdio`
- [ ] T026 Implémenter `getDefinition()` via LSP protocol
- [ ] T027 Implémenter `getDefinitionByName()` avec recherche de position
- [ ] T028 Ajouter fallback gracieux si Pyright non installé
- [ ] T029 Créer fixtures Python de test si nécessaire

---

## Phase 5: Polish & Documentation (P2)

**Purpose**: Finalisation, documentation et UX

- [ ] T030 [P] Ajouter option CLI `--lsp <type>` pour forcer un LSP spécifique
- [ ] T031 [P] Améliorer les messages de warning quand LSP non disponible
- [ ] T032 [P] Documenter l'installation des LSP dans README.md
- [ ] T033 Ajouter tests unitaires pour `LspProviderFactory`
- [ ] T034 Ajouter tests d'intégration pour PHP et Python

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Refactoring) ← PREREQUISITE
    ↓
Phase 2 (JSON-RPC Infrastructure)
    ↓
Phase 3 (PHP) ←─────────┐
    ↓                   │ Parallélisables
Phase 4 (Python) ←──────┘
    ↓
Phase 5 (Polish)
```

### Within Each Phase

**Phase 1**:
- T001 → T002, T003 (types avant implémentations)
- T002, T003 → T004 (providers avant factory)
- T004 → T005 → T006 → T007 → T008

**Phase 2**:
- T009 → T010 (types avant process-manager)
- T010 → T011 → T012, T013 (séquentiels)
- T013 → T014, T015 (peuvent être parallèles)

**Phase 3 & 4**: Peuvent s'exécuter en parallèle après Phase 2

### Parallel Opportunities

- T016 et T023 peuvent s'exécuter en parallèle (fichiers différents)
- T030, T031, T032 peuvent s'exécuter en parallèle (indépendants)

---

## Implementation Strategy

### MVP First (Phase 1 + 2 + 3)

1. Compléter Phase 1: Refactoring architecture
2. Compléter Phase 2: Infrastructure JSON-RPC
3. Compléter Phase 3: PHP Support
4. **STOP and VALIDATE**: Tester avec projet PHP réel
5. Continuer avec Phase 4: Python Support

### Incremental Delivery

1. Phase 1 → Architecture prête, TypeScript fonctionne
2. Phase 2 → Infrastructure JSON-RPC prête
3. Phase 3 → PHP navigable
4. Phase 4 → Python navigable
5. Phase 5 → Documentation et polish

---

## Summary

| Métrique | Valeur |
|----------|--------|
| **Total tâches** | 34 |
| **Phase 1 (Refactoring)** | 8 |
| **Phase 2 (JSON-RPC)** | 7 |
| **Phase 3 (PHP)** | 7 |
| **Phase 4 (Python)** | 7 |
| **Phase 5 (Polish)** | 5 |
| **Opportunités parallèles** | 3 groupes |
| **MVP (Phase 1+2+3)** | 22 tâches |
