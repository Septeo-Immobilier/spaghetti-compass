---
description: Créer ou mettre à jour la constitution du projet avec les principes directeurs et guidelines de développement.
globs: 
alwaysApply: false
---

# /speckit.constitution

## Entrée Utilisateur

```text
$ARGUMENTS
```

Tu **DOIS** considérer l'entrée utilisateur avant de procéder (si non vide).

## Résumé

Tu mets à jour la constitution du projet dans `.cursor/spec-kit/memory/constitution.md`. Ce fichier est un TEMPLATE contenant des tokens de placeholder entre crochets (ex: `[PROJECT_NAME]`, `[PRINCIPLE_1_NAME]`). Ton travail est de (a) collecter/dériver des valeurs concrètes, (b) remplir le template précisément, et (c) propager les amendements à travers les artifacts dépendants.

## Workflow d'Exécution

1. **Charger le template de constitution** existant dans `.cursor/spec-kit/memory/constitution.md`.
   - Identifier chaque token de placeholder de la forme `[ALL_CAPS_IDENTIFIER]`.
   - **IMPORTANT**: L'utilisateur peut nécessiter moins ou plus de principes que ceux du template. Si un nombre est spécifié, le respecter.

2. **Collecter/dériver les valeurs** pour les placeholders :
   - Si l'entrée utilisateur fournit une valeur, l'utiliser.
   - Sinon inférer du contexte existant (README, docs, versions précédentes).
   - Pour les dates de gouvernance : `RATIFICATION_DATE` est la date d'adoption originale, `LAST_AMENDED_DATE` est aujourd'hui si des changements sont faits.
   - `CONSTITUTION_VERSION` doit s'incrémenter selon le semantic versioning :
     - MAJOR : Changements incompatibles de gouvernance/principes.
     - MINOR : Nouveau principe/section ajouté ou guidance matériellement étendue.
     - PATCH : Clarifications, corrections de typos, raffinements non-sémantiques.

3. **Rédiger le contenu mis à jour** de la constitution :
   - Remplacer chaque placeholder avec du texte concret (pas de tokens entre crochets restants).
   - Préserver la hiérarchie des titres.
   - Chaque section Principe : nom succinct, paragraphe capturant les règles non-négociables, rationale explicite si pas évident.
   - Section Gouvernance liste la procédure d'amendement, politique de versioning.

4. **Checklist de propagation de cohérence** :
 - Lire `.cursor/spec-kit/templates/plan-template.md` et s'assurer que le "Constitution Check" s'aligne.
 - Lire `.cursor/spec-kit/templates/spec-template.md` pour l'alignement scope/requirements.
 - Lire `.cursor/spec-kit/templates/tasks-template.md` et s'assurer que la catégorisation des tâches reflète les types de tâches orientés-principes.

5. **Rapport d'Impact de Synchronisation** (prépendre comme commentaire HTML en haut du fichier après mise à jour) :
   - Changement de version : ancienne → nouvelle
   - Liste des principes modifiés
   - Sections ajoutées/supprimées
   - Templates nécessitant mise à jour (✅ mis à jour / ⚠ en attente)
   - TODOs de suivi si des placeholders intentionnellement différés.

6. **Validation avant sortie finale** :
   - Pas de tokens crochets non expliqués restants.
   - Ligne de version correspond au rapport.
   - Dates au format ISO YYYY-MM-DD.
   - Principes déclaratifs, testables, sans langage vague.

7. **Écrire la constitution complétée** dans `.cursor/spec-kit/memory/constitution.md` (écraser).

8. **Sortir un résumé final** à l'utilisateur avec :
   - Nouvelle version et rationale du bump.
   - Fichiers marqués pour suivi manuel.
   - Message de commit suggéré.

## Règles de Formatage

- Utiliser les titres Markdown exactement comme dans le template.
- Wrap les longues lignes de rationale pour garder la lisibilité (<100 caractères idéalement).
- Garder une seule ligne vide entre les sections.
- Éviter les espaces en fin de ligne.

Ne pas créer un nouveau template ; toujours opérer sur le fichier `.cursor/spec-kit/memory/constitution.md` existant.
