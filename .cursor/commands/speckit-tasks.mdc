---
description: Générer un tasks.md actionnable et ordonné par dépendances pour la fonctionnalité basé sur les artifacts de conception disponibles.
globs: 
alwaysApply: false
---

# /speckit.tasks

## Entrée Utilisateur

```text
$ARGUMENTS
```

Tu **DOIS** considérer l'entrée utilisateur avant de procéder (si non vide).

## Résumé

Cette commande génère une liste de tâches détaillée et ordonnée par dépendances à partir des documents de conception existants. Les tâches sont organisées par user story pour permettre une implémentation et des tests indépendants.

## Workflow d'Exécution

### 1. Setup
- Identifier le répertoire de fonctionnalité (FEATURE_DIR)
- Vérifier les documents disponibles (AVAILABLE_DOCS)
- Tous les chemins doivent être absolus

### 2. Charger les documents de conception
- **Required** : `plan.md` (tech stack, libraries, structure), `spec.md` (user stories avec priorités)
- **Optional** : `data-model.md` (entités), `contracts/` (endpoints API), `research.md` (décisions), `quickstart.md` (scénarios de test)

### 3. Exécuter le workflow de génération de tâches
1. Charger `plan.md` et extraire tech stack, libraries, structure du projet
2. Charger `spec.md` et extraire user stories avec leurs priorités (P1, P2, P3, etc.)
3. Si `data-model.md` existe : Extraire entités et mapper aux user stories
4. Si `contracts/` existe : Mapper endpoints aux user stories
5. Si `research.md` existe : Extraire décisions pour les tâches de setup
6. Générer les tâches organisées par user story
7. Générer le graphe de dépendances
8. Créer les exemples d'exécution parallèle
9. Valider la complétude des tâches

### 4. Générer tasks.md
Utiliser `.cursor/spec-kit/templates/tasks-template.md` comme structure, remplir avec :
- Nom de fonctionnalité correct depuis plan.md
- Phase 1 : Tâches Setup (initialisation projet)
- Phase 2 : Tâches Foundational (prérequis bloquants pour toutes les user stories)
- Phase 3+ : Une phase par user story (dans l'ordre de priorité)
- Chaque phase inclut : objectif story, critères de test indépendants, tests (si demandés), tâches d'implémentation
- Phase Finale : Polish & cross-cutting concerns

## Règles de Génération de Tâches

**CRITICAL** : Les tâches DOIVENT être organisées par user story pour permettre une implémentation et des tests indépendants.

**Les Tests sont OPTIONNELS** : Générer les tâches de test seulement si explicitement demandé.

### Format Checklist (REQUIS)

Chaque tâche DOIT suivre strictement ce format :

```text
- [ ] [TaskID] [P?] [Story?] Description avec chemin de fichier
```

**Composants du Format** :
1. **Checkbox** : TOUJOURS commencer avec `- [ ]`
2. **Task ID** : Numéro séquentiel (T001, T002, T003...) dans l'ordre d'exécution
3. **Marqueur [P]** : Inclure SEULEMENT si la tâche est parallélisable
4. **Label [Story]** : REQUIS pour les tâches de phase user story seulement
   - Format : [US1], [US2], [US3], etc.
   - Phase Setup : PAS de label story
   - Phase Foundational : PAS de label story
   - Phases User Story : DOIT avoir label story
   - Phase Polish : PAS de label story
5. **Description** : Action claire avec chemin de fichier exact

**Exemples** :
- ✅ CORRECT : `- [ ] T001 Créer structure projet selon plan d'implémentation`
- ✅ CORRECT : `- [ ] T005 [P] Implémenter middleware auth dans src/middleware/auth.py`
- ✅ CORRECT : `- [ ] T012 [P] [US1] Créer modèle User dans src/models/user.py`
- ❌ FAUX : `- [ ] Créer modèle User` (manque ID et label Story)
- ❌ FAUX : `T001 [US1] Créer modèle` (manque checkbox)

### Structure des Phases

- **Phase 1** : Setup (initialisation projet)
- **Phase 2** : Foundational (prérequis bloquants - DOIT compléter avant user stories)
- **Phase 3+** : User Stories dans l'ordre de priorité (P1, P2, P3...)
- **Phase Finale** : Polish & Cross-Cutting Concerns

### 5. Rapport
Output chemin vers tasks.md généré et résumé :
- Nombre total de tâches
- Nombre de tâches par user story
- Opportunités parallèles identifiées
- Critères de test indépendants pour chaque story
- Scope MVP suggéré
