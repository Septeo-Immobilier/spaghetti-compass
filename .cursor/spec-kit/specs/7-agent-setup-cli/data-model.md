# Data Model - Agent-setup CLI

**Feature**: 7-agent-setup-cli  
**Date**: 2026-02-11

## Entités

### Workflow

Représente un type d’environnement agent supporté par la commande.

| Attribut    | Type   | Description |
|-------------|--------|-------------|
| id          | string | Identifiant unique (ex. `cursor`) |
| name        | string | Nom affiché (ex. "Cursor") |
| description | string | Courte description pour --help |
| files       | FileArtifact[] | Liste des fichiers à écrire pour ce workflow |

Pas de persistance : défini en code (registry des workflows).

---

### FileArtifact

Un fichier généré pour un workflow donné.

| Attribut   | Type   | Description |
|------------|--------|-------------|
| relativePath | string | Chemin relatif à la racine cible (ex. `.cursor/rules/spaghetti-compass-exploration.md`) |
| content    | string | Contenu du fichier (template ou généré) |
| encoding  | string | `utf-8` par défaut |

Les templates sont résolus au moment de l’exécution (pas de variables utilisateur pour le MVP, sauf éventuellement le nom du projet).

---

### TargetDirectory

Répertoire cible où écrire les fichiers.

| Attribut | Type   | Description |
|----------|--------|-------------|
| path     | string | Chemin absolu résolu |
| exists   | boolean | Le répertoire existe |
| isDirectory | boolean | C’est bien un répertoire (pas un fichier) |

Validation : `exists && isDirectory` doit être vrai pour procéder.

---

## Relations

- Un **Workflow** possède plusieurs **FileArtifact**.
- La commande prend un **TargetDirectory** et un **Workflow**, et écrit chaque **FileArtifact** du workflow dans le répertoire cible (relativePath → path résolu).

## Règles métier

- Les chemins dans `FileArtifact.relativePath` ne doivent pas sortir de la racine cible (pas de `..`).
- Écriture en overwrite uniquement : pas de merge de contenu.
- Encodage des fichiers écrits : UTF-8.
