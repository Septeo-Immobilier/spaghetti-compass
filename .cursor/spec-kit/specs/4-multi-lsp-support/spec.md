# Feature Specification: Multi-LSP Support (PHP & Python)

**Feature Branch**: `4-multi-lsp-support`  
**Created**: 2026-02-03  
**Status**: Draft  
**Input**: User description: "Intégrer le LSP PHP (Intelephense) et Python (Pyright) pour la fonctionnalité Go to Definition"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Navigation Go to Definition pour PHP (Priority: P1)

En tant qu'utilisateur analysant un projet PHP avec spaghetti-compass, je veux que les liens dans l'output pointent vers les définitions des fonctions/classes PHP, pour pouvoir naviguer rapidement vers le code source.

**Why this priority**: PHP est un langage très répandu. La navigation vers les définitions apporte la même valeur que pour TypeScript, déjà implémenté.

**Independent Test**: Analyser un fichier PHP qui appelle une fonction définie dans un autre fichier, vérifier que le lien pointe vers la définition.

**Acceptance Scenarios**:

1. **Given** un projet PHP avec `composer.json`, **When** j'exécute `spaghetti-compass explore src/Controller/UserController.php`, **Then** les appels de méthodes affichent le chemin vers leur fichier de définition avec ligne et colonne.

2. **Given** un fichier PHP qui utilise une classe d'un namespace, **When** j'analyse ce fichier, **Then** le lien vers la classe pointe vers sa définition, pas vers le `use` statement.

3. **Given** Intelephense n'est pas installé, **When** j'analyse un fichier PHP, **Then** le système affiche un warning et utilise un fallback (ligne de l'import).

---

### User Story 2 - Navigation Go to Definition pour Python (Priority: P1)

En tant qu'utilisateur analysant un projet Python avec spaghetti-compass, je veux que les liens dans l'output pointent vers les définitions des fonctions/classes Python.

**Why this priority**: Python est aussi populaire que PHP. Les deux langages doivent être supportés avec la même priorité.

**Independent Test**: Analyser un fichier Python qui importe une fonction d'un module local, vérifier que le lien pointe vers la définition.

**Acceptance Scenarios**:

1. **Given** un projet Python avec `pyproject.toml` ou `setup.py`, **When** j'exécute `spaghetti-compass explore src/main.py`, **Then** les imports affichent le chemin vers leur fichier de définition.

2. **Given** un fichier Python qui utilise `from module import function`, **When** j'analyse ce fichier, **Then** le lien vers `function` pointe vers sa définition dans `module.py`.

3. **Given** Pyright n'est pas installé, **When** j'analyse un fichier Python, **Then** le système affiche un warning et utilise un fallback.

---

### User Story 3 - Architecture LSP abstraite (Priority: P0 - Prerequisite)

En tant que développeur de spaghetti-compass, je veux une architecture LSP modulaire pour pouvoir ajouter facilement de nouveaux langages.

**Why this priority**: C'est un prérequis technique. Sans cette abstraction, chaque langage nécessiterait une implémentation ad-hoc difficile à maintenir.

**Independent Test**: Le code TypeScript existant doit fonctionner de manière identique après le refactoring.

**Acceptance Scenarios**:

1. **Given** le code actuel `LspService`, **When** je refactore vers `LspProvider` interface, **Then** tous les tests TypeScript existants passent.

2. **Given** l'interface `LspProvider`, **When** j'ajoute un nouveau langage, **Then** je n'ai qu'à implémenter l'interface sans modifier le code existant.

---

### User Story 4 - Détection automatique du LSP (Priority: P2)

En tant qu'utilisateur, je veux que spaghetti-compass détecte automatiquement le LSP approprié basé sur l'extension du fichier.

**Why this priority**: Améliore l'UX mais n'est pas critique. L'utilisateur peut spécifier manuellement si nécessaire.

**Independent Test**: Analyser un projet mixte (TS + PHP + Python) et vérifier que chaque fichier utilise le bon LSP.

**Acceptance Scenarios**:

1. **Given** un projet avec des fichiers `.ts`, `.php`, et `.py`, **When** j'analyse le projet, **Then** chaque type de fichier utilise son LSP approprié.

---

### Edge Cases

- **LSP non installé** : Warning + fallback vers ligne d'import (pas d'erreur bloquante)
- **LSP qui ne répond pas** : Timeout de 5 secondes, puis fallback
- **Fichier non supporté** : Utiliser `NullLspProvider` qui retourne toujours `null`
- **Projet sans config** : Fonctionner sans `composer.json` ou `pyproject.toml` avec capacités réduites
- **Symboles non résolus** : Afficher le nom du symbole sans lien cliquable

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le système DOIT supporter les LSP suivants : TypeScript (existant), PHP (Intelephense), Python (Pyright)

- **FR-002**: Le système DOIT fournir une interface `LspProvider` abstraite avec les méthodes : `getDefinition()`, `addFile()`, `dispose()`

- **FR-003**: Le système DOIT détecter automatiquement le LSP approprié basé sur l'extension du fichier

- **FR-004**: Le système DOIT gérer gracieusement l'absence d'un LSP (warning + fallback)

- **FR-005**: Le système DOIT supporter la communication avec les LSP externes via JSON-RPC sur stdin/stdout

- **FR-006**: Le système DOIT gérer le cycle de vie des processus LSP (démarrage, requêtes, arrêt)

- **FR-007**: Le système DOIT implémenter un timeout pour les requêtes LSP (défaut: 5 secondes)

- **FR-008**: Le système DOIT cacher les instances LSP pour éviter de relancer un processus par fichier

### Key Entities

- **LspProvider**: Interface abstraite définissant le contrat pour tous les providers LSP

- **TypeScriptLspProvider**: Provider utilisant l'API TypeScript directement (existant, à refactorer)

- **ExternalLspProvider**: Classe de base pour les LSP communiquant via JSON-RPC

- **PhpLspProvider**: Provider utilisant Intelephense via JSON-RPC

- **PythonLspProvider**: Provider utilisant Pyright via JSON-RPC

- **LspProviderFactory**: Factory pour créer le provider approprié selon le type de fichier

- **LspProcessManager**: Gestionnaire du cycle de vie des processus LSP externes

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% des tests TypeScript existants passent après le refactoring

- **SC-002**: La résolution de définition PHP fonctionne pour les classes, fonctions, et méthodes

- **SC-003**: La résolution de définition Python fonctionne pour les fonctions, classes, et imports

- **SC-004**: Le temps de réponse LSP est < 500ms pour 95% des requêtes

- **SC-005**: L'absence d'un LSP ne bloque pas l'analyse (dégradation gracieuse)

- **SC-006**: Un nouveau langage peut être ajouté en implémentant uniquement `LspProvider` (< 200 lignes)

## Clarifications

### Session 2026-02-03

- **Q**: Quel LSP utiliser pour PHP ? → **A**: Intelephense - le plus populaire et maintenu activement
- **Q**: Quel LSP utiliser pour Python ? → **A**: Pyright - créé par Microsoft, excellent support des types
- **Q**: Comment gérer les LSP externes ? → **A**: Via JSON-RPC sur stdin/stdout, processus managé par spaghetti-compass
- **Q**: Faut-il installer automatiquement les LSP ? → **A**: Non, l'utilisateur doit les installer. Warning si absent.
