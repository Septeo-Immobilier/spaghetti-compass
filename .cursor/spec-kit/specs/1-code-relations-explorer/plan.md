# Implementation Plan: Code Relations Explorer

**Branch**: `1-code-relations-explorer` | **Date**: 2026-02-02 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `.cursor/spec-kit/specs/1-code-relations-explorer/spec.md`

## Summary

Créer un CLI Node.js qui analyse et visualise les relations de dépendances (imports/exports) dans les projets JavaScript/TypeScript. L'utilisateur définit un dossier comme "contexte" pour distinguer les dépendances internes des externes. Le graphe complet des relations transitives est calculé et affiché en texte lisible ou JSON.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20+  
**Primary Dependencies**: typescript (compiler API), commander.js (CLI)  
**Storage**: N/A (analyse statique, pas de persistance)  
**Testing**: Vitest (tests unitaires et d'intégration)  
**Target Platform**: Node.js CLI (cross-platform)  
**Project Type**: Single package  
**Performance Goals**: < 5s pour 1000 fichiers (SC-001, SC-004)  
**Constraints**: Relations transitives complètes (FR-011), imports dynamiques signalés (FR-010)  
**Scale/Scope**: Projets de 1-1000 fichiers TypeScript/JavaScript

## Constitution Check

*GATE: Doit passer avant la recherche Phase 0. Re-vérifier après le design Phase 1.*

| Principe | Statut | Notes |
|----------|--------|-------|
| LSP-First | ⚠️ Divergence justifiée | CLI utilise TypeScript Compiler API directement (pas d'extension VSCode pour MVP) |
| Architecture Modulaire | ✅ Pass | Core Engine + Parser + CLI séparés |
| Modèle de Données du Graphe | ✅ Pass | Structure nodes/edges avec types de relations |
| Résolution Best-Effort | ✅ Pass | Imports dynamiques marqués resolved: false |
| Performance et Cache | 🔄 Phase 2 | Indexation incrémentale pour futurs développements |

**Divergence documentée** : La constitution prévoit une extension VSCode avec LSP. Le CLI a été choisi lors de la clarification (session 2026-02-02) pour accélérer le développement initial. L'architecture reste compatible avec une future extension.

## Project Structure

### Documentation (this feature)

```text
.cursor/spec-kit/specs/1-code-relations-explorer/
├── spec.md              # Spécification fonctionnelle
├── plan.md              # Ce fichier
├── research.md          # Recherche technique (Phase 0)
├── data-model.md        # Modèle de données (Phase 1)
├── quickstart.md        # Guide de démarrage (Phase 1)
├── contracts/
│   └── cli-interface.md # Contrat CLI (Phase 1)
└── checklists/
    └── requirements.md  # Validation des requirements
```

### Source Code (repository root)

```text
src/
├── cli/
│   └── index.ts         # Point d'entrée CLI (commander.js)
├── core/
│   ├── graph.ts         # Structure DependencyGraph
│   ├── analyzer.ts      # Orchestration de l'analyse
│   └── resolver.ts      # Résolution des chemins et modules
├── parser/
│   ├── typescript.ts    # Parser utilisant TypeScript Compiler API
│   └── imports.ts       # Extraction des imports/exports
├── output/
│   ├── text.ts          # Formatter texte arborescent
│   └── json.ts          # Formatter JSON
└── types/
    └── index.ts         # Types partagés (GraphNode, GraphEdge, etc.)

tests/
├── unit/
│   ├── parser.test.ts
│   ├── graph.test.ts
│   └── resolver.test.ts
├── integration/
│   └── cli.test.ts
└── fixtures/            # Déjà créé avec le code de test
    └── app/
```

**Structure Decision**: Single package avec séparation claire entre CLI, Core, Parser, et Output. Les fixtures existantes servent de base pour les tests.

## Artifacts Generated

| Artifact | Path | Status |
|----------|------|--------|
| Research | `research.md` | ✅ Complet |
| Data Model | `data-model.md` | ✅ Complet |
| CLI Contract | `contracts/cli-interface.md` | ✅ Complet |
| Quickstart | `quickstart.md` | ✅ Complet |
| Plan | `plan.md` | ✅ Complet |

## Complexity Tracking

| Divergence | Justification | Alternative rejetée |
|------------|---------------|---------------------|
| CLI au lieu d'extension VSCode | Clarification utilisateur + développement plus rapide | Extension VSCode : trop de setup initial pour valider le concept |
| TypeScript Compiler API directe | Accès complet AST et type checker | LSP : nécessite un serveur externe, overhead pour CLI |

## Next Steps

La phase de planification est terminée. Prochaine commande : **`/speckit.tasks`** pour générer les tâches d'implémentation.
