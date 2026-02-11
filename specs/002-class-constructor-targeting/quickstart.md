# Quickstart: 002-class-constructor-targeting

**Feature Branch**: `feature/002-class-constructor-targeting`

## Résumé

Quand on vise un symbole de **classe** (namespace PHP, import TS/Python), la position de définition pointe vers le **constructeur** de la classe au lieu de la seule déclaration `class X`.

## Vérification rapide

Après implémentation :

```bash
# Build (dans le conteneur Docker du projet)
npm run build

# Explorer un fichier qui utilise une classe (ex. AuthService)
npx spaghetti-compass explore fixtures/php/src/index.php --json | jq '.edges[] | select(.to | contains("AuthService")) | {to, targetPath, targetLine}'
```

Vérifier que `targetLine` correspond à la ligne du `__construct` (PHP), `constructor` (TS) ou `__init__` (Python) dans le fichier cible.

## Tests

Exécuter la suite de tests (via Docker si requis) :

```bash
npm test
```

## Fichiers modifiés

- `src/core/lsp/php.ts` – recherche du constructeur PHP, utilisation dans la résolution
- `src/core/lsp/typescript.ts` – post-traitement classe → constructor
- `src/core/lsp/python.ts` – post-traitement classe → __init__
- `src/core/analyzer.ts` – fallback PHP sans LSP : préférer la ligne du constructeur
