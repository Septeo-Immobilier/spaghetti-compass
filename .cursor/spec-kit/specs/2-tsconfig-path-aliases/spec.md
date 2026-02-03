# Feature Specification: Résolution des alias de chemin TypeScript

**Feature Branch**: `2-tsconfig-path-aliases`  
**Created**: 2026-02-02  
**Status**: Draft  
**Input**: User description: "Le programme ne résout pas bien les alias @ des imports TypeScript. Les imports utilisant @/ (définis dans tsconfig.json paths) sont classés comme 'unresolved' au lieu d'être résolus vers leurs fichiers cibles."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Analyse de projet NestJS avec alias @/ (Priority: P1)

Un développeur utilise `spaghetti-compass explore` sur un fichier NestJS qui utilise des imports avec l'alias `@/` (ex: `@/core/logger/logger.service`). Le système doit résoudre ces imports vers les fichiers réels du projet en lisant la configuration `paths` du `tsconfig.json`.

**Why this priority**: C'est le cas d'usage principal. Sans cette fonctionnalité, l'outil est inutilisable sur la majorité des projets TypeScript modernes qui utilisent des alias pour éviter les chemins relatifs profonds (`../../../`).

**Independent Test**: Peut être testé en exécutant `spaghetti-compass explore` sur un fichier utilisant des alias et en vérifiant que les imports sont classés comme "internal" plutôt que "unresolved".

**Acceptance Scenarios**:

1. **Given** un projet avec `tsconfig.json` contenant `"paths": { "@/*": ["src/*"] }`, **When** l'utilisateur analyse un fichier avec `import { X } from '@/core/service'`, **Then** l'import est résolu vers `src/core/service.ts` et classé comme "internal"

2. **Given** un projet avec alias configuré, **When** le fichier cible existe, **Then** la sortie affiche le fichier sous "IMPORTS (internal)" et non sous "DYNAMIC IMPORTS (unresolved)"

3. **Given** un projet avec alias configuré, **When** le fichier cible n'existe pas, **Then** l'import reste "unresolved" avec un message d'erreur explicite

---

### User Story 2 - Support des alias multiples et patterns complexes (Priority: P2)

Un développeur utilise un projet avec plusieurs alias configurés (ex: `@core/*`, `@modules/*`, `@shared/*`). Le système doit supporter tous les patterns de paths définis dans le tsconfig.

**Why this priority**: Les projets d'entreprise utilisent souvent plusieurs alias pour organiser leur code. Sans ce support, l'outil serait limité aux configurations simples.

**Independent Test**: Peut être testé avec un tsconfig contenant 3+ alias différents et en vérifiant que chacun est correctement résolu.

**Acceptance Scenarios**:

1. **Given** un tsconfig avec `"paths": { "@core/*": ["src/core/*"], "@modules/*": ["src/modules/*"] }`, **When** l'utilisateur analyse un fichier important des deux alias, **Then** tous les imports sont résolus correctement

2. **Given** un tsconfig avec un alias vers plusieurs cibles `"@utils/*": ["src/utils/*", "shared/utils/*"]`, **When** le premier chemin ne contient pas le fichier, **Then** le système essaie le second chemin

---

### User Story 3 - Découverte automatique du tsconfig (Priority: P2)

Le système doit automatiquement trouver et lire le `tsconfig.json` du projet sans configuration explicite de l'utilisateur.

**Why this priority**: L'expérience utilisateur doit être fluide. Demander à l'utilisateur de spécifier le chemin du tsconfig serait fastidieux.

**Independent Test**: Peut être testé en exécutant la commande depuis différents sous-répertoires et en vérifiant que le tsconfig racine est trouvé.

**Acceptance Scenarios**:

1. **Given** un projet avec `tsconfig.json` à la racine, **When** l'utilisateur exécute la commande depuis n'importe quel sous-répertoire, **Then** le tsconfig est automatiquement découvert et utilisé

2. **Given** un projet avec `tsconfig.json` et `tsconfig.build.json`, **When** aucune option n'est spécifiée, **Then** le `tsconfig.json` principal est utilisé par défaut

3. **Given** un projet sans tsconfig, **When** l'utilisateur analyse un fichier, **Then** le système fonctionne normalement sans alias resolution (comportement actuel)

---

### User Story 4 - Configuration explicite du tsconfig (Priority: P3)

L'utilisateur peut spécifier un tsconfig personnalisé via une option CLI pour les projets avec des configurations multiples.

**Why this priority**: Cas d'usage avancé pour les monorepos ou projets avec plusieurs configurations TypeScript.

**Independent Test**: Peut être testé en passant l'option `--tsconfig` et en vérifiant que ce fichier est utilisé.

**Acceptance Scenarios**:

1. **Given** un projet avec plusieurs tsconfigs, **When** l'utilisateur exécute `spaghetti-compass explore file.ts --tsconfig ./tsconfig.app.json`, **Then** les paths de ce tsconfig spécifique sont utilisés

---

### Edge Cases

- Que se passe-t-il quand le `tsconfig.json` est invalide (JSON malformé) ?  
  → Le système doit afficher un warning et continuer sans résolution d'alias

- Que se passe-t-il quand un alias pointe vers un fichier hors du contexte d'analyse ?  
  → L'import doit être classé comme "external" plutôt que "internal"

- Comment gérer les `extends` dans tsconfig (ex: `"extends": "./tsconfig.base.json"`) ?  
  → Le système doit résoudre récursivement les configurations héritées pour récupérer tous les paths

- Que se passe-t-il si `baseUrl` est défini sans `paths` ?  
  → Le système doit supporter la résolution via `baseUrl` seul (imports non-relatifs résolus depuis baseUrl)

- Comment gérer les monorepos avec plusieurs `package.json` ?  
  → Utiliser le `package.json` le plus proche du fichier analysé. Un import vers un autre package du monorepo sera classé "external".

- Que se passe-t-il si aucun `package.json` n'est trouvé ?  
  → Fallback sur le dossier contenant le `tsconfig.json`, ou le dossier courant en dernier recours

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le système DOIT déterminer la racine du projet en remontant jusqu'au `package.json` le plus proche
- **FR-002**: Le système DOIT lire automatiquement le fichier `tsconfig.json` du projet lors de l'analyse
- **FR-003**: Le système DOIT parser la propriété `compilerOptions.paths` pour extraire les mappings d'alias
- **FR-004**: Le système DOIT parser la propriété `compilerOptions.baseUrl` pour la résolution de base
- **FR-005**: Le système DOIT résoudre les imports utilisant des alias vers leurs chemins réels sur le système de fichiers
- **FR-006**: Le système DOIT classifier les imports résolus selon leur emplacement par rapport au `package.json` racine :
  - `internal` : fichier dans le même package (sous le dossier du package.json)
  - `external` : fichier hors du package mais dans le projet
  - `third-party` : package npm (dans node_modules)
- **FR-007**: Le système DOIT supporter les patterns avec wildcard (ex: `@/*` → `src/*`)
- **FR-008**: Le système DOIT supporter les mappings multiples pour un même alias (fallback)
- **FR-009**: Le système DOIT supporter l'héritage de tsconfig via la propriété `extends`
- **FR-010**: Le système DOIT permettre la spécification d'un tsconfig personnalisé via l'option CLI `--tsconfig`
- **FR-011**: Le système DOIT permettre l'override de la racine projet via l'option CLI `--root`
- **FR-012**: Le système DOIT continuer à fonctionner si aucun tsconfig n'est trouvé (dégradation gracieuse)
- **FR-013**: Le système DOIT afficher un warning explicite si un alias ne peut pas être résolu

### Key Entities

- **TsConfig**: Représente la configuration TypeScript parsée, contenant baseUrl, paths, et extends
- **PathMapping**: Représente un mapping alias → chemin(s) cible(s), avec support des wildcards
- **ResolvedImport**: Représente un import résolu avec son chemin source, son alias original, et son chemin résolu

## Clarifications

### Session 2026-02-02

- Q: Comment déterminer la racine du projet pour classifier internal/external ? → A: Remonter jusqu'au `package.json` le plus proche (convention npm standard)
- Q: Dans un monorepo avec plusieurs package.json imbriqués, lequel utiliser ? → A: Le `package.json` le plus proche du fichier analysé (chaque package est une unité autonome)

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% des imports utilisant des alias définis dans tsconfig.json sont résolus vers leurs fichiers cibles (quand le fichier existe)
- **SC-002**: L'utilisateur peut analyser un projet NestJS standard (avec alias `@/`) sans configuration supplémentaire
- **SC-003**: Le temps d'analyse n'augmente pas de plus de 10% par rapport à la version sans résolution d'alias
- **SC-004**: Zéro faux positifs : les packages npm scoped (ex: `@nestjs/common`) ne sont jamais confondus avec des alias projet
