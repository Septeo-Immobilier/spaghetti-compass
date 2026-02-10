# Requirements Validation Checklist

## Quality Criteria

### Completeness
- [x] All user scenarios have acceptance criteria
- [x] Edge cases are identified
- [x] Success criteria are measurable
- [x] Key entities are defined

### Testability
- [x] FR-001: Testable via unit test avec mock de fichiers PHP
- [x] FR-002: Testable via integration test avec Intelephense
- [x] FR-003: Testable via assertion sur l'output (ligne affichée)
- [x] FR-004: Testable via fixture avec alias
- [x] FR-005: Testable via classification des imports
- [x] FR-006: Testable via désactivation du LSP
- [x] FR-007: Testable via fixture avec composer.json

### Technology Agnosticism
- [x] Success criteria ne mentionnent pas d'implémentation spécifique
- [x] Requirements décrivent le QUOI, pas le COMMENT

## Clarifications Needed

Aucune clarification majeure nécessaire. Le problème est bien défini par le feedback utilisateur.

## Technical Investigation Notes

### Analyse du Code Actuel

1. **`src/parser/php.ts`**: Parse les `use` statements mais ne résout pas les chemins PSR-4
2. **`src/core/lsp/php.ts`**: Utilise Intelephense mais `getDefinitionFromImport` délègue à `getDefinitionByName` qui cherche le symbole dans le fichier source (pas le fichier cible)
3. **`src/core/analyzer.ts`**: `processImport` appelle `findExportDefinitionLine` qui cherche dans le fichier résolu, mais le chemin n'est pas résolu pour les namespaces PHP

### Root Cause Probable

Le `PathResolver.resolve()` ne sait pas résoudre les namespaces PHP (`App\Models\User`) vers des chemins de fichiers. Il fonctionne uniquement pour:
- Chemins relatifs (`./file.php`, `../file.php`)
- Chemins avec `__DIR__` (`__DIR__ . '/path/file.php'`)

### Solution Envisagée

1. Ajouter un `ComposerResolver` qui parse `composer.json` et résout les namespaces PSR-4
2. Ou utiliser systématiquement le LSP pour résoudre les `use` statements PHP
3. Modifier `PhpLspProvider.getDefinitionFromImport` pour chercher la définition dans le fichier cible, pas le fichier source
