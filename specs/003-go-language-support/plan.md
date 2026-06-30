# Implementation Plan: Support du langage Go

**Branch**: `003-go-language-support` | **Date**: 2026-06-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/003-go-language-support/spec.md`

---

## Summary

Ajouter Go comme langage de premiere classe pour les commandes existantes de Spaghetti Compass: `explore`, `impact`, exploration par fonction/methode et sorties texte/JSON. L'approche retenue est progressive: parser/resolver Go local sans dependance obligatoire, puis provider `gopls` optionnel pour la navigation precise.

## Technical Context

**Language/Version**: TypeScript cible Node.js >=20; support analyse Go modules `go.mod` (Go observe 1.25 dans les exemples)
**Primary Dependencies**: Commander, TypeScript, Vitest; `gopls` optionnel via LSP stdio
**Storage**: N/A
**Testing**: Vitest (`npm run test:run`)
**Target Platform**: CLI Node.js local
**Project Type**: CLI single package
**Performance Goals**: Scanner un module Go de plusieurs centaines de fichiers sans degradation notable; eviter `vendor/` et `.gomodcache/`
**Constraints**: Pas de dependance systeme obligatoire a Go/gopls; degradation gracieuse; pas de changement de contrat JSON
**Scale/Scope**: Monorepos avec plusieurs modules Go (`apps/backend`, `contracts/go`) et packages multi-fichiers

## Architecture Decision

### Points d'impact

| Composant | Role actuel | Modification Go |
|-----------|-------------|-----------------|
| `src/parser/factory.ts` | Selectionne TypeScript/Python/PHP | Ajouter `GoParser` et extension `.go` |
| `src/parser/go.ts` | N/A | Extraire imports, exports, fonctions, methodes et appels Go |
| `src/core/resolver.ts` | Resout TS/Python/PHP | Ajouter resolution language-aware Go via `go.mod` |
| `src/core/go-mod.ts` | N/A | Nouveau helper/cache pour trouver et parser `go.mod` |
| `src/core/lsp/factory.ts` | Map extensions vers providers | Mapper `.go` vers `GoLspProvider` |
| `src/core/lsp/go.ts` | N/A | Provider optionnel `gopls` via process JSON-RPC |
| `src/core/lsp/types.ts` | Config paths PHP/Python | Ajouter chemin optionnel `gopls` |
| `src/cli/index.ts` | Parse extensions et defaults | Ajouter `.go`, defaults include, aide CLI |
| `src/core/impact.ts` | Scan files supportes | Beneficie de `ParserFactory`; ajouter exclusions cache si necessaire |
| `config/route-patterns.txt` | Patterns routes TS/Python/PHP | Ajouter patterns Go |
| `fixtures/` | Fixtures TS/Python/PHP | Ajouter fixture Go representative |
| `README.md`, `fixtures/README.md` | Docs utilisateur | Ajouter section Go |

### Go fallback parser

Le parser Go reste volontairement leger et deterministe:

- normalise les fins de ligne;
- ignore les commentaires avant extraction quand necessaire;
- lit `package <name>`;
- extrait imports simples et blocs;
- extrait declarations top-level via regex structurees;
- extrait fonctions/methodes avec suivi d'accolades pour isoler les corps;
- extrait appels directs dans chaque corps.

Ce fallback doit etre stable pour les cas courants, pas remplacer un compilateur Go.

### Go module resolver

Ajouter `GoModResolver`:

```text
fromFile -> nearest go.mod -> modulePath/moduleRoot
importPath startsWith modulePath -> local package dir
package dir -> representative .go file
```

Caching:

- cache `fromDir -> GoModuleInfo | null`;
- cache `moduleRoot + importPath -> resolved file | null`;
- invalidation non necessaire pour le processus CLI.

### Go LSP provider

Ajouter `GoLspProvider` conforme a `LspProvider`:

- `isAvailable()` verifie `gopls version` ou presence executable;
- `initialize(projectRoot)` lance `gopls serve` via le `LspProcessManager` existant;
- `getDefinition*` utilise les messages LSP existants;
- fallback `NullLspProvider` si absent.

`gopls` ne doit pas etre requis par les tests unitaires principaux.

## Project Structure

```text
src/
├── parser/
│   ├── go.ts
│   └── factory.ts
├── core/
│   ├── go-mod.ts
│   ├── resolver.ts
│   └── lsp/
│       ├── go.ts
│       ├── factory.ts
│       └── types.ts
├── cli/
│   └── index.ts
└── config/
    └── route-patterns.ts

fixtures/
└── go/
    ├── go.mod
    ├── cmd/service/main.go
    └── internal/
        ├── domain/invoice/entity.go
        ├── application/usecases/receive_invoice.go
        ├── ports/repository.go
        └── handlers/invoice_handler.go
```

**Structure Decision**: Ajouter des fichiers Go-support dedies (`go.ts`, `go-mod.ts`) plutot que melanger la logique dans les parsers existants.

## Implementation Strategy

### Phase 1: Parser Go et CLI visible

1. Ajouter `src/parser/go.ts`.
2. Brancher `GoParser` dans `ParserFactory`.
3. Ajouter `.go` au parsing d'entree CLI (`parseEntry`) et aux descriptions/defaults.
4. Ajouter fixtures Go minimales.
5. Tester extraction imports/exports/fonctions/appels.

### Phase 2: Resolution `go.mod`

1. Ajouter `src/core/go-mod.ts`.
2. Etendre `PathResolver` avec detection `isGoSource`.
3. Resoudre imports internes via module path.
4. Classifier stdlib et third-party sans passer par `isNpmPackage`.
5. Tester `explore` transitive Go.

### Phase 3: Impact Go et route patterns

1. Ajouter `.go` aux defaults `impact`.
2. Exclure `vendor/` et `.gomodcache/` des scans.
3. Ajouter patterns route Go dans `config/route-patterns.txt`.
4. Tester dependants directs/transitifs et routes impactees.

### Phase 4: Function-level Go

1. Supporter `file.go:Function`, `file.go:Type.Method`, `file.go:Type/Method`.
2. Ajouter extraction de corps par braces pour fonctions/methodes.
3. Creer edges `call` pour appels locaux et selecteurs quand resolubles.
4. Tester une methode type `ReceiveInvoice.Execute`.

### Phase 5: `gopls` optionnel

1. Ajouter `GoLspProvider`.
2. Ajouter `gopls` dans `LspConfig.paths`.
3. Brancher `.go` dans `LspProviderFactory`.
4. Ajouter tests unitaires fallback et test manuel/conditionnel LSP.

### Phase 6: Documentation et non-regression

1. README: ajouter Go dans features, quickstart et supported languages.
2. `fixtures/README.md`: ajouter commandes Go.
3. Lancer `npm run test:run`.
4. Lancer commandes quickstart Go en texte et JSON.

## Dependencies

- Aucune dependance npm obligatoire nouvelle.
- `gopls` optionnel pour navigation precise; absent en CI par defaut.
- Pas d'appel reseau requis.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Provider LSP supplementaire | Parite de navigation avec les autres langages et precision Go multi-fichiers | Parser fallback seul ne peut pas resoudre tous les symboles Go avec precision |
| Resolver `go.mod` dedie | Go utilise des module paths, pas des chemins relatifs TS/Python/PHP | Le resolver generique traiterait les imports Go comme npm/third-party |
