---
description: Générer une checklist personnalisée pour la fonctionnalité actuelle basée sur les requirements utilisateur.
globs: 
alwaysApply: false
---

# /speckit.checklist

## Objectif de la Checklist : "Tests Unitaires pour l'Anglais"

**CONCEPT CRITIQUE** : Les checklists sont des **TESTS UNITAIRES POUR L'ÉCRITURE DE REQUIREMENTS** - elles valident la qualité, clarté, et complétude des requirements dans un domaine donné.

**PAS pour vérification/test** :
- ❌ PAS "Vérifier que le bouton clique correctement"
- ❌ PAS "Tester que la gestion d'erreurs fonctionne"
- ❌ PAS "Confirmer que l'API retourne 200"
- ❌ PAS vérifier si le code/implémentation correspond à la spec

**POUR la validation de qualité des requirements** :
- ✅ "Les requirements de hiérarchie visuelle sont-ils définis pour tous les types de cartes ?" (complétude)
- ✅ "'Affichage proéminent' est-il quantifié avec sizing/positionnement spécifiques ?" (clarté)
- ✅ "Les requirements d'état hover sont-ils cohérents à travers tous les éléments interactifs ?" (cohérence)
- ✅ "Les requirements d'accessibilité sont-ils définis pour la navigation clavier ?" (couverture)
- ✅ "La spec définit-elle ce qui se passe quand l'image logo échoue à charger ?" (edge cases)

## Entrée Utilisateur

```text
$ARGUMENTS
```

Tu **DOIS** considérer l'entrée utilisateur avant de procéder (si non vide).

## Étapes d'Exécution

### 1. Setup
- Localiser FEATURE_DIR depuis la branche git actuelle
- Identifier les documents disponibles (AVAILABLE_DOCS)
- Tous les chemins doivent être absolus

### 2. Clarifier l'intention (dynamique)
Dériver jusqu'à TROIS questions contextuelles de clarification initiales. Elles DOIVENT :
- Être générées depuis la formulation utilisateur + signaux extraits de spec/plan/tasks
- Ne demander que les informations qui changent matériellement le contenu de la checklist
- Être sautées individuellement si déjà non ambiguës dans `$ARGUMENTS`

### 3. Comprendre la requête utilisateur
Combiner `$ARGUMENTS` + réponses clarifiantes :
- Dériver le thème de checklist (ex: security, review, deploy, ux)
- Consolider les items must-have explicites mentionnés par l'utilisateur
- Mapper les sélections de focus à l'échafaudage de catégorie

### 4. Charger le contexte de fonctionnalité
Lire depuis FEATURE_DIR :
- `spec.md` : Requirements de fonctionnalité et scope
- `plan.md` (si existe) : Détails techniques, dépendances
- `tasks.md` (si existe) : Tâches d'implémentation

### 5. Générer la checklist - Créer "Tests Unitaires pour Requirements"
- Créer le répertoire `.cursor/spec-kit/specs/[FEATURE]/checklists/` s'il n'existe pas
- Générer un nom de fichier checklist unique basé sur le domaine (ex: `ux.md`, `api.md`, `security.md`)
- Numéroter les items séquentiellement à partir de CHK001
- Chaque exécution `/speckit.checklist` crée un NOUVEAU fichier

**PRINCIPE CORE - Tester les Requirements, Pas l'Implémentation** :
Chaque item de checklist DOIT évaluer les REQUIREMENTS EUX-MÊMES pour :
- **Completeness** : Tous les requirements nécessaires sont-ils présents ?
- **Clarity** : Les requirements sont-ils non ambigus et spécifiques ?
- **Consistency** : Les requirements s'alignent-ils entre eux ?
- **Measurability** : Les requirements peuvent-ils être objectivement vérifiés ?
- **Coverage** : Tous les scénarios/edge cases sont-ils adressés ?

**Structure de Catégorie** - Grouper items par dimensions de qualité de requirements :
- **Requirement Completeness**
- **Requirement Clarity**
- **Requirement Consistency**
- **Acceptance Criteria Quality**
- **Scenario Coverage**
- **Edge Case Coverage**
- **Non-Functional Requirements**
- **Dependencies & Assumptions**
- **Ambiguities & Conflicts**

**PATTERNS REQUIS** :
- ✅ "Les [type de requirement] sont-ils définis/spécifiés/documentés pour [scénario] ?"
- ✅ "[Terme vague] est-il quantifié/clarifié avec des critères spécifiques ?"
- ✅ "Les requirements sont-ils cohérents entre [section A] et [section B] ?"
- ✅ "[Requirement] peut-il être objectivement mesuré/vérifié ?"

**ABSOLUMENT INTERDIT** :
- ❌ Tout item commençant par "Vérifier", "Tester", "Confirmer" + comportement d'implémentation
- ❌ Références à l'exécution de code, actions utilisateur, comportement système
- ❌ "S'affiche correctement", "fonctionne proprement"
- ❌ "Click", "navigate", "render", "load", "execute"

### 6. Référence de Structure
Générer la checklist suivant le template canonique dans `.cursor/spec-kit/templates/checklist-template.md`

### 7. Rapport
Output chemin complet vers la checklist créée, nombre d'items, et rappeler à l'utilisateur que chaque exécution crée un nouveau fichier.
