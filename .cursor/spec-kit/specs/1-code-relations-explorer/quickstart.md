# Quickstart - Code Relations Explorer

## Installation

```bash
# Installation globale
npm install -g spaghetti-compass

# Ou via npx (sans installation)
npx spaghetti-compass explore <file>
```

## Usage de base

### Explorer un fichier

```bash
# Explorer main.ts avec src/ comme contexte
spaghetti-compass explore src/main.ts --context src/
```

**Résultat attendu** : Affichage arborescent de toutes les dépendances de `main.ts`, classées en internes, externes et tierces.

### Explorer une fonction

```bash
# Explorer la fonction login dans auth-service.ts
spaghetti-compass explore src/services/auth-service.ts:login --context src/
```

**Résultat attendu** : Graphe d'appels de la fonction `login`, montrant les fonctions qu'elle appelle et leurs dépendances.

### Sortie JSON pour intégration

```bash
# Générer un JSON exploitable par d'autres outils
spaghetti-compass explore src/main.ts -c src/ --json > deps.json
```

## Scénarios courants

### 1. Audit des dépendances externes

Identifier toutes les librairies tierces utilisées :

```bash
spaghetti-compass explore src/index.ts -c src/ --json | jq '.nodes[] | select(.location == "third-party")'
```

### 2. Détecter les imports circulaires

```bash
spaghetti-compass explore src/index.ts -c src/ --json | jq '.stats.circularDependencies'
```

### 3. Analyser un sous-module

Changer le contexte pour analyser un module spécifique :

```bash
# Contexte = services/ uniquement
spaghetti-compass explore src/services/user-service.ts -c src/services/
```

Les fichiers dans `src/` mais hors de `src/services/` seront marqués comme "external".

### 4. Exclure les fichiers de test

```bash
spaghetti-compass explore src/main.ts -c src/ --exclude "**/*.test.ts" --exclude "**/*.spec.ts"
```

## Intégration CI/CD

### Exemple GitHub Actions

```yaml
- name: Check for circular dependencies
  run: |
    npx spaghetti-compass explore src/index.ts -c src/ --json > deps.json
    CYCLES=$(jq '.stats.circularDependencies | length' deps.json)
    if [ "$CYCLES" -gt "0" ]; then
      echo "❌ Circular dependencies detected!"
      jq '.stats.circularDependencies' deps.json
      exit 1
    fi
```

## Dépannage

### "File not found"
Vérifiez que le chemin est relatif au répertoire courant ou absolu.

### "Function not found"
Assurez-vous que la fonction est exportée ou déclarée au top-level du fichier.

### Performance lente sur grands projets
Utilisez `--no-transitive` pour limiter aux relations directes, ou affinez les patterns `--include`/`--exclude`.
