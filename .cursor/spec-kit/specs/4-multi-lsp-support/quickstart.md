# Quickstart: Multi-LSP Support

## Validation Scenarios

### Scenario 1: PHP Go to Definition

**Setup**:
```bash
# Installer Intelephense globalement
npm install -g intelephense

# Vérifier l'installation
intelephense --version
```

**Test**:
```bash
# Analyser un fichier PHP des fixtures
spaghetti-compass explore fixtures/app/main.py

# Attendu: Les appels de fonction affichent le chemin vers leur définition
# Exemple: fixtures/app/services/user_service.py:15:1 (get_user)
```

### Scenario 2: Python Go to Definition

**Setup**:
```bash
# Installer Pyright globalement
npm install -g pyright

# Vérifier l'installation
pyright-langserver --version
```

**Test**:
```bash
# Analyser un fichier Python des fixtures
spaghetti-compass explore fixtures/app/main.py

# Attendu: Les imports affichent le chemin vers leur définition
# Exemple: fixtures/app/services/auth_service.py:8:1 (authenticate)
```

### Scenario 3: LSP non installé (fallback gracieux)

**Test**:
```bash
# Désinstaller temporairement Intelephense
npm uninstall -g intelephense

# Analyser un fichier PHP
spaghetti-compass explore fixtures/app/main.py

# Attendu:
# - Warning: "Intelephense not found. PHP definitions will not be resolved."
# - L'analyse continue sans erreur
# - Les liens affichent la ligne d'import (fallback)
```

### Scenario 4: Projet mixte (TS + PHP + Python)

**Test**:
```bash
# Créer un projet mixte
mkdir -p test-mixed/src
echo "import { foo } from './utils';" > test-mixed/src/main.ts
echo "<?php require_once 'utils.php';" > test-mixed/src/main.php
echo "from utils import foo" > test-mixed/src/main.py

# Analyser chaque fichier
spaghetti-compass explore test-mixed/src/main.ts
spaghetti-compass explore test-mixed/src/main.php
spaghetti-compass explore test-mixed/src/main.py

# Attendu: Chaque fichier utilise son LSP approprié
```

### Scenario 5: Performance (cache des processus)

**Test**:
```bash
# Analyser plusieurs fichiers PHP à la suite
time spaghetti-compass explore fixtures/app/main.py
time spaghetti-compass explore fixtures/app/services/user_service.py
time spaghetti-compass explore fixtures/app/services/auth_service.py

# Attendu:
# - Premier appel: ~500ms (démarrage LSP)
# - Appels suivants: ~100ms (LSP déjà démarré)
```

## Expected Output

### Avant (sans LSP multi-langage)

```
═════════════════════════════════════════════════════════════════
 📍 Entry Point: fixtures/app/main.py:1:1
 📁 Context: /home/user/project
 📊 Stats: 3 internal, 0 external, 0 third-party, 0 unresolved
═════════════════════════════════════════════════════════════════

fixtures/app/main.py:1:1
├── 📥 IMPORTS (internal)
│   ├── user_service:1:1
│   ├── auth_service:2:1
│   └── helpers:3:1
```

### Après (avec LSP multi-langage)

```
═════════════════════════════════════════════════════════════════
 📍 Entry Point: fixtures/app/main.py:1:1
 📁 Context: /home/user/project
 📊 Stats: 3 internal, 0 external, 0 third-party, 0 unresolved
═════════════════════════════════════════════════════════════════

fixtures/app/main.py:1:1
├── 📥 IMPORTS (internal)
│   ├── fixtures/app/services/user_service.py:10:1 (get_user)
│   ├── fixtures/app/services/auth_service.py:8:5 (authenticate)
│   └── fixtures/app/utils/helpers.py:15:1 (format_date)
```

## CLI Options (après implémentation)

```bash
# Forcer un LSP spécifique
spaghetti-compass explore src/main.php --lsp intelephense

# Désactiver la résolution LSP
spaghetti-compass explore src/main.php --no-lsp

# Mode debug LSP
spaghetti-compass explore src/main.php --lsp-debug
```

## Troubleshooting

### Intelephense ne démarre pas

```bash
# Vérifier l'installation
which intelephense
npx intelephense --version

# Réinstaller
npm uninstall -g intelephense
npm install -g intelephense
```

### Pyright ne démarre pas

```bash
# Vérifier l'installation
which pyright-langserver
npx pyright-langserver --version

# Note: Le binaire LSP est pyright-langserver, pas pyright
```

### Timeout LSP

Si les requêtes LSP timeout:

1. Vérifier que le processus LSP est bien démarré
2. Augmenter le timeout: `spaghetti-compass explore --lsp-timeout 10000`
3. Vérifier les logs: `spaghetti-compass explore --lsp-debug`

## Installation Requirements

| Langage | Package NPM | Commande |
|---------|-------------|----------|
| TypeScript | (inclus) | - |
| PHP | `intelephense` | `npm i -g intelephense` |
| Python | `pyright` | `npm i -g pyright` |
