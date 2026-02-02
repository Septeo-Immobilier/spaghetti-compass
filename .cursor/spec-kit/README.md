# SpecKit - Spec-Driven Development pour Cursor

Ce projet est configuré avec les commandes SpecKit adaptées pour Cursor IDE.

## 🤔 Qu'est-ce que le Spec-Driven Development ?

Le Spec-Driven Development inverse la logique traditionnelle du développement logiciel. Au lieu de coder d'abord puis documenter, vous :
1. Définissez **CE QUE** vous voulez construire (spécification)
2. Planifiez **COMMENT** le construire (plan technique)
3. Décomposez en **TÂCHES** actionnables
4. **IMPLÉMENTEZ** selon le plan

## ⚡ Commandes Disponibles

Les commandes sont accessibles dans Cursor en tapant `/speckit.*` :

### Commandes Core

| Commande | Description |
|----------|-------------|
| `/speckit.constitution` | Créer ou mettre à jour les principes directeurs du projet |
| `/speckit.specify` | Définir ce que vous voulez construire (requirements et user stories) |
| `/speckit.plan` | Créer un plan d'implémentation technique avec votre stack choisie |
| `/speckit.tasks` | Générer une liste de tâches actionnables pour l'implémentation |
| `/speckit.implement` | Exécuter toutes les tâches pour construire la fonctionnalité |

### Commandes Optionnelles

| Commande | Description |
|----------|-------------|
| `/speckit.clarify` | Clarifier les zones sous-spécifiées (recommandé avant `/speckit.plan`) |
| `/speckit.analyze` | Analyse de cohérence cross-artifact (exécuter après `/speckit.tasks`) |
| `/speckit.checklist` | Générer des checklists de qualité personnalisées |

## 🔄 Workflow Recommandé

### 1. Établir les principes du projet

```
/speckit.constitution Créer des principes focalisés sur la qualité de code, standards de test, cohérence UX, et requirements de performance
```

### 2. Créer la spec

```
/speckit.specify Construire une application qui peut m'aider à organiser mes photos en albums. Les albums sont groupés par date et peuvent être réorganisés par glisser-déposer.
```

### 3. Clarifier les ambiguïtés (optionnel mais recommandé)

```
/speckit.clarify
```

### 4. Créer le plan technique

```
/speckit.plan L'application utilise Vite avec un minimum de bibliothèques. Utiliser vanilla HTML, CSS, et JavaScript autant que possible. Les images ne sont pas uploadées et les métadonnées sont stockées dans une base SQLite locale.
```

### 5. Générer les tâches

```
/speckit.tasks
```

### 6. Analyser la cohérence (optionnel)

```
/speckit.analyze
```

### 7. Implémenter

```
/speckit.implement
```

## 📁 Structure du Projet

```
.specify/
├── memory/
│   └── constitution.md      # Principes directeurs du projet
├── specs/
│   └── [NNN-feature]/       # Specs par fonctionnalité
│       ├── spec.md          # Spécification fonctionnelle
│       ├── plan.md          # Plan d'implémentation
│       ├── tasks.md         # Liste de tâches
│       ├── research.md      # Recherche technique
│       ├── data-model.md    # Modèle de données
│       ├── quickstart.md    # Guide de démarrage rapide
│       ├── contracts/       # Contrats API
│       └── checklists/      # Checklists de qualité
└── templates/               # Templates de documents
    ├── spec-template.md
    ├── plan-template.md
    ├── tasks-template.md
    └── checklist-template.md

.cursor/
└── rules/                   # Commandes Cursor SpecKit
    ├── speckit-constitution.mdc
    ├── speckit-specify.mdc
    ├── speckit-plan.mdc
    ├── speckit-tasks.mdc
    ├── speckit-implement.mdc
    ├── speckit-clarify.mdc
    ├── speckit-analyze.mdc
    └── speckit-checklist.mdc
```

## 📚 Philosophie Core

Le Spec-Driven Development met l'accent sur :

- **Développement orienté intention** : les specs définissent le "quoi" avant le "comment"
- **Raffinement multi-étapes** plutôt que génération one-shot depuis des prompts
- **Spécifications exécutables** qui génèrent directement des implémentations fonctionnelles
- **Indépendance technologique** : les specs sont agnostiques de la stack technique

## 🎯 Phases de Développement

| Phase | Focus | Activités Clés |
|-------|-------|----------------|
| 0-to-1 (Greenfield) | Générer from scratch | Requirements → Specs → Plan → Build |
| Creative Exploration | Implémentations parallèles | Explorer solutions diverses |
| Iterative Enhancement (Brownfield) | Modernisation | Ajouter features, moderniser legacy |

## 📄 Licence

Ce projet utilise les templates et commandes basés sur [github/spec-kit](https://github.com/github/spec-kit), sous licence MIT.
