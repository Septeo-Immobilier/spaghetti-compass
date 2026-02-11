# Quickstart - Agent-setup CLI

**Feature**: 7-agent-setup-cli

## Scénario 1 : Première configuration (répertoire courant)

```bash
cd /chemin/vers/projet
spaghetti-compass agent-setup --workflow cursor
```

**Résultat attendu** : Création ou mise à jour de `.cursor/rules/`, `.cursor/commands/`, `.agents/skills/` avec les fichiers gérés pour le workflow `cursor`. Exit code 0.

## Scénario 2 : Configuration d’un sous-projet

```bash
spaghetti-compass agent-setup -w cursor -p ./packages/app
```

**Résultat attendu** : Fichiers écrits sous `./packages/app/.cursor/` et `./packages/app/.agents/`. Exit code 0.

## Scénario 3 : Ré-exécution (mise à jour)

```bash
spaghetti-compass agent-setup --workflow cursor
```

**Résultat attendu** : Les mêmes fichiers sont écrasés avec la version livrée par le CLI. Pas de doublon. Exit code 0.

## Scénario 4 : Erreur – chemin invalide

```bash
spaghetti-compass agent-setup -w cursor -p /inexistant/ou/fichier.txt
```

**Résultat attendu** : Message d’erreur explicite, exit code 2.

## Scénario 5 : Erreur – workflow inconnu

```bash
spaghetti-compass agent-setup --workflow inconnu
```

**Résultat attendu** : Message listant les workflows supportés (ex. "Supported workflows: cursor"), exit code 5.

## Vérification rapide

Après un `agent-setup --workflow cursor` en racine du projet :

- Présence de `.cursor/rules/spaghetti-compass-exploration.md` (ou équivalent selon templates)
- Présence de `.cursor/commands/spaghetti-compass-explore.md` (ou équivalent)
- Présence de `.agents/skills/spaghetti-compass-exploration/SKILL.md` (ou équivalent)
- Aucune suppression de fichiers utilisateur déjà présents dans ces dossiers (seuls les fichiers gérés sont écrasés)
