# Implementation Plan: Agent-setup CLI

**Branch**: `7-agent-setup-cli` | **Date**: 2026-02-11 | **Spec**: [spec.md](./spec.md)

## Summary

Ajouter une sous-commande CLI `agent-setup` au binaire `spaghetti-compass` : elle prend un chemin cible (défaut : CWD) et un identifiant de workflow IA (MVP : `cursor`), puis écrit ou écrase les fichiers de configuration agent (règles, commandes, skills) dans le répertoire cible. Opération idempotente, une fois par projet ou à refaire en cas de mise à jour du package.

## Technical Context

**Language/Version**: TypeScript (Node 20+, existant)  
**Primary Dependencies**: Commander (déjà utilisé), fs/path (node)  
**Storage**: Fichiers sur disque (écriture .cursor/, .agents/)  
**Testing**: Tests unitaires pour le module agent-setup ; tests d’intégration CLI avec répertoire temporaire  
**Target Platform**: Même que le CLI actuel (Node.js)  
**Project Type**: CLI monolith, structure existante `src/cli/`, `src/core/`  
**Constraints**: Pas de dépendance réseau pour les templates (embarqués).  
**Scale/Scope**: Un nombre limité de workflows et de fichiers par workflow (MVP : 1 workflow, quelques fichiers).

## Constitution Check

- **LSP-First** : N/A (pas d’analyse de code, uniquement écriture de config).
- **Architecture modulaire** : Nouveau module dédié (handler + templates) sous `src/cli/` ou `src/agent-setup/`, pas de modification du core analyzer.
- **Contrat / extensibilité** : Les workflows sont un registry extensible (ajout de nouveaux ids sans casser l’existant).

Aucune violation des principes fondamentaux.

## Project Structure

### Documentation (cette feature)

```text
.cursor/spec-kit/specs/7-agent-setup-cli/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── cli-interface.md
└── tasks.md         # Généré par /speckit.tasks
```

### Code source (repository root)

Ajouts proposés :

```text
src/
├── cli/
│   ├── index.ts           # Ajouter la sous-commande agent-setup
│   └── agent-setup/       # (optionnel) module dédié
│       ├── index.ts       # Handler + registry workflows
│       └── templates/
│           └── cursor/    # Fichiers .md pour workflow cursor
│               ├── rules/
│               ├── commands/
│               └── skills/
```

Ou templates au même niveau que le binaire (ex. `templates/agent-setup/cursor/`) selon convention du projet.

## Design Decisions (résumé research)

- Commande : `spaghetti-compass agent-setup [path]` avec options `--workflow`, `--path`.
- MVP : un seul workflow `cursor` ; fichiers dans `.cursor/rules`, `.cursor/commands`, `.agents/skills`.
- Contenu : templates embarqués (fichiers .md en dur ou chargés depuis le package).
- Écriture : overwrite des fichiers gérés uniquement ; pas de suppression d’autres fichiers.
- Exit codes : 0 succès, 2 chemin invalide, 5 workflow inconnu.

## Complexity Tracking

Aucune violation de la constitution à justifier.
