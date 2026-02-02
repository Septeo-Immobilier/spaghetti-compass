---
description: Exécuter le workflow de planification d'implémentation en utilisant le template de plan pour générer les artifacts de conception.
globs: 
alwaysApply: false
---

# /speckit.plan

## Entrée Utilisateur

```text
$ARGUMENTS
```

Tu **DOIS** considérer l'entrée utilisateur avant de procéder (si non vide). L'entrée contient typiquement la stack technologique et les choix d'architecture.

## Résumé

Cette commande crée un plan d'implémentation technique basé sur la spécification de fonctionnalité existante. Elle génère plusieurs documents de conception incluant la recherche, le modèle de données, et les contrats.

## Workflow d'Exécution

### 1. Setup
- Identifier le répertoire de fonctionnalité actuel (branche git ou variable d'environnement SPECIFY_FEATURE)
- Localiser FEATURE_SPEC (`.cursor/spec-kit/specs/[NNN-feature]/spec.md`)
- Parser le fichier plan.md template

### 2. Charger le contexte
- Lire FEATURE_SPEC pour les requirements et user stories
- Lire `.cursor/spec-kit/memory/constitution.md` pour les principes du projet
- Charger le template IMPL_PLAN depuis `.cursor/spec-kit/templates/plan-template.md`

### 3. Exécuter le workflow de plan

#### Phase 0: Outline & Research
1. **Extraire les inconnus** du Technical Context :
   - Pour chaque NEEDS CLARIFICATION → tâche de recherche
   - Pour chaque dépendance → tâche de best practices
   - Pour chaque intégration → tâche de patterns

2. **Générer et dispatcher les agents de recherche** :
   - Pour chaque inconnu dans Technical Context
   - Pour chaque choix technologique

3. **Consolider les résultats** dans `research.md` avec format :
   - Decision : [ce qui a été choisi]
   - Rationale : [pourquoi choisi]
   - Alternatives considered : [quoi d'autre évalué]

**Output** : `research.md` avec tous les NEEDS CLARIFICATION résolus

#### Phase 1: Design & Contracts
**Prérequis** : `research.md` complet

1. **Extraire les entités** de la spec → `data-model.md` :
   - Nom d'entité, champs, relations
   - Règles de validation des requirements
   - Transitions d'état si applicable

2. **Générer les contrats API** des functional requirements :
   - Pour chaque action utilisateur → endpoint
   - Utiliser les patterns REST/GraphQL standards
   - Output OpenAPI/GraphQL schema vers `/contracts/`

3. **Créer quickstart.md** avec les scénarios d'intégration de base

**Output** : `data-model.md`, `/contracts/*`, `quickstart.md`

### 4. Constitution Check
*GATE: Doit passer avant la recherche Phase 0. Re-vérifier après le design Phase 1.*

- Vérifier l'alignement avec les principes de la constitution
- ERROR si violations non justifiées
- Documenter toute exception dans la section Complexity Tracking

### 5. Stop et Rapport
La commande se termine après la planification Phase 1. Rapporter :
- Branche
- Chemin IMPL_PLAN
- Artifacts générés

## Règles Clés

- Utiliser des chemins absolus
- ERROR sur les échecs de gate ou clarifications non résolues
- Ne PAS passer aux tâches - utiliser `/speckit.tasks` pour cela
