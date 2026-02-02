---
description: Identifier les zones sous-spécifiées dans la spec de fonctionnalité actuelle en posant jusqu'à 5 questions de clarification ciblées.
globs: 
alwaysApply: false
---

# /speckit.clarify

## Entrée Utilisateur

```text
$ARGUMENTS
```

Tu **DOIS** considérer l'entrée utilisateur avant de procéder (si non vide).

## Objectif

Détecter et réduire l'ambiguïté ou les points de décision manquants dans la spécification de fonctionnalité active et enregistrer les clarifications directement dans le fichier spec.

**Note** : Ce workflow de clarification doit s'exécuter (et être complété) AVANT d'invoquer `/speckit.plan`. Si l'utilisateur indique explicitement qu'il saute la clarification, tu peux procéder mais dois avertir que le risque de rework augmente.

## Étapes d'Exécution

### 1. Localiser les fichiers
- Identifier FEATURE_DIR depuis la branche git actuelle
- Localiser FEATURE_SPEC (`.cursor/spec-kit/specs/[NNN-feature]/spec.md`)
- Si parsing JSON échoue, abandonner et instruire l'utilisateur de re-exécuter `/speckit.specify`

### 2. Charger le fichier spec et scanner

Effectuer un scan structuré d'ambiguïté & couverture utilisant cette taxonomie. Pour chaque catégorie, marquer le statut : Clear / Partial / Missing.

**Functional Scope & Behavior:**
- Objectifs utilisateur clés & critères de succès
- Déclarations explicites hors-scope
- Différenciation rôles utilisateurs / personas

**Domain & Data Model:**
- Entités, attributs, relations
- Règles d'identité & unicité
- Transitions de lifecycle/état
- Hypothèses de volume / scale de données

**Interaction & UX Flow:**
- Parcours utilisateur critiques / séquences
- États d'erreur/vide/chargement
- Notes d'accessibilité ou localisation

**Non-Functional Quality Attributes:**
- Performance (latence, objectifs de throughput)
- Scalabilité (horizontale/verticale, limites)
- Fiabilité & disponibilité
- Observabilité (logging, métriques, tracing)
- Sécurité & vie privée
- Contraintes de conformité / réglementaires

**Integration & External Dependencies:**
- Services/APIs externes et modes de défaillance
- Formats d'import/export de données
- Hypothèses de protocole/versioning

**Edge Cases & Failure Handling:**
- Scénarios négatifs
- Rate limiting / throttling
- Résolution de conflits

**Constraints & Tradeoffs:**
- Contraintes techniques
- Tradeoffs explicites ou alternatives rejetées

**Terminology & Consistency:**
- Termes de glossaire canoniques
- Synonymes évités / termes dépréciés

### 3. Générer la file de questions de clarification candidates

- Maximum 5 questions au total sur toute la session
- Chaque question doit être répondable avec SOIT :
  - Une sélection multiple courte (2–5 options distinctes, mutuellement exclusives), OU
  - Une réponse d'un mot / phrase courte (contraindre explicitement : "Répondre en <=5 mots")
- Inclure seulement les questions dont les réponses impactent matériellement l'architecture, modélisation de données, décomposition de tâches, conception de tests, comportement UX, ou validation de conformité

### 4. Boucle de questionnement séquentielle (interactive)

- Présenter EXACTEMENT UNE question à la fois
- Pour les questions à choix multiple :
  - **Analyser toutes les options** et déterminer l'**option la plus appropriée**
  - Présenter ta **recommandation en évidence** en haut avec raisonnement clair
  - Formater comme : `**Recommandé:** Option [X] - `
  - Puis rendre toutes les options comme table Markdown
- Après que l'utilisateur réponde :
  - Si l'utilisateur répond "oui", "recommandé", ou "suggéré", utiliser la recommandation/suggestion précédemment énoncée
  - Sinon, valider que la réponse correspond à une option ou respecte la contrainte <=5 mots
- Arrêter de poser des questions quand :
  - Toutes les ambiguïtés critiques résolues tôt, OU
  - L'utilisateur signale la complétion ("done", "bon", "pas plus"), OU
  - Tu atteins 5 questions posées

### 5. Intégration après CHAQUE réponse acceptée

- Maintenir une représentation en mémoire de la spec
- S'assurer qu'une section `## Clarifications` existe (la créer si manquante)
- Sous elle, créer un sous-titre `### Session YYYY-MM-DD` pour aujourd'hui
- Ajouter une ligne bullet : `- Q: → A: `
- Puis appliquer immédiatement la clarification à la/les section(s) la plus appropriée(s)
- Sauvegarder le fichier spec APRÈS chaque intégration

### 6. Validation

- La session Clarifications contient exactement un bullet par réponse acceptée
- Total questions posées (acceptées) ≤ 5
- Sections mises à jour ne contiennent pas de placeholders vagues
- Structure Markdown valide

### 7. Écrire la spec mise à jour vers FEATURE_SPEC

### 8. Rapporter la complétion

- Nombre de questions posées & répondues
- Chemin vers la spec mise à jour
- Sections touchées
- Table résumé de couverture
- Commande suivante suggérée

## Règles de Comportement

- Si pas d'ambiguïtés significatives trouvées, répondre : "Pas d'ambiguïtés critiques détectées valant clarification formelle." et suggérer de procéder.
- Si fichier spec manquant, instruire l'utilisateur d'exécuter `/speckit.specify` d'abord.
- Ne jamais dépasser 5 questions posées au total.
- Respecter les signaux de terminaison anticipée de l'utilisateur ("stop", "done", "proceed").
