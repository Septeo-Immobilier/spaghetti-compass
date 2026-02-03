# CLI Interface Contract: TSConfig Path Aliases

**Feature**: 2-tsconfig-path-aliases  
**Date**: 2026-02-02

## Nouvelles Options CLI

### `--tsconfig <path>`

Spécifie un fichier tsconfig.json personnalisé.

**Type**: `string` (chemin)  
**Default**: Auto-découverte (remonte jusqu'au tsconfig.json le plus proche)  
**Alias**: `-t`

```bash
spaghetti-compass explore src/app.ts --tsconfig ./tsconfig.app.json
spaghetti-compass explore src/app.ts -t ./tsconfig.build.json
```

**Comportement**:
- Si le fichier n'existe pas → Erreur avec message explicite
- Si le fichier est invalide (JSON malformé) → Warning, continue sans résolution d'alias
- Chemin relatif résolu depuis le répertoire courant

### `--root <path>`

Override le répertoire racine du projet pour la classification internal/external.

**Type**: `string` (chemin)  
**Default**: Répertoire contenant le package.json le plus proche  
**Alias**: `-r`

```bash
spaghetti-compass explore packages/backend/src/app.ts --root ./
spaghetti-compass explore src/app.ts -r /home/user/monorepo
```

**Comportement**:
- Si le répertoire n'existe pas → Erreur avec message explicite
- Chemin relatif résolu depuis le répertoire courant
- Prend priorité sur la détection automatique via package.json

### `--no-tsconfig`

Désactive la résolution des alias TypeScript.

**Type**: `boolean`  
**Default**: `false`

```bash
spaghetti-compass explore src/app.ts --no-tsconfig
```

**Comportement**:
- Les alias `@/` seront traités comme des packages npm non résolus
- Utile pour le debugging ou la comparaison

## Modifications de la Sortie

### Format Texte

Les imports résolus via alias affichent l'alias original entre parenthèses :

```
├── 📦 IMPORTS (internal)
│   └── src/core/logger.ts (@/core/logger)
```

Les imports non résolus avec alias montrent le chemin résolu :

```
└── ⚠️  IMPORTS (unresolved)
    └── @missing/file (→ nonexistent/file.ts, file not found)
```

### Format JSON

Nouvelle propriété `aliasInfo` dans les edges :

```json
{
  "edges": [
    {
      "from": "/project/src/app.ts",
      "to": "/project/src/core/logger.ts",
      "type": "import-static",
      "resolved": true,
      "line": 1,
      "aliasInfo": {
        "original": "@/core/logger",
        "pattern": "@/*",
        "resolvedVia": "tsconfig.json"
      }
    }
  ]
}
```

### Statistiques

Nouvelle catégorie dans les stats :

```
📊 Stats: 5 internal, 2 external, 3 third-party, 1 unresolved
         (4 via alias)
```

En JSON :

```json
{
  "stats": {
    "internalNodes": 5,
    "externalNodes": 2,
    "thirdPartyNodes": 3,
    "unresolvedEdges": 1,
    "aliasResolutions": 4
  }
}
```

## Messages d'Erreur

### TSConfig non trouvé (info, pas erreur)

```
ℹ️  No tsconfig.json found, alias resolution disabled
```

### TSConfig invalide

```
⚠️  Failed to parse tsconfig.json: Unexpected token at line 5
    Continuing without alias resolution
```

### TSConfig spécifié introuvable

```
❌ Error: TSConfig file not found: ./tsconfig.custom.json
```

### Alias non résolu

```
⚠️  Unresolved alias: @/missing/module
    Pattern '@/*' resolved to 'src/missing/module'
    But file does not exist: /project/src/missing/module.ts
```

## Rétrocompatibilité

| Comportement actuel | Nouveau comportement |
|---------------------|---------------------|
| `@/foo` traité comme package npm | `@/foo` résolu via tsconfig paths |
| Pas d'option --tsconfig | Option disponible |
| rootPath = contexte passé | rootPath = package.json le plus proche |

**Migration**: Aucune action requise. Le nouveau comportement est strictement meilleur.
