<!--
RAPPORT DE SYNCHRONISATION
==========================
Changement de version: N/A → 1.0.0 (création initiale)
Principes ajoutés: 14 principes fondamentaux
Sections ajoutées: Mission, Cible, Forme Produit, Architecture, Comportements Interdits, Gouvernance
Templates à vérifier:
  ✅ plan-template.md - Constitution Check aligné avec les principes
  ✅ spec-template.md - Requirements alignés avec les contraintes architecturales
  ✅ tasks-template.md - Catégorisation compatible avec les phases du projet
-->

# CallGraph Explorer – Constitution

## Mission

Le système DOIT générer et visualiser un graphe d'exécution / d'appels à partir d'un point
d'entrée côté serveur (ex: contrôleur NestJS ou gestionnaire de route), afin de rendre
explicites les flux d'exécution dans les architectures en couches.

## Cible Primaire

La cible primaire DOIT être NestJS exécuté sur TypeScript / Node.js.
Les cibles secondaires PEUVENT inclure des frameworks serveur basés sur PHP.

## Forme Produit

Le système DOIT être livré sous forme d'extension compatible VSCode, et DOIT être compatible
avec Cursor.

L'extension DOIT fournir :
- génération de graphe par commande à partir d'un symbole ou route sélectionné
- visualisation interactive du graphe
- navigation vers le code source (fichier + ligne)

## Principes Fondamentaux

### LSP-First

Le système DOIT s'appuyer principalement sur les capacités existantes du Language Server
Protocol (LSP) pour :
- la résolution de définition de symboles
- la découverte de références
- l'inspection de types et signatures
- la découverte de symboles dans le workspace

Le système NE DOIT PAS réimplémenter l'analyse sémantique déjà fournie par le LSP sauf si
strictement nécessaire.

**Rationale** : Éviter la duplication d'efforts et garantir la cohérence avec l'écosystème
d'outils existant. Le LSP est maintenu par la communauté et offre des garanties de qualité.

### Architecture Modulaire

Le système DOIT être structuré en composants suivants :

1. Extension Host (TypeScript)
2. Core Graph Engine (TypeScript)
3. Language Adapters
4. Providers (LSP, métadonnées framework, AST fallback)

Le Core Graph Engine DOIT être indépendant de tout langage ou framework spécifique.

**Rationale** : Permettre l'extensibilité vers d'autres langages sans modifier le cœur du
système.

### Contrat des Language Adapters

Chaque Language Adapter DOIT implémenter :
- résolution de point d'entrée
- découverte des arêtes sortantes
- récupération des métadonnées de symbole
- rapport de diagnostics

Les Adapters PEUVENT combiner données LSP, scan de métadonnées framework, et analyse AST
minimale.

**Rationale** : Standardiser l'interface entre le moteur central et les implémentations
spécifiques aux langages.

### Modèle de Données du Graphe

Le système DOIT produire un graphe JSON versionné avec :
- nœuds représentant fonctions, méthodes, classes ou modules
- arêtes représentant des relations incluant :
  - call (appel)
  - inject (injection)
  - import
  - use (utilisation)
  - implements (implémentation)
  - override (surcharge)
  - create (création)

Chaque arête DOIT inclure un score de confiance dans l'intervalle [0.0 – 1.0].

**Rationale** : Fournir une représentation riche et quantifiée des relations pour permettre
le filtrage et l'analyse par les utilisateurs.

### Résolution Best-Effort

Quand une relation ne peut pas être résolue de manière unique :
- plusieurs candidats DOIVENT être émis
- chaque candidat DOIT être scoré
- l'incertitude DOIT être explicitement représentée

Les hypothèses silencieuses sont INTERDITES.

**Rationale** : Préserver la transparence et permettre à l'utilisateur de prendre des
décisions éclairées face à l'ambiguïté.

### Résolution de l'Injection de Dépendances NestJS

L'adaptateur NestJS DOIT :
- scanner les métadonnées @Module (providers, imports, exports)
- identifier les points d'injection dans les constructeurs et propriétés
- résoudre les providers selon les règles DI de NestJS en mode best-effort
- émettre des arêtes inject avec scores de confiance

Les providers basés sur factory et dynamiques PEUVENT être partiellement résolus et DOIVENT
émettre des diagnostics quand non résolus.

**Rationale** : L'injection de dépendances est centrale à NestJS ; sa résolution est
essentielle pour un graphe d'appels précis.

### Gestion du Polymorphisme

Quand des appels sont faits via interfaces ou types de base :
- toutes les implémentations compatibles DOIVENT être considérées comme candidates
- les candidates DOIVENT être filtrées en utilisant le contexte DI quand disponible
- les arêtes DOIVENT refléter l'incertitude via les scores de confiance

**Rationale** : Le polymorphisme introduit de l'ambiguïté ; le système doit la gérer
explicitement plutôt que de la masquer.

### Performance et Cache

Le système DEVRAIT utiliser l'indexation incrémentale et le cache.
La génération de graphe DOIT être scopée aux symboles atteignables depuis le point d'entrée.

**Rationale** : Garantir des temps de réponse acceptables même sur de grandes bases de code.

### Extensibilité

Le support pour des langages additionnels (ex: PHP) DOIT être implémenté via des adapters
additionnels sans modifier le Core Graph Engine.

**Rationale** : Préserver la stabilité du cœur tout en permettant l'évolution du produit.

## Périmètre MVP

Le MVP DOIT supporter :
- génération de graphe d'appels depuis une méthode de contrôleur NestJS
- résolution d'appels cross-fichiers via LSP
- arêtes d'injection DI basiques
- visualisation interactive du graphe
- navigation vers le code source

## Comportements Interdits

Le système NE DOIT PAS :
- supposer une cible d'appel unique quand plusieurs sont possibles
- masquer les relations non résolues
- dépendre de logique spécifique au framework en dehors des adapters

**Rationale** : Ces comportements compromettraient la fiabilité et la transparence du
système, qui sont des valeurs fondamentales.

## Gouvernance

### Procédure d'Amendement

1. Toute modification de cette constitution DOIT être proposée via une Pull Request
2. Les changements de principes fondamentaux DOIVENT être discutés et approuvés
3. Les changements DOIVENT être documentés dans le rapport de synchronisation

### Politique de Versioning

- **MAJOR** : Changements incompatibles de gouvernance/principes (retraits ou redéfinitions)
- **MINOR** : Nouveau principe/section ajouté ou guidance matériellement étendue
- **PATCH** : Clarifications, corrections de typos, raffinements non-sémantiques

### Vérification de Conformité

Avant chaque phase d'implémentation, le plan DOIT être vérifié contre cette constitution.
Les violations DOIVENT être justifiées et documentées dans la section "Complexity Tracking"
du plan.

---

**Version**: 1.0.0 | **Ratifiée**: 2026-02-02 | **Dernière Modification**: 2026-02-02
