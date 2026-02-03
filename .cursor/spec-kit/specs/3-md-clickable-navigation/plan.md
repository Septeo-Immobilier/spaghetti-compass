# Implementation Plan: Clickable Navigation in Markdown Output

**Branch**: `3-md-clickable-navigation` | **Date**: 2026-02-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `.cursor/spec-kit/specs/3-md-clickable-navigation/spec.md`

## Summary

Ajouter la navigation cliquable dans l'output texte de spaghetti-compass. Les chemins de fichiers seront formatés au format standard `chemin:ligne:colonne` reconnu nativement par les terminaux VSCode/Cursor, bash et PowerShell. Les fichiers externes (node_modules) afficheront `package@version:path`.

## Technical Context

**Language/Version**: TypeScript 5.9.3, Node.js >= 20.0.0
**Primary Dependencies**: commander (CLI), typescript (parsing)
**Storage**: N/A (output console)
**Testing**: vitest
**Target Platform**: CLI cross-platform (Linux, macOS, Windows)
**Project Type**: Single project (CLI tool)
**Performance Goals**: < 10% overhead sur la génération d'output
**Constraints**: Dégradation gracieuse si terminal non supporté
**Scale/Scope**: Fichiers TypeScript/JavaScript, projets de toute taille

## Constitution Check

| Principe | Statut | Notes |
|----------|--------|-------|
| LSP-First | ✅ N/A | Cette feature est output-only, pas d'analyse LSP |
| Architecture Modulaire | ✅ | Modification isolée dans `src/output/text.ts` |
| Modèle de Données du Graphe | ✅ | Utilise les données existantes (GraphNode, GraphEdge) |
| Résolution Best-Effort | ✅ | Liens affichés même si fichier inexistant |

## Project Structure

### Documentation (this feature)

```text
.cursor/spec-kit/specs/3-md-clickable-navigation/
├── spec.md          # Spécification fonctionnelle
├── plan.md          # Ce fichier
├── research.md      # Recherche sur les formats de liens
├── data-model.md    # Modèle de données
├── quickstart.md    # Scénarios de validation
├── contracts/       # Contrats CLI
│   └── cli-interface.md
└── tasks.md         # Tâches d'implémentation (généré par /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── cli/
│   └── index.ts        # ← Ajouter options --absolute-paths, --no-links
├── output/
│   └── text.ts         # ← Modifier formatage des chemins
└── types/
    └── index.ts        # ← Ajouter types si nécessaire

# Pas de nouveaux fichiers à créer
```

**Structure Decision**: Projet unique existant. Modifications dans les fichiers existants uniquement.

## Implementation Approach

### Phase 1 : Format de base (US1 + US2)

1. Modifier `formatText()` dans `src/output/text.ts` pour :
   - Ajouter `:ligne:colonne` aux chemins de fichiers
   - Utiliser les chemins relatifs par défaut

2. Les données nécessaires sont déjà disponibles :
   - `GraphEdge.line` : numéro de ligne
   - `GraphNode.path` : chemin relatif
   - `ContextInfo.rootPath` : base pour les chemins

### Phase 2 : Options CLI (US1 + US2)

1. Ajouter `--absolute-paths` dans `src/cli/index.ts`
2. Ajouter `--no-links` dans `src/cli/index.ts`
3. Passer les options à `formatText()`

### Phase 3 : Fichiers externes (US3)

1. Créer une fonction `formatExternalPath()` pour :
   - Détecter les fichiers dans `node_modules`
   - Extraire nom et version du package
   - Formater comme `package@version:path`

### Phase 4 : Polish (US4)

1. Tester dans différents terminaux
2. Documenter les limitations
3. Valider la dégradation gracieuse

## Complexity Tracking

Pas de violations de la constitution. L'implémentation est simple et isolée.
