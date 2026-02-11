# Feature Specification: Commande CLI agent-setup

**Feature Branch**: `7-agent-setup-cli`
**Created**: 2026-02-11
**Status**: Draft
**Input**: User description: "Commande CLI agent-setup : prend un chemin (optionnel, défaut courant), un modèle de workflow IA (cursor / claude / etc.), écrit les bons fichiers. Opération à faire une fois, à refaire en cas de maj (écrase les anciens fichiers)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Initialiser la config agent depuis la CLI (Priority: P1)

En tant que développeur ou utilisateur du CLI, je veux exécuter une commande unique (ex. `agent-setup`) avec un chemin cible et un type de workflow IA (Cursor, Claude, etc.) pour que tous les fichiers de configuration nécessaires (règles, skills, commandes) soient créés ou mis à jour dans le projet.

**Why this priority**: C'est la valeur centrale — une seule commande pour "brancher" le projet sur un environnement agent sans édition manuelle.

**Independent Test**: Exécuter `spaghetti-compass agent-setup --workflow cursor` dans un répertoire vide ou existant et vérifier la présence des fichiers attendus (ex. `.cursor/rules/`, `.agents/skills/`, etc.).

**Acceptance Scenarios**:

1. **Given** un répertoire de projet (ou le répertoire courant), **When** l'utilisateur exécute `agent-setup` avec un workflow choisi (ex. cursor), **Then** les fichiers de configuration pour ce workflow sont créés au chemin cible.
2. **Given** aucun chemin fourni, **When** l'utilisateur exécute `agent-setup`, **Then** le répertoire courant est utilisé comme cible.
3. **Given** des fichiers de configuration agent déjà présents pour ce workflow, **When** l'utilisateur relance `agent-setup` avec le même workflow, **Then** les fichiers correspondants sont écrasés (mise à jour sans duplication).

---

### User Story 2 - Choisir le workflow IA (Cursor, Claude, etc.) (Priority: P1)

En tant qu'utilisateur, je veux indiquer pour quel environnement agent je configure le projet (Cursor, Claude, autre) afin que les bons templates et emplacements de fichiers soient utilisés.

**Why this priority**: Chaque outil a ses conventions (.cursor/rules, .cursor/commands, vs autres dossiers pour Claude) — le choix du workflow détermine quels fichiers sont écrits et où.

**Independent Test**: Lancer `agent-setup --workflow cursor` puis `agent-setup --workflow claude` (ou équivalent) et comparer les arborescences générées.

**Acceptance Scenarios**:

1. **Given** un workflow valide (ex. `cursor`), **When** l'utilisateur lance `agent-setup --workflow cursor`, **Then** seuls les fichiers pertinents pour Cursor sont créés/mis à jour.
2. **Given** un workflow inconnu ou non supporté, **When** l'utilisateur le spécifie, **Then** le CLI affiche un message d'erreur explicite et liste les workflows supportés (ou sort avec code d'erreur).
3. **Given** l'absence d'option workflow, **When** l'utilisateur exécute `agent-setup`, **Then** le CLI demande le workflow (prompt) ou utilise une valeur par défaut documentée (ex. cursor).

---

### User Story 3 - Cibler un répertoire (optionnel) (Priority: P2)

En tant qu'utilisateur, je veux pouvoir passer un chemin en argument pour configurer un projet autre que le répertoire courant (ex. sous-dossier ou projet monorepo).

**Why this priority**: Utile pour scripts et monorepos ; pas bloquant pour le cas courant "je suis dans la racine du projet".

**Independent Test**: Exécuter `spaghetti-compass agent-setup --workflow cursor ./packages/app` et vérifier que les fichiers sont créés sous `./packages/app/.cursor/` (ou convention du workflow).

**Acceptance Scenarios**:

1. **Given** un chemin relatif ou absolu valide vers un répertoire, **When** l'utilisateur l'indique (ex. `-p ./packages/app` ou argument positionnel), **Then** les fichiers sont écrits sous ce répertoire selon la convention du workflow.
2. **Given** un chemin vers un fichier ou un répertoire inexistant, **When** l'utilisateur l'indique, **Then** le CLI signale une erreur claire et n'écrit rien.
3. **Given** aucun chemin fourni, **When** l'utilisateur exécute `agent-setup`, **Then** le répertoire courant est utilisé.

---

### Edge Cases

- Que se passe-t-il si le répertoire cible n'est pas accessible en écriture ?
- Comment gérer les chemins relatifs vs absolus (résolution par rapport à la CWD) ?
- Faut-il un mode "dry-run" ou `--list` pour afficher les fichiers qui seraient créés/écrasés sans les écrire ?
- Si un workflow supporte des variantes (ex. "cursor-minimal" vs "cursor-full"), comment les exposer (sous-options, valeurs d'enum) ?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le CLI DOIT exposer une commande (ex. `agent-setup`) prenant en entrée un chemin cible optionnel (défaut : répertoire courant) et un identifiant de workflow IA (ex. cursor, claude).
- **FR-002**: Le CLI DOIT écrire ou mettre à jour uniquement les fichiers correspondant au workflow choisi (règles, skills, commandes, etc.) dans le répertoire cible.
- **FR-003**: Le CLI DOIT écraser les fichiers existants déjà associés à ce workflow lors d'une ré-exécution (comportement idempotent pour mise à jour).
- **FR-004**: Le CLI DOIT supporter au moins le workflow "cursor" (fichiers .cursor/rules, .cursor/commands, .agents/skills selon conventions du projet).
- **FR-005**: Le CLI DOIT valider que le chemin cible existe et est un répertoire avant d'écrire ; en cas d'erreur, afficher un message clair et sortir avec un code d'erreur non nul.
- **FR-006**: Le CLI DOIT documenter les workflows supportés (aide ou message d'erreur) lorsque l'utilisateur spécifie un workflow invalide ou omet le workflow si requis.
- **FR-007**: Le contenu écrit DOIT inclure les éléments nécessaires pour que les agents utilisent spaghetti-compass (exploration de dépendances, règles Docker si applicable) conformément aux règles/skills existants du projet.

### Key Entities

- **Workflow IA** : Identifiant (ex. cursor, claude) qui détermine quels templates utiliser et quels dossiers/fichiers créer.
- **Répertoire cible** : Chemin du projet à configurer ; doit exister et être un répertoire.
- **Fichiers de configuration agent** : Règles, skills, commandes (contenus dérivés de templates ou du projet).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un utilisateur peut configurer un projet pour Cursor en une seule commande sans éditer les fichiers à la main.
- **SC-002**: Ré-exécuter la même commande avec le même workflow met à jour les fichiers existants sans créer de doublons ni laisser d'anciens fichiers orphelins pour ce workflow.
- **SC-003**: En cas de chemin invalide ou de workflow non supporté, l'utilisateur reçoit un message d'erreur explicite et le CLI quitte avec un code d'erreur approprié.
- **SC-004**: La documentation (--help ou README) indique clairement les workflows supportés et la signification du chemin optionnel.
