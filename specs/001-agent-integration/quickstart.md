# Quickstart: Agent Integration pour Spaghetti-Compass

**Feature Branch**: `001-agent-integration`
**Created**: 2026-02-04
**Updated**: 2026-02-05

---

## Prérequis

- Node.js >= 20.0.0
- npm >= 10.0.0
- Compte npm (pour publication)

---

## Setup Développement

```bash
# Cloner le repo
git clone https://github.com/user/spaghetti-compass.git
cd spaghetti-compass

# Installer les dépendances
npm install

# Build
npm run build

# Tester localement
node bin/spaghetti-compass.js explore fixtures/typescript/main.ts --json
```

---

## Tester le CLI

### Exploration de fichier

```bash
# Exploration basique
node bin/spaghetti-compass.js explore src/core/analyzer.ts

# Avec sortie JSON
node bin/spaghetti-compass.js explore src/core/analyzer.ts --json

# Exploration d'une fonction
node bin/spaghetti-compass.js explore src/core/analyzer.ts:analyze --json
```

### Vérifier le format JSON

```bash
# Avec jq
node bin/spaghetti-compass.js explore fixtures/typescript/main.ts --json | jq '.stats'

# Vérifier les nœuds
node bin/spaghetti-compass.js explore fixtures/typescript/main.ts --json | jq '.nodes[].name'

# Vérifier les cycles
node bin/spaghetti-compass.js explore fixtures/python/app/main.py --json | jq '.stats.circularDependencies'
```

---

## Tester le Packaging

```bash
# Créer le tarball
npm pack

# Tester avec npx (dans un autre dossier)
cd /tmp
npx /path/to/spaghetti-compass-0.1.0.tgz explore /path/to/file.ts --json
```

---

## Publication npm (via GitHub Actions)

### Tester le package (dry-run)

1. Aller sur GitHub → Actions → "Publish to npm"
2. Cliquer "Run workflow"
3. Laisser "Dry run" coché (par défaut)
4. Cliquer "Run workflow"

Le workflow va :
- Builder le projet
- Exécuter les tests
- Créer et tester le package localement
- Simuler la publication sans rien publier

### Publier sur npm

1. Aller sur GitHub → Actions → "Publish to npm"
2. Cliquer "Run workflow"
3. Optionnel : spécifier une version (`patch`, `minor`, `major`, ou `1.2.3`)
4. **Décocher** "Dry run"
5. Cliquer "Run workflow"

### Configuration du secret GitHub

Aller dans Settings → Secrets and variables → Actions → New repository secret :

| Secret | Valeur |
|--------|--------|
| `NPM_TOKEN` | Token npm (généré via `npm token create --type=automation`) |

### Publication locale (fallback)

```bash
# 1. Vérifier le nom disponible
npm view spaghetti-compass

# 2. Se connecter
npm login

# 3. Dry run
npm publish --dry-run

# 4. Publier
npm publish --access public

# 5. Vérifier
npm view spaghetti-compass
```

---

## Tester comme un Agent

Simuler ce qu'un agent Cursor ferait :

```bash
# Scénario 1: Explorer les dépendances d'un fichier
npx spaghetti-compass explore src/main.ts --json > deps.json
cat deps.json | jq '.nodes | length'  # Nombre de fichiers dépendants

# Scénario 2: Vérifier les cycles avant merge
npx spaghetti-compass explore src/index.ts --json | jq '.stats.circularDependencies | length'
# Si > 0, il y a des cycles

# Scénario 3: Analyser l'impact d'une fonction
npx spaghetti-compass explore src/core/analyzer.ts:analyze --json | jq '.edges[] | select(.type == "call")'
```

---

## Configuration MCP (Phase 2)

### Fichier `.cursor/mcp.json`

```json
{
  "mcpServers": {
    "spaghetti-compass": {
      "command": "npx",
      "args": ["spaghetti-compass-mcp"]
    }
  }
}
```

### Tester le serveur MCP

```bash
# Démarrer le serveur (mode debug)
node bin/spaghetti-compass-mcp.js

# Dans un autre terminal, envoyer une requête
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"explore_dependencies","arguments":{"file":"src/main.ts"}},"id":1}' | node bin/spaghetti-compass-mcp.js
```

---

## Validation Checklist

### Phase 1 - CLI

- [ ] `npm run build` réussit sans erreur
- [ ] `npm run test:run` passe
- [ ] `node bin/spaghetti-compass.js --version` affiche la version
- [ ] `node bin/spaghetti-compass.js explore <file> --json` retourne du JSON valide
- [ ] Le JSON contient tous les champs de `DependencyGraph`
- [ ] `npm pack` crée un tarball valide
- [ ] `npx ./spaghetti-compass-*.tgz explore <file>` fonctionne

### Phase 2 - CI/CD

- [ ] Fichier `.github/workflows/publish-npm.yml` créé
- [ ] Secret GitHub configuré (`NPM_TOKEN`)
- [ ] Workflow npm (dry-run) fonctionne
- [ ] Workflow npm (publication réelle) fonctionne

### Phase 3 - npm

- [ ] Package publié sur npm
- [ ] `npx spaghetti-compass --version` fonctionne
- [ ] `npx spaghetti-compass explore <file> --json` fonctionne

### Phase 4 - MCP (optionnel)

- [ ] Le serveur MCP démarre sans erreur
- [ ] L'outil `explore_dependencies` est listé
- [ ] L'appel à l'outil retourne le bon format
- [ ] La configuration Cursor fonctionne

---

## Troubleshooting

### Erreur "command not found"

```bash
# Vérifier que le bin est exécutable
chmod +x bin/spaghetti-compass.js

# Vérifier le shebang
head -1 bin/spaghetti-compass.js
# Doit être: #!/usr/bin/env node
```

### Erreur de parsing JSON

```bash
# Vérifier que la sortie est du JSON pur (pas de logs)
node bin/spaghetti-compass.js explore <file> --json 2>/dev/null | jq .
```

### Erreur npm publish

```bash
# Vérifier la connexion
npm whoami

# Vérifier les droits sur le nom
npm access ls-packages
```
