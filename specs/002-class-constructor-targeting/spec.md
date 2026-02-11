# Feature Specification: Ciblage du constructeur pour symboles classe/scope

**Feature Branch**: `002-class-constructor-targeting`
**Created**: 2026-02-10
**Status**: Draft
**Input**: Lorsque je vise un symbole de classe/scope (namespace), viser bien le constructeur de la classe. Adapter pour PHP, Python, TypeScript.

---

## User Scenarios & Testing

### User Story 1 - Navigation vers le constructeur PHP (Priority: P1)

En tant qu'utilisateur, lorsque je consulte le graphe de dépendances ou que je résous la définition d'une classe PHP (ex. `App\Services\AuthService`), je veux que la position cible (targetLine/targetColumn) pointe vers le **constructeur** de la classe (`__construct` ou méthode nommée comme la classe), et non uniquement vers la ligne `class AuthService`.

**Why this priority**: Comportement principal demandé pour PHP ; améliore l'UX de navigation.

**Independent Test**: Explorer un fichier qui importe/utilise `AuthService` ; vérifier que l'arête du graphe ou la résolution LSP pointe vers la ligne du `function __construct` (ou équivalent) dans le fichier de la classe.

**Acceptance Scenarios**:

1. **Given** un fichier PHP qui utilise une classe (import ou `new`), **When** on résout la définition du symbole de la classe, **Then** `targetLine`/`targetColumn` correspondent au début du constructeur (`__construct` ou méthode homonyme).
2. **Given** une classe PHP sans constructeur explicite, **When** on résout la définition de la classe, **Then** on retombe sur la ligne de déclaration `class X` (comportement de repli).
3. **Given** une interface ou un trait PHP (sans constructeur), **When** on résout le symbole, **Then** la position reste sur la déclaration `interface`/`trait`.

---

### User Story 2 - Navigation vers le constructeur TypeScript (Priority: P1)

En tant qu'utilisateur, lorsque je vise une classe TypeScript/JavaScript (import ou usage), je veux que la définition résolue pointe vers le **constructeur** (`constructor(...)`) de la classe lorsque la cible est le symbole de la classe (scope).

**Why this priority**: Parité avec PHP ; langage principal du projet.

**Independent Test**: Explorer un fichier TS qui importe une classe ; vérifier que la cible pointe vers `constructor` dans le fichier de la classe.

**Acceptance Scenarios**:

1. **Given** un fichier TypeScript qui importe ou instancie une classe, **When** on résout la définition du symbole de la classe, **Then** la position pointe vers le bloc `constructor(...)`.
2. **Given** une classe sans bloc `constructor` explicite, **When** on résout la définition, **Then** la position pointe vers la déclaration `class X` (repli).
3. **Given** une interface ou un type TypeScript (pas une classe), **When** on résout le symbole, **Then** le comportement actuel est conservé (pas de constructeur).

---

### User Story 3 - Navigation vers le constructeur Python (Priority: P1)

En tant qu'utilisateur, lorsque je vise une classe Python (import ou usage), je veux que la définition résolue pointe vers la méthode **`__init__`** de la classe lorsque la cible est le symbole de la classe.

**Why this priority**: Parité entre les trois langages demandés.

**Independent Test**: Explorer un fichier Python qui importe une classe ; vérifier que la cible pointe vers `def __init__` dans le fichier de la classe.

**Acceptance Scenarios**:

1. **Given** un fichier Python qui importe ou instancie une classe, **When** on résout la définition du symbole de la classe, **Then** la position pointe vers `def __init__(...)`.
2. **Given** une classe Python sans `__init__` explicite, **When** on résout la définition, **Then** la position pointe vers la déclaration `class X` (repli).
3. **Given** un module Python exposant une classe (namespace), **When** on résout le symbole de la classe, **Then** la cible est bien `__init__` dans le fichier où la classe est définie.

---

### Edge Cases

- Classe avec plusieurs constructeurs (surcharge) : viser le premier constructeur déclaré (PHP/TS) ou `__init__` (Python).
- Classe avec constructeur privé/protected : même règle (viser le constructeur).
- Fichier avec plusieurs classes : la résolution est déjà par symbole (nom de classe), pas de changement de scope.
- Résolution sans LSP (fallback parser) : le même comportement (viser constructeur) doit s'appliquer lorsque la définition est trouvée par recherche dans le fichier.

---

## Requirements

### Functional Requirements

- **FR-001**: Lorsque la résolution de définition cible un **symbole de classe** (PHP/TypeScript/Python), le système MUST renvoyer la position (ligne/colonne) du **constructeur** de cette classe lorsque celui-ci existe.
- **FR-002**: En PHP, le constructeur est identifié par la méthode `__construct` ou, à défaut, par une méthode publique portant le même nom que la classe (style PHP 4).
- **FR-003**: En TypeScript/JavaScript, le constructeur est identifié par le bloc `constructor(...)` dans le corps de la classe.
- **FR-004**: En Python, le constructeur est identifié par la méthode `__init__` de la classe.
- **FR-005**: Si la classe n'a pas de constructeur explicite (ou équivalent), le système MUST conserver le comportement actuel : position sur la déclaration de la classe (ou interface/trait/type selon le cas).
- **FR-006**: Les interfaces, traits, types et enums (sans notion de constructeur utilisateur) MUST conserver le ciblage sur leur déclaration ; aucun changement pour ces symboles.

### Key Entities

- **DefinitionResult** : `filePath`, `line`, `column` (et optionnellement `name`) ; les champs `line`/`column` doivent pointer vers le constructeur lorsque le symbole résolu est une classe.
- **GraphEdge** : `targetPath`, `targetLine`, `targetColumn` ; doivent refléter la même logique (constructeur quand la cible est une classe).
- **LSP / Résolution** : les providers PHP, TypeScript et Python qui renvoient une définition pour un symbole de classe doivent appliquer la règle constructeur.

---

## Success Criteria

- **SC-001**: Pour tout fichier de fixture PHP/TS/Python contenant une classe avec constructeur, l’exploration du graphe et la résolution de définition pointent vers la ligne du constructeur (vérifiable manuellement ou par test).
- **SC-002**: Aucune régression : les symboles qui ne sont pas des classes (fonctions, interfaces, etc.) conservent le comportement actuel.
- **SC-003**: Les tests existants passent ; des tests ciblés pour le ciblage constructeur sont ajoutés ou mis à jour pour les trois langages.
