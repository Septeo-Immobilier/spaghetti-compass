# CLI Interface Contract - agent-setup

**Version**: 1.0.0  
**Date**: 2026-02-11

## Commande

```bash
spaghetti-compass agent-setup [options] [path]
```

## Description

Configure le projet pour un environnement agent (workflow IA) en écrivant ou mettant à jour les fichiers de configuration (règles, skills, commandes). Opération idempotente : ré-exécuter avec le même workflow écrase les fichiers gérés pour ce workflow.

## Arguments

| Argument | Requis | Description |
|----------|--------|-------------|
| `path`   | Non    | Répertoire cible. Défaut : répertoire courant (.). |

## Options

| Option | Alias | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `--workflow <id>` | `-w` | string | (obligatoire si pas de défaut) | Identifiant du workflow (ex. `cursor`). |
| `--path <dir>`    | `-p`  | string | `.` | Répertoire cible (équivalent à l’argument positionnel). |
| `--help`          | `-h`  |        |     | Afficher l’aide. |
| `--version`       | `-v`  |        |     | Version (déjà fournie par le binaire principal). |

## Sémantique

- Si `path` (argument ou `--path`) est fourni : le résoudre par rapport à la CWD, puis vérifier que c’est un répertoire existant.
- Si `--workflow` est omis : utiliser la valeur par défaut `cursor` (ou afficher une erreur et lister les workflows si on exige l’option).
- Pour le workflow choisi : écrire tous les fichiers gérés dans le répertoire cible (overwrite). Créer les sous-dossiers si nécessaire.

## Exit codes

| Code | Signification |
|------|----------------|
| 0    | Succès (fichiers écrits ou déjà à jour). |
| 1    | Fichier/dossier non trouvé (générique). |
| 2    | Chemin cible invalide (n’existe pas ou n’est pas un répertoire). |
| 5    | Workflow inconnu ou non supporté. |

## Workflows supportés (MVP)

| Id       | Description |
|----------|-------------|
| `cursor` | Règles, commandes et skills pour Cursor (.cursor/rules, .cursor/commands, .agents/skills). |

En cas de workflow invalide : afficher un message listant les ids supportés (ex. "Supported workflows: cursor") et quitter avec le code 5.

## Exemples

```bash
# Configurer le répertoire courant pour Cursor
spaghetti-compass agent-setup --workflow cursor

# Configurer un sous-dossier
spaghetti-compass agent-setup -w cursor -p ./packages/my-app

# Ou avec argument positionnel
spaghetti-compass agent-setup cursor ./packages/my-app
```

(La forme exacte argument positionnel vs -w/-p à retenir selon la convention Commander du projet.)
