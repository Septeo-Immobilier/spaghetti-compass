# Quickstart: Clickable Navigation

**Feature**: `3-md-clickable-navigation`  
**Date**: 2026-02-02

## Scénario 1 : Navigation basique (US1 + US2)

### Setup

```bash
cd /home/guilhem/code/spaghetti-compass
```

### Test

```bash
# Exécuter dans le terminal intégré VSCode/Cursor
npm run build && node bin/spaghetti-compass.js explore src/cli/index.ts
```

### Validation

1. L'output affiche des chemins au format `src/xxx.ts:ligne:colonne`
2. Ctrl+click sur `src/core/analyzer.ts:XX` ouvre le fichier à la ligne XX
3. Ctrl+click sur `src/types/index.ts:1` ouvre le fichier au début

### Output attendu

```
═════════════════════════════════════════════════════════════════
 📍 Entry Point: src/cli/index.ts:1:1
 📁 Context: /home/guilhem/code/spaghetti-compass
 📊 Stats: X internal, Y external, Z third-party, 0 unresolved
═════════════════════════════════════════════════════════════════

src/cli/index.ts:1:1
├── 📥 IMPORTS (internal)
│   ├── src/types/index.ts:9:1
│   ├── src/core/analyzer.ts:10:1
│   ├── src/output/text.ts:11:1
│   └── src/core/tsconfig.ts:13:1
├── 📦 IMPORTS (third-party)
│   ├── commander@12.1.0
│   └── typescript@5.9.3
```

## Scénario 2 : Chemins absolus

### Test

```bash
npm run build && node bin/spaghetti-compass.js explore src/cli/index.ts --absolute-paths
```

### Validation

1. Les chemins sont absolus : `/home/guilhem/code/spaghetti-compass/src/xxx.ts:ligne:colonne`
2. Ctrl+click fonctionne toujours

## Scénario 3 : Sans liens

### Test

```bash
npm run build && node bin/spaghetti-compass.js explore src/cli/index.ts --no-links
```

### Validation

1. Les chemins n'ont pas de numéro de ligne : `src/xxx.ts`
2. Ctrl+click ouvre le fichier au début (pas de navigation ligne)

## Scénario 4 : Fichiers externes (US3 - P2)

### Setup

Créer un fichier qui importe depuis node_modules :

```typescript
// test-external.ts
import { Command } from 'commander';
```

### Test

```bash
npm run build && node bin/spaghetti-compass.js explore src/cli/index.ts
```

### Validation

1. Les imports third-party affichent `package@version`
2. Le chemin interne au package est affiché si disponible

## Scénario 5 : Terminal externe (US4 - P3)

### Test dans bash/PowerShell

```bash
# Depuis un terminal externe (pas VSCode)
cd /home/guilhem/code/spaghetti-compass
npm run build && node bin/spaghetti-compass.js explore src/cli/index.ts
```

### Validation

1. L'output est lisible et formaté correctement
2. Les chemins sont au format `chemin:ligne:colonne`
3. (Si terminal supporté) Les liens sont cliquables

## Checklist de validation finale

- [ ] US1 : Ctrl+click sur chemin de fichier ouvre le fichier
- [ ] US2 : Ctrl+click positionne le curseur à la bonne ligne
- [ ] US3 : Les fichiers externes affichent `package@version:path`
- [ ] US4 : Format `chemin:ligne:colonne` fonctionne dans bash/PowerShell
- [ ] Option `--absolute-paths` génère des chemins absolus
- [ ] Option `--no-links` désactive les numéros de ligne
- [ ] L'output reste lisible si copié/collé ailleurs
