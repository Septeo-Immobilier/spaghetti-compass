# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `.specify/specs/[###-feature-name]/spec.md`

**Note**: Ce template est rempli par la commande `/speckit.plan`. Voir `.cursor/rules/speckit-plan.mdc` pour le workflow d'exécution.

## Summary

[Extraire de la feature spec : requirement primaire + approche technique de la recherche]

## Technical Context

<!-- Remplir avec les informations de tech stack - utiliser NEEDS CLARIFICATION si inconnu -->

**Language/Version**: [ex: Python 3.11, Swift 5.9, Rust 1.75 ou NEEDS CLARIFICATION] 
**Primary Dependencies**: [ex: FastAPI, UIKit, LLVM ou NEEDS CLARIFICATION] 
**Storage**: [si applicable, ex: PostgreSQL, CoreData, files ou N/A] 
**Testing**: [ex: pytest, XCTest, cargo test ou NEEDS CLARIFICATION] 
**Target Platform**: [ex: Linux server, iOS 15+, WASM ou NEEDS CLARIFICATION]
**Project Type**: [single/web/mobile - détermine la structure source] 
**Performance Goals**: [spécifique au domaine, ex: 1000 req/s, 10k lines/sec, 60 fps ou NEEDS CLARIFICATION] 
**Constraints**: [spécifique au domaine, ex: <200ms p95, <100MB memory, offline-capable ou NEEDS CLARIFICATION] 
**Scale/Scope**: [spécifique au domaine, ex: 10k users, 1M LOC, 50 screens ou NEEDS CLARIFICATION]

## Constitution Check

*GATE: Doit passer avant la recherche Phase 0. Re-vérifier après le design Phase 1.*

[Gates déterminés basés sur le fichier constitution]

## Project Structure

### Documentation (this feature)

```text
.specify/specs/[###-feature]/
├── plan.md          # Ce fichier (output commande /speckit.plan)
├── research.md      # Output Phase 0 (commande /speckit.plan)
├── data-model.md    # Output Phase 1 (commande /speckit.plan)
├── quickstart.md    # Output Phase 1 (commande /speckit.plan)
├── contracts/       # Output Phase 1 (commande /speckit.plan)
└── tasks.md         # Output Phase 2 (commande /speckit.tasks - PAS créé par /speckit.plan)
```

### Source Code (repository root)

<!-- Sélectionner une structure basée sur le type de projet -->

```text
# [SUPPRIMER SI NON UTILISÉ] Option 1: Projet unique (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [SUPPRIMER SI NON UTILISÉ] Option 2: Application Web (quand "frontend" + "backend" détectés)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [SUPPRIMER SI NON UTILISÉ] Option 3: Mobile + API (quand "iOS/Android" détecté)
api/
└── [même que backend ci-dessus]

ios/ ou android/
└── [structure spécifique plateforme]
```

**Structure Decision**: [Documenter la structure sélectionnée et référencer les vrais répertoires capturés ci-dessus]

## Complexity Tracking

> **Remplir SEULEMENT si Constitution Check a des violations qui doivent être justifiées**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [ex: 4th project] | [besoin actuel] | [pourquoi 3 projets insuffisant] |
| [ex: Repository pattern] | [problème spécifique] | [pourquoi accès DB direct insuffisant] |
