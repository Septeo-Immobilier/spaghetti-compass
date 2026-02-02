# Implementation Plan: TSConfig Path Aliases

**Branch**: `2-tsconfig-path-aliases` | **Date**: 2026-02-02 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `.cursor/spec-kit/specs/2-tsconfig-path-aliases/spec.md`

## Summary

Ajouter la résolution des alias de chemin TypeScript (`@/*`, `@core/*`, etc.) définis dans `tsconfig.json` pour que les imports utilisant ces alias soient correctement résolus et classifiés comme "internal" plutôt que "unresolved".

**Approche technique**: Utiliser l'API native TypeScript (`ts.readConfigFile` + `ts.parseJsonConfigFileContent`) pour parser le tsconfig avec support de `extends`, puis intégrer la résolution dans le `PathResolver` existant.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 18+  
**Primary Dependencies**: typescript (déjà présent), node:fs, node:path  
**Storage**: N/A (fichiers uniquement)  
**Testing**: Vitest (tests unitaires + intégration)  
**Target Platform**: CLI Node.js (Linux, macOS, Windows)  
**Project Type**: single (CLI tool)  
**Performance Goals**: < 10% overhead vs version actuelle  
**Constraints**: Doit fonctionner offline, pas de dépendances réseau  
**Scale/Scope**: Projets TypeScript de 1-10k fichiers

## Constitution Check

*GATE: Vérifié ✅*

| Principe | Statut | Notes |
|----------|--------|-------|
| LSP-First | ✅ | N/A - Cette feature est pré-LSP (parsing de config) |
| Architecture Modulaire | ✅ | Nouveau module `TsConfigResolver` isolé |
| Best-Effort Resolution | ✅ | Alias non résolus signalés explicitement |
| Performance & Cache | ✅ | Cache du tsconfig parsé |

**Aucune violation** - Le plan est conforme à la constitution.

## Project Structure

### Documentation (this feature)

```text
.cursor/spec-kit/specs/2-tsconfig-path-aliases/
├── spec.md          # Spécification fonctionnelle
├── plan.md          # Ce fichier
├── research.md      # Décisions techniques
├── data-model.md    # Modèle de données
├── quickstart.md    # Scénarios d'usage
├── contracts/
│   └── cli-interface.md  # Contrat CLI
└── checklists/
    └── requirements.md   # Validation
```

### Source Code (repository root)

```text
src/
├── cli/
│   └── index.ts           # MODIFY: Ajouter options --tsconfig, --root
├── core/
│   ├── analyzer.ts        # MODIFY: Passer tsconfig au resolver
│   ├── resolver.ts        # MODIFY: Intégrer TsConfigResolver
│   └── tsconfig.ts        # NEW: TsConfigResolver class
├── types/
│   └── index.ts           # MODIFY: Ajouter TsConfigInfo, etc.
└── output/
    ├── text.ts            # MODIFY: Afficher alias info
    └── json.ts            # MODIFY: Inclure aliasInfo

tests/
├── unit/
│   └── tsconfig.test.ts   # NEW: Tests TsConfigResolver
├── integration/
│   └── path-aliases.test.ts  # NEW: Tests E2E
└── fixtures/
    └── tsconfig-project/  # NEW: Projet test avec alias
```

**Structure Decision**: Single project (CLI tool) - utiliser la structure existante `src/`.

## Implementation Phases

### Phase 1: Core - TsConfigResolver

1. Créer `src/core/tsconfig.ts` avec:
   - `findTsConfig(fromFile: string): string | null`
   - `findPackageJson(fromFile: string): string | null`
   - `loadTsConfig(configPath: string): TsConfigInfo | null`
   - `class TsConfigResolver` avec pattern matching

2. Ajouter types dans `src/types/index.ts`

### Phase 2: Integration - PathResolver

1. Modifier `PathResolver.resolve()` pour:
   - Vérifier d'abord si le specifier matche un alias
   - Résoudre via tsconfig paths avant de traiter comme npm package
   - Retourner le chemin résolu ou null

2. Modifier `PathResolver.isNpmPackage()` pour:
   - Exclure les patterns qui matchent un alias projet

### Phase 3: CLI - Options

1. Ajouter options dans `src/cli/index.ts`:
   - `--tsconfig <path>` / `-t`
   - `--root <path>` / `-r`
   - `--no-tsconfig`

2. Passer la config à l'Analyzer

### Phase 4: Output - Affichage

1. Modifier `src/output/text.ts`:
   - Afficher l'alias original entre parenthèses
   - Améliorer les messages d'erreur pour alias non résolus

2. Modifier `src/output/json.ts`:
   - Ajouter `aliasInfo` aux edges
   - Ajouter `aliasResolutions` aux stats

### Phase 5: Tests

1. Tests unitaires pour `TsConfigResolver`
2. Tests d'intégration avec fixture project
3. Tests de régression (ne pas casser le comportement existant)

## Complexity Tracking

> Aucune violation de la constitution - section vide.

## Dependencies

| Dépendance | Version | Raison |
|------------|---------|--------|
| typescript | ^5.0.0 | Déjà présent, utilisé pour l'API de parsing |

**Aucune nouvelle dépendance requise.**

## Risks & Mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Performance avec gros tsconfig | Moyen | Cache agressif du parsing |
| Conflits alias/npm packages | Faible | Priorité aux alias tsconfig |
| Chemins Windows vs Unix | Moyen | Utiliser `path.resolve()` partout |

## Next Steps

Exécuter `/speckit.tasks` pour générer les tâches d'implémentation détaillées.
