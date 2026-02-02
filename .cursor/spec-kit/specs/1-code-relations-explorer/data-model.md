# Data Model - Code Relations Explorer

**Date**: 2026-02-02  
**Feature**: 1-code-relations-explorer

## Core Entities

### GraphNode

Représente un élément analysable dans le graphe de dépendances.

| Attribut | Type | Description |
|----------|------|-------------|
| `id` | string | Identifiant unique (chemin absolu pour fichiers, `file:function` pour fonctions) |
| `type` | enum | `'file'` \| `'function'` \| `'class'` \| `'external-module'` |
| `name` | string | Nom court affiché (nom de fichier ou de fonction) |
| `path` | string? | Chemin relatif au contexte (null pour external-module) |
| `location` | enum | `'internal'` \| `'external'` \| `'third-party'` |

**Règles de validation** :
- `id` doit être unique dans le graphe
- `path` est requis si `location` n'est pas `'third-party'`
- `location` = `'internal'` si le fichier est dans le contexte défini
- `location` = `'external'` si le fichier est hors contexte mais dans le projet
- `location` = `'third-party'` pour les packages npm/node_modules

### GraphEdge

Représente une relation entre deux noeuds.

| Attribut | Type | Description |
|----------|------|-------------|
| `from` | string | ID du noeud source |
| `to` | string | ID du noeud cible |
| `type` | enum | Type de relation (voir ci-dessous) |
| `resolved` | boolean | `true` si la cible est résolue, `false` pour les imports dynamiques |
| `line` | number? | Numéro de ligne de l'import/appel dans le fichier source |
| `importedNames` | string[]? | Noms importés pour les imports nommés |

**Types de relations** :
- `'import-static'` : Import ES6 statique (`import x from 'y'`)
- `'import-dynamic'` : Import dynamique (`import('x')`) - toujours `resolved: false`
- `'require'` : CommonJS require
- `'export'` : Export depuis un fichier
- `'re-export'` : Re-export (`export { x } from 'y'`)
- `'call'` : Appel de fonction (niveau fonction uniquement)

**Règles de validation** :
- `from` et `to` doivent référencer des `GraphNode.id` existants
- Si `type` = `'import-dynamic'`, alors `resolved` DOIT être `false`

### DependencyGraph

Structure racine contenant le graphe complet.

| Attribut | Type | Description |
|----------|------|-------------|
| `version` | string | Version du format de sortie (semver) |
| `generatedAt` | string | Timestamp ISO 8601 |
| `context` | ContextInfo | Informations sur le contexte d'analyse |
| `entryPoint` | string | ID du noeud point de départ |
| `nodes` | GraphNode[] | Liste des noeuds |
| `edges` | GraphEdge[] | Liste des arêtes |
| `stats` | GraphStats | Statistiques du graphe |

### ContextInfo

Métadonnées sur le contexte d'analyse.

| Attribut | Type | Description |
|----------|------|-------------|
| `rootPath` | string | Chemin absolu du dossier contexte |
| `relativeTo` | string? | Chemin de référence pour les chemins relatifs |
| `includePatterns` | string[] | Globs des fichiers inclus |
| `excludePatterns` | string[] | Globs des fichiers exclus |

### GraphStats

Statistiques agrégées du graphe.

| Attribut | Type | Description |
|----------|------|-------------|
| `totalNodes` | number | Nombre total de noeuds |
| `totalEdges` | number | Nombre total d'arêtes |
| `internalNodes` | number | Noeuds internes au contexte |
| `externalNodes` | number | Noeuds externes au contexte |
| `thirdPartyNodes` | number | Noeuds packages tiers |
| `unresolvedEdges` | number | Arêtes non résolues (imports dynamiques) |
| `circularDependencies` | string[][] | Liste des cycles détectés |

## Entity Relationships

```
┌─────────────────┐
│ DependencyGraph │
└────────┬────────┘
         │ contains
         ▼
┌─────────────────┐      ┌─────────────┐
│   GraphNode[]   │◄────►│ GraphEdge[] │
└─────────────────┘      └─────────────┘
         │                     │
         │ classified by       │ connects
         ▼                     ▼
┌─────────────────┐      ┌─────────────┐
│   ContextInfo   │      │  GraphNode  │
└─────────────────┘      └─────────────┘
```

## State Transitions

### GraphNode.location

La classification `location` d'un noeud dépend du contexte :

```
                    ┌──────────────────────────────────────┐
                    │           Fichier détecté             │
                    └──────────────────┬───────────────────┘
                                       │
                    ┌──────────────────▼───────────────────┐
                    │      Dans node_modules ?              │
                    └──────────┬───────────────┬───────────┘
                               │ oui           │ non
                    ┌──────────▼──────┐ ┌──────▼───────────┐
                    │  third-party    │ │ Dans contexte ?   │
                    └─────────────────┘ └──────┬───────┬────┘
                                               │ oui   │ non
                                    ┌──────────▼────┐ ┌▼────────────┐
                                    │   internal    │ │  external   │
                                    └───────────────┘ └─────────────┘
```

## Volume Assumptions

| Métrique | Valeur cible | Notes |
|----------|--------------|-------|
| Fichiers dans contexte | 1-1000 | SC-004 : pas de dégradation notable |
| Profondeur transitive max | illimitée | FR-011 : graphe complet |
| Edges par fichier | 1-50 (typique) | Imports + exports |
| Cycles détectés | 0-10 (typique) | Signalés mais non bloquants |
