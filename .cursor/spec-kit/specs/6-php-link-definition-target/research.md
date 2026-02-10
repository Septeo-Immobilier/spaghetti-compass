# Research: PHP Links Target Definition Instead of Usage

## Research Questions Investigated

### 1. Comment résoudre les namespaces PSR-4 vers des chemins de fichiers ?

**Decision**: Utiliser une approche hybride - Composer PSR-4 resolver + fallback LSP

**Rationale**: 
- PSR-4 est un standard bien défini avec un algorithme de résolution clair
- Le parsing de `composer.json` est fiable et rapide
- Le LSP (Intelephense) peut servir de fallback pour les cas complexes
- Cette approche est cohérente avec le principe "LSP-First" de la constitution tout en ajoutant une couche de résolution rapide

**Alternatives considered**:
- LSP-only: Plus lent, nécessite que Intelephense soit disponible
- Composer-only: Ne gère pas les cas edge (vendor, autoload optimisé)

### 2. Pourquoi le LSP retourne la ligne d'utilisation au lieu de la définition ?

**Decision**: Modifier `getDefinitionFromImport` pour ne pas chercher dans le fichier source

**Rationale**:
- Le problème actuel est que `getDefinitionByName` cherche le symbole dans le fichier source
- Quand il trouve le `use` statement, Intelephense retourne cette position
- La solution est de résoudre d'abord le namespace vers un fichier, puis chercher la définition dans ce fichier

**Root Cause Identified**:
```typescript
// Actuel (bugué)
getDefinitionFromImport(sourceFilePath, symbolName, _moduleSpecifier) {
  return this.getDefinitionByName(sourceFilePath, symbolName); // Cherche dans le mauvais fichier!
}
```

### 3. Pourquoi les fixtures fonctionnent mais pas les projets réels ?

**Decision**: Ajouter le support PSR-4 au `PathResolver`

**Rationale**:
- Les fixtures utilisent `require_once __DIR__ . '/path'` → résolu par `isPhpRelativePath()`
- Les projets réels utilisent `use App\Models\User;` → non résolu actuellement
- `PathResolver.resolve()` ne gère pas les namespaces PHP

**Flow actuel (bugué)**:
1. Parser extrait `use App\Models\User;` avec `moduleSpecifier: "App\\Models\\User"`
2. `PathResolver.resolve("App\\Models\\User")` retourne `null` (pas de résolution)
3. `processImport` crée un edge avec `resolved: false`
4. L'import apparaît comme "DYNAMIC IMPORTS (unresolved)"

## Technical Decisions

### Algorithme PSR-4 Resolution

```typescript
function resolvePsr4Namespace(namespace: string, psr4Mappings: Map<string, string>): string | null {
  // 1. Normaliser le namespace (enlever \ initial)
  const className = namespace.replace(/^\\+/, '');
  
  // 2. Trier les mappings par longueur de préfixe (plus long d'abord)
  const sortedMappings = Array.from(psr4Mappings.entries())
    .sort((a, b) => b[0].length - a[0].length);
  
  // 3. Trouver le préfixe le plus long qui match
  for (const [prefix, baseDir] of sortedMappings) {
    const normalizedPrefix = prefix.replace(/\\+$/, '');
    
    if (className.startsWith(normalizedPrefix + '\\') || normalizedPrefix === '') {
      // 4. Enlever le préfixe
      const relativePath = className.slice(normalizedPrefix.length)
        .replace(/^\\+/, '')
        .replace(/\\/g, '/');
      
      // 5. Construire le chemin
      return path.join(baseDir, relativePath + '.php');
    }
  }
  
  return null;
}
```

### Architecture des Changements

```
src/core/
├── resolver.ts          # Ajouter isPhpNamespace() et resolvePhpNamespace()
├── composer.ts          # NOUVEAU: ComposerResolver pour parser composer.json
└── lsp/
    └── php.ts           # Corriger getDefinitionFromImport()
```

## Edge Cases Identifiés

| Edge Case | Solution |
|-----------|----------|
| Pas de `composer.json` | Fallback sur LSP, marquer comme "unresolved" si échec |
| Namespace avec alias (`use X as Y`) | Déjà supporté par le parser |
| Classes vendor (`Symfony\...`) | Classifier comme "third-party" via path contenant `vendor/` |
| Plusieurs mappings PSR-4 | Utiliser le préfixe le plus long (longest-match) |
| Traits (`use MyTrait` dans une classe) | Distinguer par contexte (dans classe vs top-level) |

## Performance Considerations

- **Cache des mappings Composer**: Parser `composer.json` une seule fois par projet
- **Cache des résolutions**: Réutiliser le cache existant de `PathResolver`
- **LSP lazy loading**: Ne démarrer Intelephense que si nécessaire

## Conformité Constitution

| Principe | Conformité |
|----------|------------|
| LSP-First | ✅ LSP utilisé en fallback |
| Architecture Modulaire | ✅ Nouveau `ComposerResolver` isolé |
| Résolution Best-Effort | ✅ Fallback gracieux si résolution échoue |
| Extensibilité | ✅ Pas de modification du Core Graph Engine |
