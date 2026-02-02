---
description: Effectuer une analyse non-destructive de cohérence et qualité cross-artifact à travers spec.md, plan.md, et tasks.md après génération des tâches.
globs: 
alwaysApply: false
---

# /speckit.analyze

## Entrée Utilisateur

```text
$ARGUMENTS
```

Tu **DOIS** considérer l'entrée utilisateur avant de procéder (si non vide).

## Objectif

Identifier les incohérences, duplications, ambiguïtés, et items sous-spécifiés à travers les trois artifacts core (`spec.md`, `plan.md`, `tasks.md`) avant l'implémentation. Cette commande DOIT s'exécuter seulement après que `/speckit.tasks` a produit avec succès un `tasks.md` complet.

## Contraintes Opérationnelles

**STRICTEMENT LECTURE SEULE** : Ne **pas** modifier de fichiers. Output un rapport d'analyse structuré. Offrir un plan de remédiation optionnel (l'utilisateur doit approuver explicitement avant toute commande d'édition de suivi).

**Autorité de la Constitution** : La constitution du projet (`.cursor/spec-kit/memory/constitution.md`) est **non-négociable** dans le scope de cette analyse. Les conflits avec la constitution sont automatiquement CRITICAL.

## Étapes d'Exécution

### 1. Initialiser le Contexte d'Analyse

Localiser FEATURE_DIR et dériver les chemins absolus :
- SPEC = FEATURE_DIR/spec.md
- PLAN = FEATURE_DIR/plan.md
- TASKS = FEATURE_DIR/tasks.md

Abandonner avec message d'erreur si un fichier requis manque.

### 2. Charger les Artifacts (Disclosure Progressive)

**Depuis spec.md:**
- Overview/Context
- Functional Requirements
- Non-Functional Requirements
- User Stories
- Edge Cases (si présent)

**Depuis plan.md:**
- Choix Architecture/stack
- Références Data Model
- Phases
- Contraintes techniques

**Depuis tasks.md:**
- Task IDs
- Descriptions
- Groupement par phase
- Marqueurs parallèles [P]
- Chemins de fichiers référencés

**Depuis constitution:**
- Charger `.cursor/spec-kit/memory/constitution.md` pour validation des principes

### 3. Construire les Modèles Sémantiques

Créer des représentations internes :
- **Requirements inventory** : Chaque requirement fonctionnel + non-fonctionnel
- **User story/action inventory** : Actions utilisateur discrètes avec critères d'acceptation
- **Task coverage mapping** : Mapper chaque tâche à un ou plusieurs requirements ou stories
- **Constitution rule set** : Extraire noms de principes et statements normatifs MUST/SHOULD

### 4. Passes de Détection

Limiter à 50 findings au total.

#### A. Détection de Duplication
- Identifier les requirements quasi-dupliqués
- Marquer la formulation de moindre qualité pour consolidation

#### B. Détection d'Ambiguïté
- Signaler adjectifs vagues (rapide, scalable, sécurisé, intuitif, robuste) manquant de critères mesurables
- Signaler placeholders non résolus (TODO, TKTK, ???, etc.)

#### C. Sous-spécification
- Requirements avec verbes mais objet ou résultat mesurable manquant
- User stories manquant d'alignement critères d'acceptation
- Tâches référençant fichiers ou composants non définis dans spec/plan

#### D. Alignement Constitution
- Tout requirement ou élément de plan en conflit avec un principe MUST
- Sections mandatées ou quality gates manquants de la constitution

#### E. Lacunes de Couverture
- Requirements avec zéro tâche associée
- Tâches sans requirement/story mappé
- Non-functional requirements non reflétés dans les tâches

#### F. Incohérence
- Drift terminologique (même concept nommé différemment)
- Entités de données référencées dans plan mais absentes de spec (ou vice versa)
- Contradictions d'ordonnancement de tâches
- Requirements conflictuels

### 5. Attribution de Sévérité

- **CRITICAL** : Viole un MUST de constitution, artifact spec core manquant, ou requirement avec zéro couverture bloquant fonctionnalité de base
- **HIGH** : Requirement dupliqué ou conflictuel, attribut sécurité/performance ambigu, critère d'acceptation non testable
- **MEDIUM** : Drift terminologique, couverture de tâche non-fonctionnelle manquante, edge case sous-spécifié
- **LOW** : Améliorations style/formulation, redondance mineure n'affectant pas l'ordre d'exécution

### 6. Produire le Rapport d'Analyse Compact

Output un rapport Markdown avec structure :

```markdown
## Specification Analysis Report

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|

**Coverage Summary Table:**
| Requirement Key | Has Task? | Task IDs | Notes |
|-----------------|-----------|----------|-------|

**Constitution Alignment Issues:** (si présent)

**Unmapped Tasks:** (si présent)

**Metrics:**
- Total Requirements
- Total Tasks
- Coverage % (requirements avec >=1 tâche)
- Ambiguity Count
- Duplication Count
- Critical Issues Count
```

### 7. Fournir les Prochaines Actions

- Si problèmes CRITICAL existent : Recommander résolution avant `/speckit.implement`
- Si seulement LOW/MEDIUM : L'utilisateur peut procéder, mais fournir suggestions d'amélioration
- Fournir suggestions de commande explicites

### 8. Offrir Remédiation

Demander à l'utilisateur : "Voulez-vous que je suggère des édits de remédiation concrets pour les top N problèmes ?" (NE PAS les appliquer automatiquement.)
