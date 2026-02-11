# Task Breakdown: Ciblage du constructeur pour symboles classe/scope

**Feature Branch**: `002-class-constructor-targeting`
**Created**: 2026-02-10

---

## Phase 1: PHP (3 tasks)

### T001 - Ajouter findConstructorLine dans le LSP PHP ✅
**Complexity**: Medium
**Prerequisites**: None
**Files**: `src/core/lsp/php.ts`

- Ajouter une méthode `findConstructorLine(content: string, className: string): number | null`.
- Chercher dans le fichier la classe `className`, puis dans son corps la première méthode `function __construct` ou `function <className>` (PHP 4 style).
- Retourner la ligne (1-indexed) du début de cette méthode, ou `null` si pas de constructeur.
- Gérer les modificateurs (public/private/protected, static) dans les regex.

---

### T002 - Utiliser le constructeur dans getDefinitionFromImport (PHP) ✅
**Complexity**: Simple
**Prerequisites**: T001
**Files**: `src/core/lsp/php.ts`

- Dans `getDefinitionFromImport`, après avoir obtenu `classDefLine` via `findClassDefinitionLine`, appeler `findConstructorLine(targetContent, symbolName)`.
- Si le résultat n’est pas null, utiliser cette ligne (et colonne appropriée) pour le `DefinitionResult` au lieu de `classDefLine`.
- Ne pas appliquer cette logique pour interface/trait/enum (rester sur la déclaration).

---

### T003 - Fallback analyzer: viser le constructeur dans findPhpDefinitionLine ✅
**Complexity**: Medium
**Prerequisites**: T001
**Files**: `src/core/analyzer.ts`

- Dans `findPhpDefinitionLine`, lorsque la recherche par patterns trouve une **classe** (pas interface/trait/enum), avant de renvoyer la ligne, chercher la ligne du constructeur dans le même fichier (même logique que T001).
- Si trouvée, renvoyer la ligne du constructeur ; sinon, renvoyer la ligne de la classe.
- Réutiliser la logique (dupliquer ou extraire dans un helper partagé avec `php.ts` selon préférence du projet).

---

## Phase 2: TypeScript (1 task)

### T004 - Post-traiter la définition classe → constructor (TypeScript)
**Complexity**: Medium
**Prerequisites**: None
**Files**: `src/core/lsp/typescript.ts`

- Après obtention d’un `DefinitionResult` (dans `getDefinition`, `getDefinitionByName`, `getDefinitionFromImport`), vérifier si la position dans le fichier cible correspond à une déclaration de classe (lire le contenu ou utiliser l’API TS pour le kind du nœud).
- Si oui : dans le sourceFile du fichier cible, parcourir l’AST pour trouver le membre `constructor` de cette classe ; si trouvé, mettre à jour `line` et `column` du résultat vers la position du `constructor`.
- Ne pas modifier le résultat pour interface/type/enum.

---

## Phase 3: Python (1 task)

### T005 - Post-traiter la définition classe → __init__ (Python)
**Complexity**: Medium
**Prerequisites**: None
**Files**: `src/core/lsp/python.ts`

- Quand le `DefinitionResult` pointe vers une ligne contenant `class \s+<ClassName>`, ajouter une étape : dans le même fichier, localiser le corps de la classe (indentation) et chercher `def __init__`.
- Si trouvé, remplacer `line` (et `column`) du résultat par la position de `def __init__`.
- Implémenter une fonction helper du type `findConstructorLineInClass(content, className): number | null` pour garder le code lisible.

---

## Phase 4: Tests et validation (2 tasks)

### T006 - Fixtures et tests PHP/TS/Python (constructeur)
**Complexity**: Simple
**Prerequisites**: T002, T003, T004, T005
**Files**: `fixtures/`, tests (ex. `tests/` ou `src/__tests__/` selon le projet)

- S’assurer que les fixtures contiennent des classes avec constructeur (PHP `__construct`, TS `constructor`, Python `__init__`).
- Ajouter ou adapter des tests qui vérifient que pour un symbole de classe, `targetLine`/`targetColumn` (ou équivalent) pointent vers le constructeur.

---

### T007 - Non-régression et documentation
**Complexity**: Simple
**Prerequisites**: T006
**Files**: README ou specs, suite de tests

- Lancer la suite de tests existante ; corriger toute régression.
- Documenter brièvement le comportement (optionnel : une ligne dans le README ou dans `specs/002-class-constructor-targeting/quickstart.md`).

---

## Dependency Graph

```
Phase 1 (PHP)
  T001 ──► T002
    └──► T003

Phase 2 (TS)     T004
Phase 3 (Python) T005

Phase 4: T006 (après T002, T003, T004, T005) ──► T007
```

## Parallel Execution Opportunities

- T004 (TypeScript) et T005 (Python) peuvent être réalisés en parallèle après la Phase 1.
- T001 peut être fait en premier ; T002 et T003 dépendent de T001.

## Summary

- **Total tasks**: 7
- **By priority**: P1 (tous les user stories)
- **Estimated effort**: ~0,5–1 jour (développement + tests)
