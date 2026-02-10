# Feature Specification: PHP Links Target Definition Instead of Usage

**Feature Branch**: `6-php-link-definition-target`  
**Created**: 2026-02-06  
**Status**: Draft  
**Input**: User description: "Retour utilisateur PHP - les liens pointent vers leur utilisation, et non leur définition. Comportement correct dans les fixtures."

## Contexte du Problème

Un utilisateur PHP sur un projet réel (Symfony) rapporte que les liens générés par `spaghetti-compass explore` pointent vers l'**utilisation** des symboles (ligne du `use` statement) plutôt que vers leur **définition** (ligne de déclaration de la classe/fonction).

### Comportement Observé (Projet Réel)

```
spaghetti-compass explore CompanyService.php:CompanyService:paginateList
├── 📦 EXTERNAL (flat)
│   └── PaginateResult: PaginateResult
```

Les imports `use App\Module\Company\Entity\Company;` etc. sont listés comme "DYNAMIC IMPORTS (unresolved)" avec la ligne du `use` statement, pas la ligne de définition de la classe.

### Comportement Attendu (Fixtures)

Dans les fixtures PHP du projet, les liens pointent correctement vers les définitions. La différence clé est que les fixtures utilisent `require_once __DIR__ . '/path'` tandis que le projet Symfony utilise des namespaces PSR-4 avec autoloading.

## User Scenarios & Testing

### User Story 1 - Résolution des Namespaces PSR-4 (Priority: P1)

En tant que développeur PHP utilisant un framework moderne (Symfony, Laravel), je veux que les liens vers les classes importées via `use` statements pointent vers la définition de la classe (fichier + ligne de déclaration) et non vers la ligne du `use` statement.

**Why this priority**: C'est le cas d'usage principal des développeurs PHP modernes. Sans cette fonctionnalité, l'outil est inutilisable pour la majorité des projets PHP professionnels.

**Independent Test**: Peut être testé en exécutant `spaghetti-compass explore` sur un projet Symfony/Laravel et en vérifiant que les liens ouvrent le fichier de définition à la bonne ligne.

**Acceptance Scenarios**:

1. **Given** un projet PHP avec autoloading PSR-4 configuré (composer.json), **When** j'exécute `spaghetti-compass explore` sur un fichier utilisant `use App\Models\User;`, **Then** le lien vers `User` pointe vers le fichier `src/Models/User.php` à la ligne de `class User`.

2. **Given** un fichier PHP avec `use App\Services\AuthService;`, **When** j'analyse une fonction qui appelle `$this->authService->login()`, **Then** le lien pointe vers `AuthService.php` à la ligne de définition de la méthode `login()`.

3. **Given** un namespace PHP avec alias `use App\Models\User as UserModel;`, **When** j'analyse le code utilisant `UserModel`, **Then** le lien pointe vers la définition de `User` dans le fichier correct.

---

### User Story 2 - Support Intelephense pour Résolution de Types (Priority: P1)

En tant que développeur PHP, je veux que l'outil utilise le LSP Intelephense pour résoudre les définitions des classes importées via namespaces, car c'est la seule façon fiable de résoudre les chemins PSR-4.

**Why this priority**: Sans LSP, la résolution des namespaces PHP est quasi impossible (nécessite parsing du composer.json, autoload.php, etc.).

**Independent Test**: Vérifier que Intelephense est appelé pour résoudre `use` statements et retourne le bon fichier/ligne.

**Acceptance Scenarios**:

1. **Given** Intelephense installé et un projet PHP avec composer.json, **When** j'analyse un fichier avec `use App\Entity\Company;`, **Then** le LSP résout le chemin vers `src/Entity/Company.php`.

2. **Given** un `use` statement vers une classe Symfony (`use Symfony\Component\HttpFoundation\Response;`), **When** j'analyse le fichier, **Then** la classe est correctement identifiée comme "third-party" (vendor).

---

### User Story 3 - Distinction Imports Résolus vs Non-Résolus (Priority: P2)

En tant que développeur, je veux voir clairement quels imports ont été résolus vers leur définition et lesquels n'ont pas pu être résolus, afin de comprendre les limitations de l'analyse.

**Why this priority**: Améliore la transparence et aide au debugging quand la résolution échoue.

**Independent Test**: L'output distingue visuellement les imports résolus des non-résolus.

**Acceptance Scenarios**:

1. **Given** un mix d'imports internes et third-party, **When** j'analyse le fichier, **Then** les imports internes résolus affichent le chemin du fichier, les third-party affichent le nom du package.

2. **Given** un import vers une classe inexistante, **When** j'analyse le fichier, **Then** l'import est marqué comme "unresolved" avec un indicateur visuel.

---

### Edge Cases

- Que se passe-t-il quand le `composer.json` n'existe pas ou est invalide ?
- Comment le système gère-t-il les namespaces avec plusieurs niveaux de profondeur (`App\Module\Company\Service\CompanyService`) ?
- Que se passe-t-il pour les classes définies dans le même fichier (rare mais possible) ?
- Comment gérer les traits PHP (`use MyTrait;` dans une classe) vs les imports de namespace (`use App\Traits\MyTrait;`) ?

## Requirements

### Functional Requirements

- **FR-001**: Le système DOIT résoudre les `use` statements PHP vers le fichier de définition de la classe/interface/trait.

- **FR-002**: Le système DOIT utiliser Intelephense (si disponible) pour résoudre les chemins des namespaces PSR-4.

- **FR-003**: Le système DOIT afficher la ligne de définition de la classe (ligne `class ClassName`) et non la ligne du `use` statement.

- **FR-004**: Le système DOIT supporter les alias de namespace (`use App\Models\User as UserModel;`).

- **FR-005**: Le système DOIT distinguer les imports internes (projet), third-party (vendor), et natifs PHP.

- **FR-006**: Le système DOIT fonctionner en mode dégradé (sans LSP) en affichant les imports comme "unresolved" plutôt qu'en échouant.

- **FR-007**: Le système DOIT supporter la configuration PSR-4 standard de Composer (`autoload.psr-4` dans `composer.json`).

### Key Entities

- **UseStatement**: Représente un import PHP (`use App\Models\User;`), avec namespace complet, alias optionnel, et ligne d'import.
- **ClassDefinition**: Représente la définition d'une classe PHP, avec fichier, ligne de déclaration, et namespace.
- **ComposerConfig**: Configuration d'autoloading extraite de `composer.json` (mappings PSR-4).

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% des `use` statements vers des classes internes au projet sont résolus vers le bon fichier et la bonne ligne de définition.

- **SC-002**: Les développeurs peuvent naviguer directement vers la définition d'une classe en cliquant sur le lien dans l'output.

- **SC-003**: Le temps d'analyse n'augmente pas de plus de 20% par rapport à la version actuelle (avec LSP déjà actif).

- **SC-004**: Les projets Symfony/Laravel standards sont analysables sans configuration supplémentaire (détection automatique du `composer.json`).
