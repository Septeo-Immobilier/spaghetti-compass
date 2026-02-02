# Feature Specification: [FEATURE NAME]

**Feature Branch**: `[###-feature-name]` 
**Created**: [DATE] 
**Status**: Draft 
**Input**: User description: "$ARGUMENTS"

## User Scenarios & Testing *(mandatory)*

<!-- Chaque user story représente un parcours utilisateur distinct avec sa propre valeur et ses propres critères de test -->

### User Story 1 - [Brief Title] (Priority: P1)

[Décrire ce parcours utilisateur en langage simple]

**Why this priority**: [Expliquer la valeur et pourquoi ce niveau de priorité]

**Independent Test**: [Décrire comment cela peut être testé indépendamment - ex: "Peut être entièrement testé par [action spécifique] et délivre [valeur spécifique]"]

**Acceptance Scenarios**:

1. **Given** [état initial], **When** [action], **Then** [résultat attendu]
2. **Given** [état initial], **When** [action], **Then** [résultat attendu]

---

### User Story 2 - [Brief Title] (Priority: P2)

[Décrire ce parcours utilisateur en langage simple]

**Why this priority**: [Expliquer la valeur et pourquoi ce niveau de priorité]

**Independent Test**: [Décrire comment cela peut être testé indépendamment]

**Acceptance Scenarios**:

1. **Given** [état initial], **When** [action], **Then** [résultat attendu]

---

### User Story 3 - [Brief Title] (Priority: P3)

[Décrire ce parcours utilisateur en langage simple]

**Why this priority**: [Expliquer la valeur et pourquoi ce niveau de priorité]

**Independent Test**: [Décrire comment cela peut être testé indépendamment]

**Acceptance Scenarios**:

1. **Given** [état initial], **When** [action], **Then** [résultat attendu]

---

[Ajouter plus de user stories si nécessaire, chacune avec une priorité assignée]

### Edge Cases

<!-- Identifier les cas limites et scénarios d'erreur -->

- Que se passe-t-il quand [condition limite] ?
- Comment le système gère-t-il [scénario d'erreur] ?

## Requirements *(mandatory)*

<!-- Les requirements fonctionnels définissent CE QUE le système doit faire -->

### Functional Requirements

- **FR-001**: Le système DOIT [capacité spécifique, ex: "permettre aux utilisateurs de créer des comptes"]
- **FR-002**: Le système DOIT [capacité spécifique, ex: "valider les adresses email"] 
- **FR-003**: Les utilisateurs DOIVENT pouvoir [interaction clé, ex: "réinitialiser leur mot de passe"]
- **FR-004**: Le système DOIT [requirement de données, ex: "persister les préférences utilisateur"]
- **FR-005**: Le système DOIT [comportement, ex: "logger tous les événements de sécurité"]

*Exemple de marquage de requirements peu clairs :*

- **FR-006**: Le système DOIT authentifier les utilisateurs via [NEEDS CLARIFICATION: méthode d'auth non spécifiée - email/password, SSO, OAuth?]
- **FR-007**: Le système DOIT retenir les données utilisateur pendant [NEEDS CLARIFICATION: période de rétention non spécifiée]

### Key Entities *(include if feature involves data)*

- **[Entity 1]**: [Ce qu'elle représente, attributs clés sans implémentation]
- **[Entity 2]**: [Ce qu'elle représente, relations avec autres entités]

## Success Criteria *(mandatory)*

<!-- Les critères de succès doivent être mesurables et agnostiques de la technologie -->

### Measurable Outcomes

- **SC-001**: [Métrique mesurable, ex: "Les utilisateurs peuvent compléter la création de compte en moins de 2 minutes"]
- **SC-002**: [Métrique mesurable, ex: "Le système gère 1000 utilisateurs concurrents sans dégradation"]
- **SC-003**: [Métrique de satisfaction utilisateur, ex: "90% des utilisateurs complètent la tâche principale au premier essai"]
- **SC-004**: [Métrique business, ex: "Réduire les tickets de support liés à [X] de 50%"]
