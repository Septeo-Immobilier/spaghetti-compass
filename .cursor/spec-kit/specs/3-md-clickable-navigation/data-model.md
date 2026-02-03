# Data Model: Clickable Navigation

**Feature**: `3-md-clickable-navigation`  
**Date**: 2026-02-02

## Entités

### FileReference (existant à enrichir)

Représente une référence à un fichier dans l'output.

```typescript
interface FileReference {
  /** Chemin absolu du fichier */
  absolutePath: string;
  /** Chemin relatif depuis le cwd */
  relativePath: string;
  /** Numéro de ligne (1-indexed) */
  line?: number;
  /** Numéro de colonne (1-indexed) */
  column?: number;
  /** true si le fichier est dans node_modules ou hors projet */
  isExternal: boolean;
  /** Informations sur le package si externe */
  packageInfo?: PackageInfo;
}
```

### PackageInfo (nouveau)

Informations sur un package externe.

```typescript
interface PackageInfo {
  /** Nom du package (ex: "lodash", "@nestjs/core") */
  name: string;
  /** Version du package */
  version: string;
  /** Chemin relatif dans le package */
  internalPath: string;
}
```

### ClickableLink (nouveau)

Format de sortie pour un lien cliquable.

```typescript
interface ClickableLink {
  /** Texte affiché */
  displayText: string;
  /** Chemin complet pour le lien (format chemin:ligne:colonne) */
  linkPath: string;
  /** true si le lien devrait être cliquable */
  isClickable: boolean;
}
```

## Options CLI (extensions)

### Nouvelles options

```typescript
interface MarkdownFormatOptions {
  /** Utiliser des chemins absolus au lieu de relatifs */
  absolutePaths?: boolean;
  /** Désactiver les liens cliquables */
  noLinks?: boolean;
}
```

### Mapping CLI → Options

| Option CLI | Propriété | Default |
|------------|-----------|---------|
| `--absolute-paths` | `absolutePaths` | `false` |
| `--no-links` | `noLinks` | `false` |

## Relations avec les types existants

### GraphNode (existant)

```typescript
interface GraphNode {
  id: string;           // Utilisé pour construire le chemin
  type: NodeType;       // 'file' | 'function' | 'class' | 'external-module'
  name: string;         // Nom court affiché
  path?: string;        // Chemin relatif au contexte
  location: NodeLocation; // 'internal' | 'external' | 'third-party'
}
```

**Utilisation** :
- `location === 'third-party'` → Fichier externe, utiliser PackageInfo
- `location === 'internal'` → Fichier projet, chemin relatif simple
- `location === 'external'` → Fichier hors contexte mais dans le projet

### GraphEdge (existant)

```typescript
interface GraphEdge {
  from: string;
  to: string;
  type: EdgeType;
  resolved: boolean;
  line?: number;        // ← Utilisé pour la navigation
  importedNames?: string[];
  aliasInfo?: AliasInfo;
}
```

**Utilisation** :
- `line` → Numéro de ligne pour le lien cliquable
- `aliasInfo` → Afficher l'alias original si disponible

### ContextInfo (existant)

```typescript
interface ContextInfo {
  rootPath: string;
  relativeTo?: string;
  includePatterns: string[];
  excludePatterns: string[];
  projectRoot?: string;  // ← Utilisé pour délimiter le projet
  tsConfigPath?: string;
}
```

**Utilisation** :
- `projectRoot` → Racine pour distinguer interne/externe
- `rootPath` → Base pour les chemins relatifs

## Flux de données

```
GraphNode/GraphEdge
       ↓
  FileReference (enrichissement)
       ↓
  ClickableLink (formatage)
       ↓
  Output string (chemin:ligne:colonne)
```
