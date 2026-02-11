# Implementation Plan: Ciblage du constructeur pour symboles classe/scope

**Feature Branch**: `002-class-constructor-targeting`
**Created**: 2026-02-10

---

## Architecture Decision

### Contexte

Aujourd’hui, lorsqu’on résout la définition d’un symbole de **classe** (PHP namespace, import TypeScript/Python), la position renvoyée pointe vers la **déclaration de la classe** (`class X`, `interface X`, etc.). La demande est de faire pointer cette position vers le **constructeur** de la classe lorsqu’il existe, pour PHP, TypeScript et Python.

### Points d’impact

| Composant | Rôle | Modification |
|-----------|------|--------------|
| **LSP PHP** (`src/core/lsp/php.ts`) | `findClassDefinitionLine` renvoie la ligne de la classe ; `getDefinitionFromImport` / résolution Composer | Après avoir trouvé la ligne de la classe, chercher dans le même fichier la ligne du constructeur (`__construct` ou méthode homonyme) et la renvoyer à la place. |
| **LSP TypeScript** (`src/core/lsp/typescript.ts`) | `getDefinition` / `getDefinitionByName` / `getDefinitionFromImport` utilisent le Language Service | Quand la définition renvoyée par TS pointe vers une déclaration de classe, post-traiter pour déplacer la position vers le nœud `constructor` du même fichier si présent. |
| **LSP Python** (`src/core/lsp/python.ts`) | `getDefinitionByName` / `getDefinitionFromImport` + patterns regex | Quand la définition pointe vers une déclaration `class X`, post-traiter pour chercher `def __init__` dans le même fichier (même classe) et renvoyer cette position. |
| **Analyzer** (`src/core/analyzer.ts`) | `findPhpDefinitionLine` utilisé en fallback sans LSP | Étendre pour renvoyer la ligne du constructeur lorsqu’on cherche une classe (même logique que PHP LSP). |

Aucun changement de contrat d’API public (CLI, JSON) : seuls les champs `line`/`column` (ou `targetLine`/`targetColumn`) des résultats de définition changent.

---

## Technology Stack

| Composant | Technologie | Note |
|-----------|-------------|------|
| PHP | Regex / parsing léger dans le fichier cible | Déjà en place pour `findClassDefinitionLine` ; ajout d’une fonction « trouver ligne constructeur PHP ». |
| TypeScript | API TypeScript (AST) ou regex | Préférer l’API TS pour fiabilité (parcours du sourceFile après résolution). |
| Python | Regex ou parsing léger | Recherche `def __init__` dans le corps de la classe (délimité par indentation ou scope). |

---

## Implementation Strategy

### Phase 1 : PHP

1. **`src/core/lsp/php.ts`**
   - Ajouter `findConstructorLine(content: string, className: string): number | null` :
     - Chercher le bloc de la classe (après `class \s+ClassName`) et dans ce bloc, la première méthode `function __construct` ou `function ClassName`.
     - Retourner la ligne (1-indexed) du début de cette méthode.
   - Dans `getDefinitionFromImport` et partout où on utilise `findClassDefinitionLine` pour une **classe** (pas interface/trait/enum), appeler d’abord `findConstructorLine` ; si non null, utiliser cette ligne (et colonne 1 ou colonne du début du mot) pour le `DefinitionResult`. Sinon, garder `findClassDefinitionLine`.

2. **`src/core/analyzer.ts`**
   - Dans `findPhpDefinitionLine` : quand on trouve une classe (via les patterns classe/interface/trait/enum), avant de renvoyer la ligne de la classe, chercher dans le même fichier la ligne du constructeur (même logique que LSP PHP). Si trouvée, renvoyer la ligne du constructeur ; sinon, renvoyer la ligne de la classe.

### Phase 2 : TypeScript

3. **`src/core/lsp/typescript.ts`**
   - Après avoir obtenu un `DefinitionResult` (dans `getDefinition`, `getDefinitionByName`, `getDefinitionFromImport`), déterminer si la position pointe vers une déclaration de **classe** (lire le fichier cible ou utiliser le Language Service pour le kind du symbole).
   - Si oui : dans le sourceFile du fichier cible, parcourir l’AST pour trouver le premier `constructor` dans cette classe ; si trouvé, remplacer `line`/`column` du résultat par la position du `constructor`.
   - Sinon : garder le résultat tel quel.

### Phase 3 : Python

4. **`src/core/lsp/python.ts`**
   - Quand la définition résolue (par LSP ou par `getDefinitionByName`) pointe vers une ligne contenant `class \s+ClassName`, post-traiter : dans le même fichier, localiser le bloc de la classe (indentation) et chercher `def __init__` ; si trouvé, remplacer la position du résultat par celle de `def __init__`.
   - Implémentation possible : fonction `findConstructorLineInClass(content, className)` qui trouve la ligne de `def __init__` dans la classe donnée (en gérant l’indentation Python).

### Phase 4 : Tests et non-régression

5. **Tests**
   - Fixtures : s’assurer qu’il existe (ou ajouter) des classes avec constructeur en PHP, TS, Python.
   - Tests unitaires ou d’intégration : vérifier que pour un appel/import vers une classe, `targetLine`/`targetColumn` pointent vers le constructeur.
   - Vérifier que les interfaces/traits/types sans constructeur ne changent pas de comportement.

---

## File Structure

Fichiers à modifier (sans nouveau répertoire) :

```
src/core/lsp/php.ts        # findConstructorLine + usage dans getDefinitionFromImport / getDefinitionByName si applicable
src/core/lsp/typescript.ts # post-traitement "class → constructor" après résolution
src/core/lsp/python.ts     # post-traitement "class → __init__" après résolution
src/core/analyzer.ts       # findPhpDefinitionLine : préférer constructeur quand symbole = classe
```

Optionnel : extraire la logique « trouver ligne constructeur PHP » dans un petit helper (ex. `src/core/lsp/php-constructor.ts`) pour réutilisation entre `php.ts` et `analyzer.ts` si la duplication devient gênante.

---

## Dependencies

- Aucune dépendance npm nouvelle.
- Les fixtures existantes (PHP, TypeScript, Python) doivent contenir au moins une classe avec constructeur pour validation manuelle et tests.
