# Research: Clickable Navigation in Markdown Output

**Feature**: `3-md-clickable-navigation`  
**Date**: 2026-02-02

## Format de liens cliquables dans les terminaux

### Decision: Format `chemin:ligne:colonne`

Le format standard `chemin:ligne:colonne` est reconnu nativement par :
- **VSCode/Cursor terminal intégré** : Détection automatique, ctrl+click ouvre le fichier à la ligne
- **bash/zsh** : Pas de support natif, mais le format est lisible
- **PowerShell** : Pas de support natif, mais le format est lisible
- **iTerm2** : Support via "Semantic History" (cmd+click)
- **Windows Terminal** : Support partiel selon la configuration

### Rationale

Le format `chemin:ligne:colonne` est le standard de facto utilisé par :
- Compilateurs (gcc, tsc, rustc)
- Linters (eslint, prettier)
- Test runners (vitest, jest)

VSCode/Cursor détecte automatiquement ce pattern dans leur terminal et le rend cliquable.

### Alternatives considered

1. **OSC 8 hyperlinks** (`\e]8;;URL\e\\text\e]8;;\e\\`) : 
   - Déjà implémenté dans `text.ts` via `createHyperlink()`
   - Utilise `file://` URLs
   - Support limité : iTerm2, Windows Terminal, certains terminaux Linux
   - **Rejeté pour le mode markdown** car moins universel

2. **vscode:// protocol** :
   - Format : `vscode://file/path:line:column`
   - Nécessite que VSCode soit l'application par défaut
   - **Rejeté** car trop spécifique à VSCode

## Détection de la racine projet

### Decision: Utiliser `package.json` le plus proche

Le projet est délimité par le `package.json` le plus proche de la racine d'analyse.

### Rationale

- Déjà implémenté via `TsConfigResolver.findPackageJson()`
- Cohérent avec la résolution de modules Node.js
- Permet de distinguer clairement le code du projet des dépendances

### Implementation existante

```typescript
// Dans src/core/tsconfig.ts
static findPackageJson(startPath: string): string | null
```

## Gestion des fichiers externes (node_modules)

### Decision: Afficher `package@version:chemin/relatif`

Pour les fichiers dans `node_modules`, afficher le nom du package avec sa version plutôt que le chemin absolu.

### Rationale

- Plus lisible : `lodash@4.17.21:src/array.js` vs `/home/user/project/node_modules/lodash/src/array.js`
- Informatif : l'utilisateur sait immédiatement qu'il s'agit d'une dépendance externe
- Le lien reste cliquable si le fichier est accessible

### Implementation approach

1. Détecter si le chemin contient `node_modules`
2. Extraire le nom du package (gérer les scoped packages `@org/package`)
3. Lire la version depuis le `package.json` du module
4. Construire le chemin relatif interne au package

## Code existant à réutiliser

### `src/output/text.ts`

Le fichier `text.ts` contient déjà :
- `createHyperlink()` : Génère des liens OSC 8
- `createFileLink()` : Crée un lien vers un fichier avec ligne optionnelle
- Option `hyperlinks` dans `TextFormatOptions`

### `src/types/index.ts`

Types existants utilisables :
- `GraphNode` : Contient `path`, `location`, `type`
- `GraphEdge` : Contient `line`, `aliasInfo`
- `ContextInfo` : Contient `projectRoot`

### `src/core/tsconfig.ts`

Fonctions utilitaires :
- `findPackageJson()` : Trouve le package.json le plus proche
- `findTsConfig()` : Trouve le tsconfig.json

## Risques et mitigations

| Risque | Mitigation |
|--------|------------|
| Format non reconnu par certains terminaux | Dégradation gracieuse : le texte reste lisible |
| Chemins avec espaces | Échappement correct des chemins |
| Fichiers supprimés depuis l'analyse | Best effort : afficher le lien, l'erreur sera gérée par l'IDE |
