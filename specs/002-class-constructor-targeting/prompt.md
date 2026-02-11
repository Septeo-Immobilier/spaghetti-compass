# Requête Originale

**Date**: 2026-02-10

Je voudrais améliorer le comportement suivant :

Lorsque je vise un symbole de classe/scope (namespace), viser bien le **constructeur** de la classe.

Adapter bien pour **PHP**, **Python** et **TypeScript**.

---

## Contexte interprété

- **Viser** = la résolution de définition (targetLine / targetColumn) utilisée pour la navigation (LSP, graphe de dépendances).
- **Symbole de classe/scope** = quand l’utilisateur ou l’analyse cible une classe (ou un namespace/module qui expose une classe), la position renvoyée doit pointer vers le constructeur de cette classe, pas seulement vers la déclaration `class X`.
- **PHP** : constructeur = `__construct` ou méthode portant le nom de la classe (PHP 4 style).
- **Python** : constructeur = `__init__`.
- **TypeScript** : constructeur = bloc `constructor(...)` dans la classe.
