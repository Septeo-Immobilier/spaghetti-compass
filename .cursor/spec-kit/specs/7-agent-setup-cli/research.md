# Research - Agent-setup CLI

**Feature**: 7-agent-setup-cli  
**Date**: 2026-02-11

## Décisions

### 1. Nom de la commande et signature CLI

**Decision**: Commande `agent-setup` (sous-commande de `spaghetti-compass`). Options : `--workflow <id>`, `--path <dir>` (ou argument positionnel optionnel). Défaut pour path : CWD.

**Rationale**: Cohérent avec la structure actuelle (Commander avec sous-commandes). Un seul point d'entrée `spaghetti-compass agent-setup` évite un binaire séparé.

**Alternatives considered**: Commande globale `spaghetti-compass-setup` (rejeté : un seul package, une seule CLI). Option `--dry-run` reportée en option future.

---

### 2. Workflows supportés (MVP)

**Decision**: MVP avec un seul workflow **cursor**. Identifiant : `cursor`. Structure des fichiers pour Cursor : `.cursor/rules/`, `.cursor/commands/`, `.agents/skills/` (conventions déjà présentes dans le projet).

**Rationale**: Le projet utilise déjà ces dossiers ; les templates peuvent s'appuyer sur les règles/skills/commandes existantes (spaghetti-compass-exploration, docker-execution, etc.). Autres workflows (claude, etc.) en phase ultérieure.

**Alternatives considered**: Supporter plusieurs workflows dès le MVP (rejeté : scope creep). Fichiers dans un sous-dossier unique (ex. `.agent-setup/cursor/`) puis copie (rejeté : Cursor attend les chemins standards).

---

### 3. Contenu des fichiers générés

**Decision**: Templates embarqués dans le package (fichiers .md ou .mdc dans `src/cli/templates/` ou package) générés par un module dédié. Pour "cursor", écrire au minimum : une règle d’exploration spaghetti-compass, la commande explore, et le skill correspondant (ou un subset cohérent avec les fichiers déjà créés manuellement).

**Rationale**: Permet des mises à jour du contenu lors des releases sans dépendre d’un réseau. Un seul jeu de templates par workflow garde la maintenance simple.

**Alternatives considered**: Télécharger templates depuis une URL (rejeté : dépendance réseau, complexité). Générer uniquement une structure vide (rejeté : faible valeur pour "une fois").

---

### 4. Comportement d’écrasement

**Decision**: Par workflow, on définit une liste de "fichiers gérés" (paths relatifs au répertoire cible). À chaque exécution, écrire uniquement ces fichiers (overwrite). Ne pas supprimer d’autres fichiers présents dans les mêmes dossiers.

**Rationale**: Comportement idempotent et prévisible ; l’utilisateur peut avoir ajouté ses propres règles/skills qu’on ne touche pas.

**Alternatives considered**: Supprimer tout le dossier puis recréer (rejeté : trop destructif). Merge avec existant (rejeté : complexité et risques de conflits).

---

### 5. Validation du chemin et codes de sortie

**Decision**: Si `--path` (ou argument) est fourni : résoudre en absolu, vérifier que c’est un répertoire existant. Sinon : message d’erreur explicite et exit code dédié (ex. 2 pour "invalid path"). Workflow inconnu : exit code dédié (ex. 5) et afficher la liste des workflows supportés dans --help et dans le message d’erreur.

**Rationale**: Scriptabilité et UX claire pour les agents et les utilisateurs.
