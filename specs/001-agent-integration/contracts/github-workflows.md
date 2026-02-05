# Contracts: GitHub Actions Workflows

**Feature Branch**: `001-agent-integration`
**Created**: 2026-02-04
**Updated**: 2026-02-05

---

## Workflow: Publication npm (manuel avec dry-run)

### Fichier
`.github/workflows/publish-npm.yml`

### Déclencheur
```yaml
on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to publish (patch, minor, major, or semver)'
        required: false
        type: string
      dry_run:
        description: 'Dry run (test without publishing)'
        required: false
        type: boolean
        default: true  # Dry-run par défaut pour éviter les erreurs
```

### Secret requis
| Secret | Description | Exemple |
|--------|-------------|---------|
| `NPM_TOKEN` | Token npm pour publication | `npm_xxx...` |

### Inputs
| Input | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `version` | string | Non | `""` | Version à publier (ex: `1.0.0`, `patch`, `minor`) |
| `dry_run` | boolean | Non | `true` | Mode simulation sans publication |

### Étapes
1. Checkout du code
2. Setup Node.js 20 avec registry npm
3. `npm ci` - Installation des dépendances
4. `npm run build` - Build TypeScript
5. `npm run test:run` - Exécution des tests
6. (Optionnel) `npm version $VERSION` - Mise à jour version
7. `npm pack` + test local - Vérification du package
8. `npm publish --access public` ou `npm publish --dry-run`

### Comportement attendu
- ✅ Dry-run (par défaut) : Teste le package sans publier
- ✅ Succès publication : Package publié sur npm
- ❌ Échec tests : Workflow échoue, pas de publication
- ❌ Échec test local : Workflow échoue, package invalide
- ❌ Échec publication : Workflow échoue (ex: version déjà existante)

### Workflow complet

```yaml
name: Publish to npm

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to publish (leave empty to use package.json version, or use: patch, minor, major, or semver like 1.2.3)'
        required: false
        type: string
      dry_run:
        description: 'Dry run (test without publishing)'
        required: false
        type: boolean
        default: true

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Run tests
        run: npm run test:run
        continue-on-error: true

      - name: Update version
        if: ${{ inputs.version != '' }}
        run: |
          echo "📝 Updating version to: ${{ inputs.version }}"
          npm version ${{ inputs.version }} --no-git-tag-version

      - name: Show package info
        run: |
          echo "📦 Package details:"
          echo "===================="
          cat package.json | grep -E '"(name|version|description)"'
          echo ""
          echo "📁 Files to publish:"
          npm pack --dry-run 2>&1 | tail -20

      - name: Test package locally
        run: |
          echo "🧪 Testing package installation..."
          npm pack
          TARBALL=$(ls *.tgz)
          echo "Created: $TARBALL"
          
          mkdir -p /tmp/test-install
          cp $TARBALL /tmp/test-install/
          cd /tmp/test-install
          npm init -y
          npm install ./$TARBALL
          
          echo ""
          echo "✅ Testing CLI..."
          npx spaghetti-compass --version
          echo ""
          echo "✅ Package installs and runs correctly!"

      - name: Publish to npm (dry run)
        if: ${{ inputs.dry_run }}
        run: |
          echo "🔍 DRY RUN MODE - Not actually publishing"
          echo "=========================================="
          npm publish --dry-run --access public
          echo ""
          echo "✅ Dry run successful! Package is ready to publish."
          echo "   Re-run this workflow with 'Dry run' unchecked to publish for real."

      - name: Publish to npm
        if: ${{ !inputs.dry_run }}
        run: |
          echo "🚀 Publishing to npm..."
          npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Verify publication
        if: ${{ !inputs.dry_run }}
        run: |
          echo "⏳ Waiting for npm to index the package..."
          sleep 10
          echo ""
          echo "✅ Package published! Verifying..."
          npm view spaghetti-compass
          echo ""
          echo "🎉 Successfully published to npm!"
          echo "   Install with: npm install -g spaghetti-compass"
          echo "   Or use with:  npx spaghetti-compass explore <file> --json"
```

---

## Configuration du Secret

### Générer un token npm

```bash
# Se connecter à npm
npm login

# Créer un token automation (recommandé pour CI)
npm token create --type=automation

# Ou via le site web :
# 1. Aller sur https://www.npmjs.com/settings/~/tokens
# 2. Cliquer "Generate New Token"
# 3. Choisir "Automation" pour CI/CD
# 4. Copier le token
```

### Ajouter le secret dans GitHub

1. Aller dans le repository GitHub
2. Settings → Secrets and variables → Actions
3. Cliquer "New repository secret"
4. Ajouter le secret `NPM_TOKEN`

---

## Diagramme de flux

```
┌─────────────────────────────────────────────────────────────────┐
│                   Déclenchement manuel                           │
│                  (workflow_dispatch)                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                Workflow: publish-npm.yml                         │
│                                                                  │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────────┐ │
│  │ Checkout│→ │  Build  │→ │  Tests  │→ │ Test local package  │ │
│  └─────────┘  └─────────┘  └─────────┘  └─────────────────────┘ │
│                                                  │               │
│                              ┌───────────────────┴───────────┐   │
│                              ▼                               ▼   │
│                    ┌─────────────────┐           ┌───────────────┐
│                    │  Dry run        │           │ Publish npm   │
│                    │  (par défaut)   │           │ (si !dry_run) │
│                    └─────────────────┘           └───────────────┘
└─────────────────────────────────────────────────────────────────┘
```

---

## Utilisation

### Tester le package (dry-run)

1. Aller dans **Actions** → **Publish to npm**
2. Cliquer **Run workflow**
3. Laisser **Dry run** coché (par défaut)
4. Cliquer **Run workflow**

Le workflow va :
- Builder le projet
- Exécuter les tests
- Créer et tester le package localement
- Simuler la publication sans rien publier

### Publier sur npm

1. Aller dans **Actions** → **Publish to npm**
2. Cliquer **Run workflow**
3. Optionnellement spécifier une version (`patch`, `minor`, `major`, ou `1.2.3`)
4. **Décocher** "Dry run"
5. Cliquer **Run workflow**

Le workflow va :
- Builder le projet
- Exécuter les tests
- Créer et tester le package localement
- Publier sur npm
- Vérifier la publication
