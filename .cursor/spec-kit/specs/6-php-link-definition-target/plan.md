# Implementation Plan: PHP Links Target Definition

**Branch**: `6-php-link-definition-target` | **Date**: 2026-02-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `.cursor/spec-kit/specs/6-php-link-definition-target/spec.md`

## Summary

Corriger la résolution des liens PHP pour qu'ils pointent vers la **définition** des classes/fonctions (ligne de déclaration) plutôt que vers leur **utilisation** (ligne du `use` statement). L'approche technique combine un nouveau `ComposerResolver` pour résoudre les namespaces PSR-4 avec une correction du `PhpLspProvider` pour utiliser correctement Intelephense.

## Technical Context

**Language/Version**: TypeScript 5.9 / Node.js 20+
**Primary Dependencies**: Commander (CLI), TypeScript (parsing), Intelephense (LSP PHP)
**Storage**: N/A (outil CLI sans persistence)
**Testing**: Vitest
**Target Platform**: Linux/macOS/Windows (CLI cross-platform)
**Project Type**: Single (CLI tool)
**Performance Goals**: Analyse < 5s pour un fichier typique
**Constraints**: Doit fonctionner sans LSP (mode dégradé)
**Scale/Scope**: Projets PHP de toute taille (Symfony, Laravel, etc.)

## Constitution Check

| Principe | Conformité | Notes |
|----------|------------|-------|
| LSP-First | ✅ | LSP utilisé en fallback après résolution Composer |
| Architecture Modulaire | ✅ | Nouveau `ComposerResolver` isolé dans `src/core/` |
| Résolution Best-Effort | ✅ | Fallback gracieux si résolution échoue |
| Extensibilité | ✅ | Pas de modification du Core Graph Engine |
| Comportements Interdits | ✅ | Pas d'hypothèses silencieuses, incertitude explicite |

## Project Structure

### Documentation (this feature)

```text
.cursor/spec-kit/specs/6-php-link-definition-target/
├── spec.md          # Spécification fonctionnelle
├── plan.md          # Ce fichier
├── research.md      # Recherche technique
├── data-model.md    # Modèle de données
└── tasks.md         # Liste de tâches (généré par /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── composer.ts      # NOUVEAU: ComposerResolver pour PSR-4
│   ├── resolver.ts      # MODIFIÉ: Intégration ComposerResolver
│   ├── analyzer.ts      # MODIFIÉ: Utilisation LSP pour PHP use statements
│   └── lsp/
│       └── php.ts       # MODIFIÉ: Correction getDefinitionFromImport
├── parser/
│   └── php.ts           # Inchangé (extraction déjà correcte)
└── types/
    └── index.ts         # MODIFIÉ: Nouveaux types ComposerConfig

tests/
├── unit/
│   └── composer.test.ts # NOUVEAU: Tests ComposerResolver
└── fixtures/
    └── php-psr4/        # NOUVEAU: Fixtures projet PSR-4
```

**Structure Decision**: Projet unique (CLI tool). Les modifications sont concentrées dans `src/core/` avec un nouveau fichier `composer.ts` et des modifications aux fichiers existants.

## Implementation Approach

### Phase 1: ComposerResolver

Créer un nouveau module `src/core/composer.ts` qui:
1. Parse `composer.json` pour extraire les mappings PSR-4
2. Résout les namespaces PHP vers des chemins de fichiers
3. Gère le cache des mappings

### Phase 2: Intégration PathResolver

Modifier `src/core/resolver.ts` pour:
1. Détecter les namespaces PHP (contient `\`)
2. Utiliser `ComposerResolver` pour résoudre les namespaces PSR-4
3. Classifier correctement les imports vendor comme "third-party"

### Phase 3: Correction LSP PHP

Modifier `src/core/lsp/php.ts` pour:
1. Corriger `getDefinitionFromImport` pour ne pas chercher dans le fichier source
2. Utiliser le namespace résolu pour trouver la définition dans le fichier cible
3. Retourner la ligne de définition de la classe, pas du `use` statement

### Phase 4: Tests et Validation

1. Créer des fixtures PHP avec structure PSR-4
2. Ajouter des tests unitaires pour `ComposerResolver`
3. Valider sur un projet Symfony réel

## Complexity Tracking

Aucune violation de la constitution identifiée. L'implémentation suit les principes établis.
