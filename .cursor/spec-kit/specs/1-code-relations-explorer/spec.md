# Feature Specification: Code Relations Explorer

**Feature Branch**: `1-code-relations-explorer`  
**Created**: 2026-02-02  
**Status**: Draft  
**Input**: User description: "Visualiser/explorer toutes les relations en partant d'un fichier/fonction, en mettant un dossier comme contexte/boite, et voir les dépendances externes"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Explorer les relations d'un fichier (Priority: P1)

En tant que développeur, je veux pouvoir sélectionner un fichier de code et visualiser toutes ses relations (imports, exports, appels de fonctions) pour comprendre rapidement son rôle dans le système.

**Why this priority**: C'est la fonctionnalité fondamentale - sans la capacité d'explorer depuis un fichier, aucune autre fonctionnalité n'a de sens.

**Independent Test**: Peut être testé en sélectionnant n'importe quel fichier des fixtures et en vérifiant que toutes ses relations sont correctement identifiées.

**Acceptance Scenarios**:

1. **Given** un fichier source dans le contexte défini, **When** l'utilisateur sélectionne ce fichier comme point de départ, **Then** le système affiche toutes les relations entrantes et sortantes de ce fichier.
2. **Given** un fichier sans aucune relation, **When** l'utilisateur l'explore, **Then** le système indique clairement qu'il n'a pas de dépendances.
3. **Given** un fichier avec des imports circulaires, **When** l'utilisateur l'explore, **Then** le système affiche la relation circulaire sans entrer en boucle infinie.

---

### User Story 2 - Définir un dossier comme contexte/boîte (Priority: P1)

En tant que développeur, je veux pouvoir définir un dossier comme périmètre d'analyse (la "boîte") pour distinguer ce qui est interne vs externe à mon module.

**Why this priority**: Sans contexte défini, impossible de distinguer les dépendances internes des externes - c'est co-fondamental avec US1.

**Independent Test**: Peut être testé en définissant différents dossiers comme contexte et vérifiant que la classification interne/externe change en conséquence.

**Acceptance Scenarios**:

1. **Given** un dossier défini comme contexte, **When** le système analyse les relations, **Then** il marque comme "internes" les relations vers des fichiers dans ce dossier et ses sous-dossiers.
2. **Given** un dossier contexte, **When** un fichier référence un autre fichier hors de ce dossier, **Then** cette relation est marquée comme "externe".
3. **Given** un contexte défini, **When** l'utilisateur change le contexte, **Then** la classification interne/externe est recalculée.

---

### User Story 3 - Explorer depuis une fonction spécifique (Priority: P2)

En tant que développeur, je veux pouvoir explorer les relations à partir d'une fonction spécifique pour comprendre son graphe d'appels et ses dépendances.

**Why this priority**: Affine l'exploration au niveau fonction plutôt que fichier - améliore la granularité mais dépend de P1.

**Independent Test**: Peut être testé en sélectionnant une fonction dans les fixtures et vérifiant que seules ses relations directes sont affichées.

**Acceptance Scenarios**:

1. **Given** une fonction dans un fichier, **When** l'utilisateur sélectionne cette fonction, **Then** le système affiche les fonctions qu'elle appelle et celles qui l'appellent.
2. **Given** une fonction qui utilise des imports, **When** l'utilisateur l'explore, **Then** le système montre quels modules/packages sont utilisés par cette fonction.

---

### User Story 4 - Visualiser les dépendances externes (Priority: P2)

En tant que développeur, je veux voir clairement quelles sont les dépendances externes (librairies tierces, autres modules) utilisées dans mon contexte pour évaluer le couplage externe.

**Why this priority**: Complète la vision en montrant les frontières du système - utile pour le refactoring et l'architecture.

**Independent Test**: Peut être testé avec des fixtures utilisant des librairies externes connues.

**Acceptance Scenarios**:

1. **Given** un contexte avec des fichiers important des librairies externes, **When** l'utilisateur visualise les dépendances, **Then** les dépendances externes sont listées distinctement.
2. **Given** des dépendances externes, **When** l'utilisateur les consulte, **Then** il peut voir quels fichiers internes utilisent chaque dépendance externe.

---

### Edge Cases

- Que se passe-t-il quand le fichier de départ n'existe pas ou est invalide ?
- Comment le système gère-t-il les imports dynamiques (ex: `import()` en JS, `importlib` en Python) ?
- Comment le système gère-t-il les fichiers avec des erreurs de syntaxe ?
- Que se passe-t-il si le contexte défini est vide ou ne contient aucun fichier de code ?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le système DOIT pouvoir analyser les relations d'import/export d'un fichier source
- **FR-002**: Le système DOIT permettre de définir un dossier comme périmètre d'analyse (contexte/boîte)
- **FR-003**: Le système DOIT classifier les relations comme "internes" (dans le contexte) ou "externes" (hors contexte)
- **FR-004**: Le système DOIT pouvoir explorer les relations au niveau d'une fonction spécifique
- **FR-005**: Le système DOIT identifier les dépendances vers des librairies tierces
- **FR-006**: Le système DOIT gérer les relations circulaires sans entrer en boucle infinie
- **FR-007**: Le système DOIT supporter JavaScript et TypeScript comme langages prioritaires
- **FR-008**: Le système DOIT être accessible via une interface en ligne de commande (CLI)
- **FR-009**: Le système DOIT supporter deux formats de sortie : texte lisible (défaut) et JSON (via flag `--json`)
- **FR-010**: Le système DOIT signaler les imports dynamiques détectés sans tenter de résoudre leur cible
- **FR-011**: Le système DOIT afficher le graphe complet des relations transitives (pas seulement les relations directes)

### Key Entities

- **Fichier Source**: Un fichier de code analysable, avec ses imports et exports
- **Relation**: Un lien entre deux éléments (fichier vers fichier, fonction vers fonction)
- **Contexte/Boîte**: Le périmètre défini par l'utilisateur qui détermine ce qui est interne vs externe
- **Dépendance Externe**: Une référence vers du code hors du contexte défini (librairie, autre module)
- **Point d'Exploration**: Le fichier ou la fonction choisi comme point de départ de l'analyse

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: L'utilisateur peut identifier toutes les dépendances d'un fichier en moins de 5 secondes après l'avoir sélectionné
- **SC-002**: La distinction interne/externe est correcte dans 100% des cas pour les imports statiques standards
- **SC-003**: L'utilisateur peut changer de contexte et voir la mise à jour en moins de 3 secondes
- **SC-004**: Le système peut analyser un projet de 1000 fichiers sans dégradation notable de performance
- **SC-005**: L'utilisateur peut naviguer de relation en relation sans perdre le fil de son exploration

## Clarifications

### Session 2026-02-02

- Q: Quels langages à supporter en priorité ? → A: JavaScript / TypeScript
- Q: Mode d'interface utilisateur ? → A: CLI (ligne de commande)
- Q: Format de sortie du CLI ? → A: Texte lisible par défaut + JSON avec flag --json
- Q: Gestion des imports dynamiques ? → A: Les signaler comme "import dynamique" sans résoudre la cible
- Q: Profondeur d'exploration ? → A: Graphe complet (toutes les relations transitives)
