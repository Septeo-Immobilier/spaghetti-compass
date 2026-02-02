# Research - Code Relations Explorer

**Date**: 2026-02-02  
**Feature**: 1-code-relations-explorer

## Research Summary

Cette recherche a été effectuée pour résoudre les choix technologiques nécessaires à l'implémentation du CLI d'exploration des relations de code.

---

## R1: Parsing TypeScript/JavaScript

### Decision
Utiliser l'**API TypeScript Compiler** (`typescript` package) comme solution de parsing.

### Rationale
- **Officiel Microsoft** : Maintenu par l'équipe TypeScript, garantit la compatibilité avec les dernières versions du langage
- **Supporte JS et TS** : Avec `allowJs: true`, parse aussi bien JavaScript que TypeScript
- **AST complet** : Accès à toutes les informations nécessaires (imports, exports, appels de fonctions)
- **Type checking optionnel** : Peut résoudre les types pour une analyse plus fine
- **Zero dependencies additionnelles** : Le package `typescript` est suffisant

### Alternatives Considered

| Alternative | Rejetée parce que |
|-------------|-------------------|
| **Babel** | Plus complexe à configurer, orienté transformation pas analyse |
| **SWC** | Rust-based, API moins documentée pour l'analyse pure |
| **Acorn** | Ne supporte pas TypeScript nativement |
| **Tree-sitter** | Plus bas niveau, nécessite plus de code pour extraire les relations |

### Implementation Notes

```typescript
// Pattern de base pour parser un fichier
import * as ts from "typescript";

const program = ts.createProgram([filePath], { 
  allowJs: true,
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext
});

const sourceFile = program.getSourceFile(filePath);
const checker = program.getTypeChecker();

// Traverser l'AST pour trouver les imports
ts.forEachChild(sourceFile, (node) => {
  if (ts.isImportDeclaration(node)) {
    // Extraire les informations d'import
  }
});
```

---

## R2: Structure du graphe de dépendances

### Decision
Utiliser une structure de graphe orienté avec adjacency list, sérialisable en JSON.

### Rationale
- **Simple à traverser** : Permet le parcours en profondeur/largeur pour les relations transitives
- **Détection de cycles** : Facile à implémenter avec marquage de noeuds visités
- **Sérialisation JSON** : Format de sortie requis par la spec

### Data Structure

```typescript
interface DependencyGraph {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
}

interface GraphNode {
  id: string;           // Chemin du fichier ou identifiant de fonction
  type: 'file' | 'function' | 'external';
  name: string;
  location: 'internal' | 'external' | 'third-party';
}

interface GraphEdge {
  from: string;         // ID du noeud source
  to: string;           // ID du noeud cible
  type: 'import' | 'export' | 'call' | 'dynamic-import';
  resolved: boolean;    // false pour les imports dynamiques
}
```

---

## R3: Détection des imports dynamiques

### Decision
Détecter les `CallExpression` avec `import()` et les marquer comme non-résolus.

### Rationale
- Conforme à la spec (FR-010) : signaler sans résoudre
- Pattern AST identifiable : `ts.SyntaxKind.CallExpression` avec `import` keyword

### Implementation Pattern

```typescript
function isDynamicImport(node: ts.Node): boolean {
  return ts.isCallExpression(node) && 
         node.expression.kind === ts.SyntaxKind.ImportKeyword;
}
```

---

## R4: Framework CLI

### Decision
Utiliser **Commander.js** pour la structure CLI.

### Rationale
- **Mature et stable** : Package le plus utilisé pour les CLI Node.js
- **Parsing arguments natif** : Gère les flags, options, sous-commandes
- **TypeScript friendly** : Types inclus
- **Légèrement** : Peu de dépendances

### Alternatives Considered

| Alternative | Rejetée parce que |
|-------------|-------------------|
| **yargs** | Plus verbeux, API moins intuitive |
| **oclif** | Trop opinionated, framework complet vs library |
| **meow** | Trop minimaliste pour nos besoins |
| **arg** | Pas de génération automatique d'aide |

---

## R5: Format de sortie texte

### Decision
Utiliser une structure arborescente avec indentation et symboles Unicode.

### Rationale
- Lisibilité humaine maximale
- Distinction visuelle claire entre types de relations
- Compatible avec tous les terminaux modernes

### Format Exemple

```
📁 src/main.ts
├── 📥 IMPORTS (internal)
│   ├── ./services/user-service.ts
│   └── ./utils/helpers.ts
├── 📥 IMPORTS (external)
│   └── lodash
├── 📤 EXPORTS
│   └── function main()
└── ⚠️  DYNAMIC IMPORTS (unresolved)
    └── ./plugins/* (line 42)
```

---

## Constitution Alignment Check

| Principe Constitution | Statut | Notes |
|-----------------------|--------|-------|
| LSP-First | ⚠️ Divergence | CLI standalone, pas d'extension VSCode - justifié par la clarification |
| Architecture Modulaire | ✅ Aligné | Core + Adapters + CLI séparés |
| Modèle de Données du Graphe | ✅ Aligné | Structure nodes/edges conforme |
| Résolution Best-Effort | ✅ Aligné | Imports dynamiques marqués comme non-résolus |
| Performance et Cache | 🔄 À implémenter | Considérer pour les grands projets |

### Divergence Justifiée : LSP-First → CLI-First

La constitution mentionne une extension VSCode avec LSP. Cependant, la session de clarification a établi que le produit initial sera un **CLI** (pas une extension). Cette décision est justifiée par :
- Rapidité de développement
- Facilité de test
- Possibilité d'intégration future dans une extension VSCode

Cette divergence est documentée et n'invalide pas les autres principes architecturaux.
