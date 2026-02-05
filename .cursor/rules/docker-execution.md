# Docker Execution Rules

## User ID Mapping

**CRITICAL**: Toujours exécuter les conteneurs Docker avec l'option `--user` pour éviter les problèmes de permissions sur les fichiers générés.

### Commande obligatoire

```bash
docker run --user $(id -u):$(id -g) [autres options] image [commande]
```

### Pourquoi ?

Sans cette option, les fichiers créés par le conteneur appartiennent à `root:root`, ce qui empêche l'utilisateur local de les modifier ou supprimer sans `sudo`.

### Exemples

**Build TypeScript :**
```bash
docker run --rm --user $(id -u):$(id -g) -v "$(pwd)":/app -w /app node:20 npm run build
```

**Installation de dépendances :**
```bash
docker run --rm --user $(id -u):$(id -g) -v "$(pwd)":/app -w /app node:20 npm install
```

**Python :**
```bash
docker run --rm --user $(id -u):$(id -g) -v "$(pwd)":/app -w /app python:3.12 pip install -r requirements.txt
```

## Exceptions

L'option `--user` peut être omise uniquement si :
- Le conteneur ne monte pas de volumes du host
- Aucun fichier n'est généré/modifié sur le host
