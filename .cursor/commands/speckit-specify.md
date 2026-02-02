---
description: Créer ou mettre à jour la spécification de fonctionnalité à partir d'une description en langage naturel.
globs: 
alwaysApply: false
---

# /speckit.specify

## Entrée Utilisateur

```text
$ARGUMENTS
```

Tu **DOIS** considérer l'entrée utilisateur avant de procéder (si non vide).

## Résumé

Le texte que l'utilisateur a tapé après `/speckit.specify` **est** la description de la fonctionnalité. Ne pas demander à l'utilisateur de la répéter sauf s'il a fourni une commande vide.

## Workflow d'Exécution

1. **Générer un nom court concis** (2-4 mots) pour la branche :
   - Analyser la description et extraire les mots-clés les plus significatifs
   - Créer un nom court de 2-4 mots qui capture l'essence de la fonctionnalité
   - Utiliser le format action-nom quand possible (ex: "add-user-auth", "fix-payment-bug")
   - Préserver les termes techniques et acronymes (OAuth2, API, JWT, etc.)
   - Exemples :
     - "Je veux ajouter l'authentification utilisateur" → "user-auth"
     - "Implémenter l'intégration OAuth2 pour l'API" → "oauth2-api-integration"
     - "Créer un dashboard pour les analytics" → "analytics-dashboard"

2. **Vérifier les branches existantes** avant d'en créer une nouvelle :
   - Trouver le numéro de fonctionnalité le plus élevé à travers toutes les sources :
     - Branches distantes : `git ls-remote --heads origin`
     - Branches locales : `git branch`
     - Répertoires specs : Vérifier les répertoires correspondant à `specs/[0-9]+-*`
   - Utiliser N+1 pour le nouveau numéro de branche

3. **Créer la branche et le répertoire de spec** :
   - Créer la branche `[N]-[short-name]`
   - Créer le répertoire `.cursor/spec-kit/specs/[N]-[short-name]/`
   - Créer le fichier `spec.md` initial

4. **Charger le template** `.cursor/spec-kit/templates/spec-template.md` pour comprendre les sections requises.

5. **Parser la description utilisateur** :
   - Si vide : ERREUR "Pas de description de fonctionnalité fournie"
   - Extraire les concepts clés : acteurs, actions, données, contraintes
   - Pour les aspects peu clairs :
     - Faire des suppositions informées basées sur le contexte et les standards de l'industrie
     - Marquer avec [NEEDS CLARIFICATION: question spécifique] seulement si :
       - Le choix impacte significativement le scope ou l'expérience utilisateur
       - Plusieurs interprétations raisonnables existent
       - Aucune valeur par défaut raisonnable n'existe
     - **LIMITE : Maximum 3 marqueurs [NEEDS CLARIFICATION] au total**

6. **Remplir les sections** :
   - User Scenarios & Testing : Chaque user story avec priorité (P1, P2, P3...)
   - Functional Requirements : Chaque requirement doit être testable
   - Success Criteria : Créer des résultats mesurables, agnostiques de la technologie

7. **Écrire la spécification** dans le fichier SPEC_FILE en utilisant la structure du template.

8. **Validation de Qualité** :
   - Créer `.cursor/spec-kit/specs/[FEATURE]/checklists/requirements.md`
   - Valider contre les critères de qualité
   - Si des marqueurs [NEEDS CLARIFICATION] restent, les présenter à l'utilisateur

9. **Rapporter la complétion** avec nom de branche, chemin du fichier spec, et préparation pour la prochaine phase (`/speckit.clarify` ou `/speckit.plan`).

## Guidelines Générales

### Focus
- Se concentrer sur **CE QUE** les utilisateurs ont besoin et **POURQUOI**.
- Éviter LE COMMENT implémenter (pas de tech stack, APIs, structure de code).
- Écrit pour les parties prenantes business, pas les développeurs.
- NE PAS créer de checklists embarquées dans la spec.

### Sections Requises
- **Mandatory sections** : Doivent être complétées pour chaque fonctionnalité
- **Optional sections** : Inclure seulement quand pertinent
- Quand une section ne s'applique pas, la supprimer entièrement

### Guidelines Success Criteria
Les critères de succès doivent être :
1. **Measurable** : Inclure des métriques spécifiques (temps, pourcentage, nombre)
2. **Technology-agnostic** : Pas de mention de frameworks, langages, bases de données
3. **User-focused** : Décrire les résultats du point de vue utilisateur/business
4. **Verifiable** : Peut être testé/validé sans connaître les détails d'implémentation

**Bons exemples** :
- "Les utilisateurs peuvent compléter le checkout en moins de 3 minutes"
- "Le système supporte 10,000 utilisateurs concurrents"
- "95% des recherches retournent des résultats en moins de 1 seconde"

**Mauvais exemples** (orientés implémentation) :
- "Le temps de réponse API est sous 200ms" (trop technique)
- "La base de données peut gérer 1000 TPS" (détail d'implémentation)
