# Data Model: PHP Links Target Definition

## Entities

### ComposerConfig

Configuration d'autoloading extraite de `composer.json`.

```typescript
interface ComposerConfig {
  /** Chemin absolu vers composer.json */
  configPath: string;
  
  /** Mappings PSR-4: namespace prefix → base directory */
  psr4Mappings: Map<string, string>;
  
  /** Mappings PSR-0 (legacy, optionnel) */
  psr0Mappings?: Map<string, string>;
  
  /** Chemin du répertoire vendor */
  vendorDir: string;
}
```

### Psr4Mapping

Un mapping individuel PSR-4.

```typescript
interface Psr4Mapping {
  /** Préfixe de namespace (ex: "App\\") */
  prefix: string;
  
  /** Répertoire de base relatif à composer.json (ex: "src/") */
  baseDir: string;
  
  /** Chemin absolu résolu */
  absoluteBaseDir: string;
}
```

### PhpNamespaceResolution

Résultat de la résolution d'un namespace PHP.

```typescript
interface PhpNamespaceResolution {
  /** Namespace complet (ex: "App\\Models\\User") */
  namespace: string;
  
  /** Chemin du fichier résolu (ou null si non résolu) */
  filePath: string | null;
  
  /** Méthode de résolution utilisée */
  resolvedVia: 'composer-psr4' | 'lsp' | 'unresolved';
  
  /** Classification de la location */
  location: 'internal' | 'third-party' | 'unresolved';
  
  /** Mapping PSR-4 utilisé (si applicable) */
  matchedMapping?: Psr4Mapping;
}
```

## Modifications aux Entités Existantes

### ImportInfo (existant)

Pas de modification structurelle, mais clarification du comportement:

```typescript
interface ImportInfo {
  moduleSpecifier: string;  // Pour PHP use: "App\\Models\\User"
  type: 'import-static' | 'require' | ...;
  line: number;
  resolved: boolean;        // true si le fichier cible est trouvé
  importedNames: string[];  // ["User"] ou ["UserModel"] si alias
}
```

### GraphEdge (existant)

Ajout d'informations de résolution:

```typescript
interface GraphEdge {
  // ... champs existants ...
  
  /** Ligne de définition dans le fichier cible (NOUVEAU comportement) */
  targetLine?: number;
  
  /** Méthode de résolution utilisée (optionnel, pour debugging) */
  resolvedVia?: 'composer-psr4' | 'lsp' | 'require-path';
}
```

## Relations

```
ComposerConfig 1 ──────< * Psr4Mapping
     │
     │ utilisé par
     ▼
PathResolver ──────> PhpNamespaceResolution
     │
     │ produit
     ▼
GraphEdge (avec targetLine correct)
```

## Validation Rules

### ComposerConfig
- `configPath` DOIT exister et être un fichier JSON valide
- `psr4Mappings` PEUT être vide (projet sans autoload)
- `vendorDir` DOIT être un chemin valide (défaut: `vendor/`)

### Psr4Mapping
- `prefix` DOIT se terminer par `\\` (convention Composer)
- `baseDir` DOIT être un chemin relatif valide
- `absoluteBaseDir` DOIT exister sur le filesystem

### PhpNamespaceResolution
- Si `resolvedVia === 'unresolved'`, alors `filePath` DOIT être `null`
- Si `location === 'third-party'`, alors `filePath` DOIT contenir `vendor/`
