# Feature Specification: Agent Setup — Skill-Only Output with Destination Picker

**Feature Branch**: `8-agent-setup-skill-only`  
**Created**: 2026-06-24  
**Status**: Draft  
**Input**: User description: "Modifier la commande agent-setup : à la place d'écrire commands et rules, juste un skill. Interaction utilisateur (input) avec sélection multiple pour les emplacements standard (.claude/skills, .cursor/skills, .agents/skills)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Skill-only output (Priority: P1)

L'utilisateur lance `agent-setup` et obtient uniquement un fichier skill (SKILL.md) au lieu d'un ensemble de rules + commands + skills.

**Why this priority**: C'est le changement fondamental demandé — simplifier l'output pour ne produire qu'un skill.

**Independent Test**: Lancer `agent-setup` avec un workflow et vérifier que seul un fichier SKILL.md est écrit, sans rules ni commands.

**Acceptance Scenarios**:

1. **Given** un répertoire cible vide, **When** l'utilisateur lance `agent-setup . cursor`, **Then** seul un fichier de skill (pas de `.cursor/rules/` ni `.cursor/commands/`) est créé.
2. **Given** un répertoire cible avec un skill existant, **When** l'utilisateur relance `agent-setup`, **Then** le skill est écrasé sans créer de fichiers rules/commands.

---

### User Story 2 - Sélection interactive de destination (Priority: P1)

L'utilisateur choisit via un prompt interactif (sélection multiple) dans quels emplacements standard le skill doit être écrit.

**Why this priority**: L'utilisateur a plusieurs outils (Claude, Cursor, agents) et doit pouvoir déposer le skill dans un ou plusieurs emplacements d'un coup.

**Independent Test**: Lancer la commande en mode interactif, sélectionner plusieurs destinations, vérifier que le SKILL.md est écrit dans chacune.

**Acceptance Scenarios**:

1. **Given** l'utilisateur lance `agent-setup` sans option de destination, **When** le prompt s'affiche, **Then** il propose au moins les 3 emplacements : `.claude/skills/`, `.cursor/skills-cursor/`, `.agents/skills/`.
2. **Given** l'utilisateur sélectionne 2 destinations sur 3, **When** la commande s'exécute, **Then** le skill est écrit exactement dans les 2 emplacements choisis.
3. **Given** l'utilisateur ne sélectionne aucun emplacement, **When** il valide, **Then** la commande affiche une erreur explicite et ne crée rien.

---

### User Story 3 - Compatibilité avec invocation non-interactive (Priority: P2)

L'utilisateur peut passer les destinations en argument CLI pour un usage scriptable (CI, automation).

**Why this priority**: Permet l'usage dans des pipelines ou des scripts sans interaction humaine.

**Independent Test**: Lancer la commande avec des flags `--dest` et vérifier que le skill est écrit sans prompt.

**Acceptance Scenarios**:

1. **Given** l'utilisateur passe `--dest .claude/skills --dest .agents/skills`, **When** la commande s'exécute, **Then** le skill est écrit dans les 2 destinations sans prompt interactif.
2. **Given** l'utilisateur passe un `--dest` invalide (chemin inexistant), **When** la commande s'exécute, **Then** une erreur explicite est affichée et aucun fichier n'est créé.

---

### Edge Cases

- Que se passe-t-il si le répertoire de destination n'existe pas encore ? → Il doit être créé automatiquement (mkdir -p).
- Que se passe-t-il si l'utilisateur est dans un pipe (stdin non-TTY) sans --dest ? → Erreur explicite demandant de passer --dest.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La commande `agent-setup` DOIT écrire uniquement un fichier skill (SKILL.md) — plus de rules ni commands.
- **FR-002**: En mode interactif, la commande DOIT proposer un prompt à sélection multiple avec les emplacements : `.claude/skills/<skill-name>/`, `.cursor/skills-cursor/<skill-name>/`, `.agents/skills/<skill-name>/`.
- **FR-003**: L'utilisateur DOIT pouvoir sélectionner un ou plusieurs emplacements dans le prompt.
- **FR-004**: En mode non-interactif, la commande DOIT accepter un ou plusieurs flags `--dest` pour spécifier les emplacements.
- **FR-005**: Les répertoires de destination DOIVENT être créés automatiquement s'ils n'existent pas.
- **FR-006**: La commande DOIT refuser de s'exécuter si aucun emplacement n'est sélectionné (erreur explicite).
- **FR-007**: Le contenu du skill (template) DOIT rester identique quel que soit l'emplacement de destination choisi.

### Key Entities

- **Skill**: Un fichier SKILL.md contenant la documentation et les instructions d'utilisation du CLI spaghetti-compass pour les agents.
- **Destination**: Un emplacement standard dans le projet cible (`.claude/skills/`, `.cursor/skills-cursor/`, `.agents/skills/`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: La commande `agent-setup` ne produit plus aucun fichier dans `.cursor/rules/` ni `.cursor/commands/`.
- **SC-002**: 100% des destinations sélectionnées reçoivent un SKILL.md identique après exécution.
- **SC-003**: L'utilisateur peut compléter le choix de destination en moins de 10 secondes en mode interactif.
- **SC-004**: La commande fonctionne en mode scriptable (--dest) sans aucune interaction humaine.
