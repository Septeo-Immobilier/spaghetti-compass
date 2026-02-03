# CLI Interface Contract: Clickable Navigation

**Feature**: `3-md-clickable-navigation`  
**Date**: 2026-02-02

## Nouvelles options CLI

### `--absolute-paths`

Force l'utilisation de chemins absolus dans l'output.

```bash
spaghetti-compass explore src/main.ts --absolute-paths
```

**Comportement** :
- Par défaut (`false`) : Chemins relatifs depuis le cwd
- Avec `--absolute-paths` : Chemins absolus complets

**Exemple output** :

```
# Sans --absolute-paths (défaut)
src/core/analyzer.ts:42

# Avec --absolute-paths
/home/user/project/src/core/analyzer.ts:42
```

### `--no-links`

Désactive le formatage des liens cliquables.

```bash
spaghetti-compass explore src/main.ts --no-links
```

**Comportement** :
- Par défaut : Chemins formatés comme `chemin:ligne:colonne`
- Avec `--no-links` : Chemins simples sans numéro de ligne/colonne

**Exemple output** :

```
# Sans --no-links (défaut)
src/core/analyzer.ts:42:1

# Avec --no-links
src/core/analyzer.ts
```

## Format de sortie

### Fichiers internes

```
chemin/relatif/fichier.ts:ligne:colonne
```

Exemple :
```
src/core/analyzer.ts:42:1
├── 📥 IMPORTS (internal)
│   ├── src/types/index.ts:1:1
│   └── src/parser/typescript.ts:15:1
```

### Fichiers externes (node_modules)

```
package@version:chemin/interne.ts:ligne:colonne
```

Exemple :
```
├── 📦 IMPORTS (third-party)
│   ├── commander@12.1.0:index.d.ts:1:1
│   └── typescript@5.9.3:lib/typescript.d.ts:1:1
```

### Fichiers hors contexte mais dans le projet

```
../autre-module/fichier.ts:ligne:colonne
```

## Compatibilité

### Options existantes préservées

| Option | Comportement |
|--------|--------------|
| `--json` | Output JSON (liens non applicables) |
| `--hyperlinks` | Liens OSC 8 (format différent, coexiste) |
| `--context` | Affecte le calcul des chemins relatifs |

### Combinaisons valides

| Combinaison | Résultat |
|-------------|----------|
| `--json` | JSON standard, pas de liens cliquables |
| `--hyperlinks` | Liens OSC 8 (terminal supporté requis) |
| `--absolute-paths` | Chemins absolus avec ligne:colonne |
| `--no-links` | Chemins simples sans ligne:colonne |
| `--absolute-paths --no-links` | Chemins absolus simples |
| `--hyperlinks --absolute-paths` | OSC 8 avec chemins absolus |

## Exit codes

Pas de nouveaux exit codes. Les options de formatage n'affectent pas les codes de sortie existants.

## Validation

- `--absolute-paths` : Pas de validation, toujours applicable
- `--no-links` : Pas de validation, toujours applicable
- Les deux options sont ignorées si `--json` est utilisé
