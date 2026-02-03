# Research: TSConfig Path Aliases Resolution

**Feature**: 2-tsconfig-path-aliases  
**Date**: 2026-02-02

## Research Questions

### 1. Comment parser tsconfig.json avec support de `extends` ?

**Decision**: Utiliser l'API native TypeScript `ts.readConfigFile` + `ts.parseJsonConfigFileContent`

**Rationale**:
- L'API TypeScript gère nativement l'héritage via `extends`
- Résolution automatique des chemins relatifs dans les configurations héritées
- Support des commentaires JSON (JSONC) que tsconfig autorise
- Validation intégrée des options

**Alternatives considérées**:
| Alternative | Rejetée parce que |
|-------------|-------------------|
| Parser JSON manuel + récursion extends | Complexe, gestion d'erreurs manuelle, pas de support JSONC |
| Librairie tierce (tsconfig-paths) | Dépendance supplémentaire, moins flexible |

**Code pattern**:
```typescript
import ts from 'typescript';

function loadTsConfig(configPath: string): ts.ParsedCommandLine | null {
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) return null;
  
  const basePath = path.dirname(configPath);
  return ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    basePath
  );
}
```

### 2. Comment distinguer un alias projet d'un package npm scoped ?

**Decision**: Vérifier d'abord si le specifier matche un pattern dans `paths`, sinon traiter comme package npm

**Rationale**:
- Les alias projet sont définis explicitement dans tsconfig
- Les packages npm scoped (`@org/pkg`) ne sont jamais dans `paths`
- Ordre de priorité clair et déterministe

**Algorithme**:
```
1. Si moduleSpecifier matche un pattern dans paths → Alias projet
2. Sinon si moduleSpecifier commence par '@' et matche regex npm → Package npm
3. Sinon → Chemin relatif ou bare import
```

### 3. Comment résoudre les wildcards dans paths ?

**Decision**: Implémenter un pattern matching simple avec remplacement de `*`

**Rationale**:
- TypeScript supporte uniquement `*` comme wildcard (pas de globs complexes)
- Un seul `*` par pattern côté clé et côté valeur
- Le `*` capture une partie du chemin et la substitue

**Exemple**:
```
Pattern: "@/*" → ["src/*"]
Import:  "@/core/service"
Capture: "core/service"
Résolu:  "src/core/service"
```

### 4. Comment trouver le package.json le plus proche ?

**Decision**: Remonter l'arborescence depuis le fichier analysé jusqu'à trouver un `package.json`

**Rationale**:
- Convention standard npm/Node.js
- Supporte les monorepos naturellement
- Chaque package est une unité autonome

**Algorithme**:
```typescript
function findPackageJson(fromFile: string): string | null {
  let dir = path.dirname(fromFile);
  while (dir !== path.dirname(dir)) { // Pas la racine
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) return pkgPath;
    dir = path.dirname(dir);
  }
  return null;
}
```

### 5. Performance: faut-il cacher le parsing du tsconfig ?

**Decision**: Oui, cacher le `ParsedCommandLine` par chemin de tsconfig

**Rationale**:
- Le tsconfig est lu une fois par analyse
- Le parsing JSON + résolution extends peut être coûteux
- Le contenu ne change pas pendant une analyse

**Implementation**:
```typescript
class TsConfigCache {
  private cache = new Map<string, ts.ParsedCommandLine | null>();
  
  get(configPath: string): ts.ParsedCommandLine | null {
    if (!this.cache.has(configPath)) {
      this.cache.set(configPath, this.load(configPath));
    }
    return this.cache.get(configPath)!;
  }
}
```

## Deprecation Notes

⚠️ **TypeScript 7.0 Warning**: L'option `baseUrl` sera dépréciée dans TypeScript 7.0. Notre implémentation doit :
1. Supporter `baseUrl` pour la rétrocompatibilité
2. Privilégier les `paths` absolus quand possible
3. Émettre un warning si `baseUrl` est utilisé seul sans `paths`

## References

- [TypeScript Module Resolution](https://www.typescriptlang.org/docs/handbook/module-resolution.html)
- [TypeScript API - parseJsonConfigFileContent](https://github.com/microsoft/typescript/wiki/API-Breaking-Changes)
- [tsconfig.json paths](https://www.typescriptlang.org/tsconfig#paths)
