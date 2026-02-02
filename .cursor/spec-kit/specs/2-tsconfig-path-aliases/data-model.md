# Data Model: TSConfig Path Aliases

**Feature**: 2-tsconfig-path-aliases  
**Date**: 2026-02-02

## Entities

### TsConfigInfo

Représente la configuration TypeScript parsée, extraite du tsconfig.json.

```typescript
interface TsConfigInfo {
  /** Chemin absolu du tsconfig.json */
  configPath: string;
  
  /** Répertoire de base pour la résolution (baseUrl résolu en absolu) */
  baseUrl: string | null;
  
  /** Mappings de paths (patterns → chemins cibles) */
  paths: PathMapping[];
  
  /** Chemin du tsconfig parent si extends est utilisé */
  extendsFrom: string | null;
}
```

### PathMapping

Représente un mapping alias → chemin(s) cible(s).

```typescript
interface PathMapping {
  /** Pattern de l'alias (ex: "@/*", "@core/*") */
  pattern: string;
  
  /** Regex compilée pour le matching */
  regex: RegExp;
  
  /** Chemins cibles (en ordre de priorité) */
  targets: string[];
  
  /** true si le pattern contient un wildcard */
  hasWildcard: boolean;
}
```

### ProjectContext (extension de ContextInfo existant)

Étend le contexte d'analyse avec les informations de projet.

```typescript
interface ProjectContext extends ContextInfo {
  /** Chemin absolu du package.json racine */
  packageJsonPath: string | null;
  
  /** Chemin absolu du dossier racine du projet */
  projectRoot: string;
  
  /** Configuration TypeScript (si trouvée) */
  tsConfig: TsConfigInfo | null;
}
```

### ResolvedAlias

Représente le résultat de la résolution d'un alias.

```typescript
interface ResolvedAlias {
  /** Import original (ex: "@/core/service") */
  original: string;
  
  /** Chemin résolu absolu (ex: "/project/src/core/service.ts") */
  resolved: string | null;
  
  /** Pattern qui a matché (ex: "@/*") */
  matchedPattern: string | null;
  
  /** Raison si non résolu */
  error: string | null;
}
```

## Relations

```
┌─────────────────┐     ┌──────────────┐
│ ProjectContext  │────►│ TsConfigInfo │
└─────────────────┘     └──────────────┘
                              │
                              │ 1:N
                              ▼
                        ┌─────────────┐
                        │ PathMapping │
                        └─────────────┘
```

## State Transitions

### TsConfigInfo Loading

```
                    ┌─────────────┐
                    │   START     │
                    └──────┬──────┘
                           │
                           ▼
                ┌──────────────────────┐
                │ Find tsconfig.json   │
                │ (from file or --tsconfig)
                └──────────┬───────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
      ┌───────────────┐        ┌───────────────┐
      │ Found         │        │ Not Found     │
      └───────┬───────┘        └───────┬───────┘
              │                        │
              ▼                        ▼
      ┌───────────────┐        ┌───────────────┐
      │ Parse JSON    │        │ Graceful      │
      └───────┬───────┘        │ Degradation   │
              │                └───────────────┘
              ▼
      ┌───────────────┐
      │ Resolve extends│
      └───────┬───────┘
              │
              ▼
      ┌───────────────┐
      │ Extract paths │
      └───────┬───────┘
              │
              ▼
      ┌───────────────┐
      │ Compile regex │
      └───────┬───────┘
              │
              ▼
      ┌───────────────┐
      │ READY         │
      └───────────────┘
```

## Validation Rules

### PathMapping

| Field | Rule |
|-------|------|
| pattern | Doit être une string non-vide |
| pattern | Maximum un `*` wildcard |
| targets | Au moins un chemin cible |
| targets | Chemins relatifs au baseUrl ou absolus |

### TsConfigInfo

| Field | Rule |
|-------|------|
| configPath | Fichier doit exister |
| baseUrl | Si null, les paths doivent être relatifs (`./`) |
| paths | Peut être vide (pas d'alias) |

## Data Volume Estimates

| Entity | Typical Count | Max Expected |
|--------|--------------|--------------|
| TsConfigInfo | 1 par analyse | 5 (extends chain) |
| PathMapping | 3-5 par projet | 50 |
| ResolvedAlias | 1 par import | 1000 par fichier |

## Indexes / Cache Strategy

```typescript
// Cache clé → valeur
TsConfigCache: Map<configPath, TsConfigInfo>
PathResolutionCache: Map<`${fromFile}:${specifier}`, ResolvedAlias>
PackageJsonCache: Map<directory, packageJsonPath | null>
```

## Integration with Existing Types

Les nouveaux types s'intègrent dans le système existant :

```typescript
// types/index.ts - Extensions
export interface ContextInfo {
  rootPath: string;
  relativeTo?: string;
  includePatterns: string[];
  excludePatterns: string[];
  // NEW
  projectRoot?: string;
  tsConfigPath?: string;
}
```

```typescript
// core/resolver.ts - Extension
export class PathResolver {
  private tsConfigResolver?: TsConfigResolver; // NEW
  
  constructor(context: ContextInfo) {
    // ... existing
    if (context.tsConfigPath) {
      this.tsConfigResolver = new TsConfigResolver(context.tsConfigPath);
    }
  }
}
```
