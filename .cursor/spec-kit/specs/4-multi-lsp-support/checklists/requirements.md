# Requirements Checklist: Multi-LSP Support

## Functional Requirements

### FR-001: Support des LSP multiples
- [ ] TypeScript (existant, à refactorer)
- [ ] PHP via Intelephense
- [ ] Python via Pyright

### FR-002: Interface LspProvider abstraite
- [ ] Interface définie dans `src/core/lsp/types.ts`
- [ ] Méthode `getDefinition()`
- [ ] Méthode `getDefinitionByName()`
- [ ] Méthode `addFile()`
- [ ] Méthode `dispose()`
- [ ] Méthode `isAvailable()`
- [ ] Méthode `initialize()`

### FR-003: Détection automatique du LSP
- [ ] `.ts`, `.tsx`, `.js`, `.jsx` → TypeScriptLspProvider
- [ ] `.php` → PhpLspProvider
- [ ] `.py`, `.pyi` → PythonLspProvider
- [ ] Autres → NullLspProvider

### FR-004: Gestion gracieuse de l'absence de LSP
- [ ] Warning affiché si LSP non installé
- [ ] Fallback vers ligne d'import
- [ ] Pas d'erreur bloquante

### FR-005: Communication JSON-RPC
- [ ] Spawn de processus externe
- [ ] Envoi de requêtes JSON-RPC
- [ ] Réception de réponses
- [ ] Gestion des notifications

### FR-006: Gestion du cycle de vie
- [ ] Démarrage lazy (au premier fichier)
- [ ] Cache des processus par projet
- [ ] Arrêt propre (shutdown + exit)
- [ ] Cleanup automatique

### FR-007: Timeout des requêtes
- [ ] Timeout par défaut: 5000ms
- [ ] Timeout configurable via CLI
- [ ] Fallback gracieux après timeout

### FR-008: Cache des instances LSP
- [ ] Un processus par langage par projet
- [ ] Réutilisation entre les fichiers
- [ ] Dispose automatique à la fin

## Non-Functional Requirements

### Performance
- [ ] Temps de réponse < 500ms pour 95% des requêtes
- [ ] Démarrage LSP < 1 seconde
- [ ] Pas de fuite mémoire (processus)

### Compatibility
- [ ] Node.js >= 20.0.0
- [ ] Linux, macOS, Windows
- [ ] Intelephense >= 1.10.0
- [ ] Pyright >= 1.1.350

### UX
- [ ] Messages de warning clairs
- [ ] Mode debug disponible
- [ ] Documentation dans README

## User Stories Validation

### US1: PHP Go to Definition
- [ ] Liens pointent vers définitions PHP
- [ ] Format `chemin:ligne:colonne (symbole)`
- [ ] Navigation fonctionne dans VSCode/Cursor

### US2: Python Go to Definition
- [ ] Liens pointent vers définitions Python
- [ ] Format `chemin:ligne:colonne (symbole)`
- [ ] Navigation fonctionne dans VSCode/Cursor

### US3: Architecture abstraite
- [ ] Tests TypeScript passent après refactoring
- [ ] Nouveau langage ajoutable en < 200 lignes
- [ ] Pas de code dupliqué

### US4: Détection automatique
- [ ] Projet mixte utilise bon LSP par fichier
- [ ] Override possible via `--lsp`

## Integration Tests

### PHP Tests
- [ ] Test avec `fixtures/app/main.py` (si PHP ajouté)
- [ ] Test avec projet Symfony/Laravel
- [ ] Test sans composer.json

### Python Tests
- [ ] Test avec `fixtures/app/main.py`
- [ ] Test avec pyproject.toml
- [ ] Test sans config Python

### Edge Cases
- [ ] LSP non installé → warning + fallback
- [ ] LSP crash → cleanup + fallback
- [ ] Timeout → fallback
- [ ] Fichier non supporté → NullProvider

## Documentation

- [ ] README mis à jour avec installation LSP
- [ ] CLI help mis à jour avec nouvelles options
- [ ] Troubleshooting guide
