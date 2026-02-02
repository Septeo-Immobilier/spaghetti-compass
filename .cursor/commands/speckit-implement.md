---
description: Exécuter le plan d'implémentation en traitant et exécutant toutes les tâches définies dans tasks.md
globs: 
alwaysApply: false
---

# /speckit.implement

## Entrée Utilisateur

```text
$ARGUMENTS
```

Tu **DOIS** considérer l'entrée utilisateur avant de procéder (si non vide).

## Résumé

Cette commande exécute le plan d'implémentation en traitant toutes les tâches du fichier `tasks.md` dans l'ordre correct, en respectant les dépendances et les marqueurs d'exécution parallèle.

## Workflow d'Exécution

### 1. Localiser les fichiers
- Identifier FEATURE_DIR depuis la branche git actuelle
- Vérifier que `tasks.md` existe
- Lister AVAILABLE_DOCS

### 2. Vérifier le statut des checklists (si `.cursor/spec-kit/specs/[FEATURE]/checklists/` existe)
- Scanner tous les fichiers checklist dans le répertoire checklists/
- Pour chaque checklist, compter :
  - Total items : Toutes les lignes correspondant à `- [ ]` ou `- [X]` ou `- [x]`
  - Items complétés : Lignes correspondant à `- [X]` ou `- [x]`
  - Items incomplets : Lignes correspondant à `- [ ]`
- Créer une table de statut :

```text
| Checklist | Total | Completed | Incomplete | Status |
|-----------|-------|-----------|------------|--------|
| ux.md     | 12    | 12        | 0          | ✓ PASS |
| test.md   | 8     | 5         | 3          | ✗ FAIL |
```

- **Si une checklist est incomplète** :
  - Afficher la table avec le nombre d'items incomplets
  - **STOP** et demander : "Certaines checklists sont incomplètes. Voulez-vous procéder avec l'implémentation quand même ? (oui/non)"
  - Attendre la réponse utilisateur avant de continuer

- **Si toutes les checklists sont complètes** :
  - Afficher la table montrant toutes les checklists passées
  - Procéder automatiquement à l'étape 3

### 3. Charger et analyser le contexte d'implémentation
- **REQUIRED** : Lire `tasks.md` pour la liste complète des tâches
- **REQUIRED** : Lire `plan.md` pour la tech stack, architecture
- **IF EXISTS** : Lire `data-model.md` pour les entités
- **IF EXISTS** : Lire `contracts/` pour les specs API
- **IF EXISTS** : Lire `research.md` pour les décisions techniques
- **IF EXISTS** : Lire `quickstart.md` pour les scénarios d'intégration

### 4. Vérification Setup Projet
- **REQUIRED** : Créer/vérifier les fichiers ignore basés sur le setup réel du projet

**Patterns Communs par Technologie** (depuis plan.md tech stack) :
- **Node.js/JavaScript/TypeScript** : `node_modules/`, `dist/`, `build/`, `*.log`, `.env*`
- **Python** : `__pycache__/`, `*.pyc`, `.venv/`, `venv/`, `dist/`, `*.egg-info/`
- **Java** : `target/`, `*.class`, `*.jar`, `.gradle/`, `build/`
- **C#/.NET** : `bin/`, `obj/`, `*.user`, `*.suo`, `packages/`
- **Go** : `*.exe`, `*.test`, `vendor/`, `*.out`
- **Rust** : `target/`, `debug/`, `release/`, `*.rs.bk`

### 5. Parser la structure de tasks.md
- **Task phases** : Setup, Tests, Core, Integration, Polish
- **Task dependencies** : Règles d'exécution séquentielle vs parallèle
- **Task details** : ID, description, chemins de fichiers, marqueurs parallèles [P]
- **Execution flow** : Ordre et requirements de dépendance

### 6. Exécuter l'implémentation suivant le plan de tâches
- **Phase-by-phase execution** : Compléter chaque phase avant de passer à la suivante
- **Respect dependencies** : Exécuter les tâches séquentielles dans l'ordre, les tâches parallèles [P] peuvent s'exécuter ensemble
- **Follow TDD approach** : Si demandé, exécuter les tâches de test avant leurs tâches d'implémentation correspondantes
- **File-based coordination** : Les tâches affectant les mêmes fichiers doivent s'exécuter séquentiellement
- **Validation checkpoints** : Vérifier la complétion de chaque phase avant de procéder

### 7. Règles d'exécution d'implémentation
- **Setup first** : Initialiser structure projet, dépendances, configuration
- **Tests before code** : Si besoin d'écrire des tests pour contrats, entités, scénarios d'intégration
- **Core development** : Implémenter modèles, services, commandes CLI, endpoints
- **Integration work** : Connexions base de données, middleware, logging, services externes
- **Polish and validation** : Tests unitaires, optimisation performance, documentation

### 8. Suivi de progression et gestion d'erreurs
- Rapporter la progression après chaque tâche complétée
- Arrêter l'exécution si une tâche non-parallèle échoue
- Pour les tâches parallèles [P], continuer avec les tâches réussies, rapporter les échecs
- Fournir des messages d'erreur clairs avec contexte pour le debugging
- Suggérer les prochaines étapes si l'implémentation ne peut pas procéder
- **IMPORTANT** : Pour les tâches complétées, marquer la tâche comme [X] dans le fichier tasks

### 9. Validation de complétion
- Vérifier que toutes les tâches requises sont complétées
- Vérifier que les fonctionnalités implémentées correspondent à la spécification originale
- Valider que les tests passent et que la couverture respecte les requirements
- Confirmer que l'implémentation suit le plan technique
- Rapporter le statut final avec résumé du travail complété

**Note** : Cette commande suppose qu'une décomposition de tâches complète existe dans `tasks.md`. Si les tâches sont incomplètes ou manquantes, suggérer d'exécuter `/speckit.tasks` d'abord pour régénérer la liste de tâches.
