# Task Breakdown: Support du langage Go

**Feature Branch**: `003-go-language-support`
**Created**: 2026-06-30

---

## Phase 1: Parser Go minimal (5 tasks)

### T001 - Creer `GoParser`
**Complexity**: Medium
**Prerequisites**: None
**Files**: `src/parser/go.ts`

- Implementer `Parser` pour `.go`.
- Extraire `package`, imports simples et imports groupes.
- Gerer alias, blank import et dot import.
- Retourner des erreurs de parsing non bloquantes comme les parsers Python/PHP.

### T002 - Extraire exports Go
**Complexity**: Medium
**Prerequisites**: T001
**Files**: `src/parser/go.ts`

- Extraire fonctions top-level `func Name`.
- Extraire methodes `func (r Receiver) Method` sous le nom `Receiver.Method`.
- Extraire types top-level (`struct`, `interface`, alias), const et var utiles.
- Renseigner les lignes 1-indexed.

### T003 - Extraire fonctions et appels Go
**Complexity**: Medium
**Prerequisites**: T002
**Files**: `src/parser/go.ts`

- Isoler les corps de fonctions/methodes par comptage d'accolades.
- Extraire appels directs: `foo()`, `pkg.Foo()`, `receiver.Method()`, `NewX()`.
- Ignorer les mots-cles Go et constructions non-appels (`if`, `for`, `switch`, `return`, `go`, `defer`, etc.).

### T004 - Brancher `GoParser`
**Complexity**: Simple
**Prerequisites**: T001
**Files**: `src/parser/factory.ts`, `src/parser/index.ts`

- Instancier `GoParser` dans `ParserFactory`.
- Exporter `GoParser` depuis l'index parser.
- Verifier que `Analyzer.isSupported(file.go)` retourne true.

### T005 - Tests unitaires parser Go
**Complexity**: Medium
**Prerequisites**: T001, T002, T003, T004
**Files**: `src/parser/go.test.ts` ou tests existants

- Tester imports simples/groupes/alias.
- Tester exports fonctions/types/methodes.
- Tester appels dans une methode a receiver.

---

## Phase 2: Resolution Go module (5 tasks)

### T006 - Creer `GoModResolver`
**Complexity**: Medium
**Prerequisites**: None
**Files**: `src/core/go-mod.ts`

- Trouver le `go.mod` le plus proche en remontant depuis un fichier.
- Parser `module <path>` et `go <version>`.
- Mettre en cache les resultats par repertoire/module root.

### T007 - Resoudre les imports internes Go
**Complexity**: Medium
**Prerequisites**: T006
**Files**: `src/core/resolver.ts`

- Detecter les fichiers source Go par extension `.go`.
- Si un import commence par le module path courant, le convertir vers un chemin local.
- Pour un repertoire package, choisir un fichier `.go` representatif non-test de preference.

### T008 - Classifier stdlib et third-party Go
**Complexity**: Medium
**Prerequisites**: T007
**Files**: `src/core/resolver.ts`

- Eviter que les imports Go soient traites comme packages npm.
- Classifier `context`, `encoding/json`, `net/http`, `time`, etc. comme `third-party`/externe non interne.
- Classifier `github.com/...`, `golang.org/x/...`, `go.uber.org/...` comme dependances tierces si hors module courant.

### T009 - Ajouter fixtures Go
**Complexity**: Simple
**Prerequisites**: T001, T006
**Files**: `fixtures/go/**`

- Creer un `go.mod`.
- Ajouter `cmd/service/main.go`.
- Ajouter domaine, use case, ports et handler representatifs.
- Inclure au moins un import stdlib, un import tiers et deux imports internes.

### T010 - Tests resolution/explore Go
**Complexity**: Medium
**Prerequisites**: T007, T008, T009
**Files**: tests core existants ou nouveau test

- Verifier resolution module path -> fichier local.
- Verifier classification stdlib/third-party.
- Verifier `Analyzer.analyze` sur fixture Go.

---

## Phase 3: CLI et impact (5 tasks)

### T011 - Ajouter `.go` au parsing CLI
**Complexity**: Simple
**Prerequisites**: T004
**Files**: `src/cli/index.ts`

- Ajouter `go` dans la regex `parseEntry`.
- Mettre a jour les commentaires d'entree.
- Verifier `file.go:Type.Method` et `file.go:Type/Method`.

### T012 - Etendre les defaults `include`
**Complexity**: Simple
**Prerequisites**: T011
**Files**: `src/cli/index.ts`, `README.md`

- Ajouter `**/*.go` aux defaults `explore` et `impact`.
- Ajouter exclusions par defaut pertinentes: `vendor`, `.gomodcache` si non deja couvert.

### T013 - Ajouter route patterns Go
**Complexity**: Simple
**Prerequisites**: T010
**Files**: `config/route-patterns.txt`, `src/config/route-patterns.test.ts`

- Ajouter `**/cmd/**/main.go`, `**/*handler.go`, `**/*routes.go`, `**/*router.go`.
- Tester que les patterns matchent un handler et un `cmd/service/main.go`.

### T014 - Tests impact Go
**Complexity**: Medium
**Prerequisites**: T010, T012, T013
**Files**: tests core existants ou nouveau test

- Verifier dependants directs et transitifs depuis un fichier domaine Go.
- Verifier routes impactees selon patterns Go.

### T015 - Contrat JSON Go
**Complexity**: Simple
**Prerequisites**: T010, T014
**Files**: tests output ou contracts

- Verifier que la sortie JSON Go conserve `version`, `nodes`, `edges`, `stats`.
- Verifier `targetLine` quand un symbole exporte est trouve par fallback.

---

## Phase 4: Function-level Go (4 tasks)

### T016 - Normaliser les noms de methodes Go
**Complexity**: Simple
**Prerequisites**: T003, T011
**Files**: `src/parser/go.ts`, `src/cli/index.ts`

- Utiliser `Type.Method` comme nom canonique.
- Accepter `Type/Method` et `Type:Method` via la normalisation CLI existante.

### T017 - Resoudre appels locaux intra-fichier
**Complexity**: Medium
**Prerequisites**: T016
**Files**: `src/core/analyzer.ts`, `src/parser/go.ts`

- Faire fonctionner `explore file.go:Function`.
- Faire fonctionner `explore file.go:Type.Method`.
- Ajouter edges `call` pour fonctions/methodes du meme fichier.

### T018 - Resoudre appels inter-package simples
**Complexity**: Medium
**Prerequisites**: T007, T017
**Files**: `src/core/analyzer.ts`, `src/core/resolver.ts`

- Utiliser les imports pour lier `pkg.Func()` au package importe.
- En fallback, cibler le fichier package representatif si le symbole exact n'est pas trouve.

### T019 - Tests function-level Go
**Complexity**: Medium
**Prerequisites**: T017, T018
**Files**: tests core ou integration

- Tester `ReceiveInvoice.Execute`.
- Tester `NewManager`.
- Tester erreur fonction absente.

---

## Phase 5: LSP `gopls` optionnel (4 tasks)

### T020 - Ajouter `GoLspProvider`
**Complexity**: Medium
**Prerequisites**: T006
**Files**: `src/core/lsp/go.ts`

- Implementer `LspProvider` pour `gopls`.
- Verifier disponibilite via executable.
- Initialiser sur la racine du module/projet.

### T021 - Brancher `gopls` dans la factory LSP
**Complexity**: Simple
**Prerequisites**: T020
**Files**: `src/core/lsp/factory.ts`, `src/core/lsp/types.ts`, `src/core/lsp/index.ts`

- Mapper `.go` vers `GoLspProvider`.
- Ajouter `paths.gopls` dans `LspConfig`.
- Exporter le provider si necessaire.

### T022 - Post-traitement definition Go
**Complexity**: Medium
**Prerequisites**: T020, T021
**Files**: `src/core/lsp/go.ts`, `src/core/analyzer.ts`

- Utiliser `getDefinitionFromImport` pour positions exactes si possible.
- Conserver fallback resolver si `gopls` ne repond pas.

### T023 - Tests conditionnels gopls
**Complexity**: Simple
**Prerequisites**: T022
**Files**: tests LSP

- Ajouter tests qui se skip si `gopls` est absent.
- Verifier qu'un symbole dans un package multi-fichiers pointe vers sa declaration.

---

## Phase 6: Documentation et validation (4 tasks)

### T024 - Documenter le support Go
**Complexity**: Simple
**Prerequisites**: T012, T014, T019
**Files**: `README.md`, `fixtures/README.md`

- Ajouter Go aux features et langages supportes.
- Ajouter commandes `explore`, `impact`, fonction/methode, JSON.
- Mentionner `gopls` optionnel.

### T025 - Ajouter quickstart Go de spec
**Complexity**: Simple
**Prerequisites**: T024
**Files**: `specs/003-go-language-support/quickstart.md`

- Synchroniser avec les commandes de fixtures.

### T026 - Non-regression complete
**Complexity**: Simple
**Prerequisites**: T001-T025
**Files**: suite de tests

- Lancer `npm run test:run`.
- Lancer les commandes quickstart Go.
- Verifier les commandes existantes TS/Python/PHP.

### T027 - Nettoyage release notes
**Complexity**: Simple
**Prerequisites**: T026
**Files**: `CHANGELOG.md` ou notes de PR si applicable

- Documenter les limites connues: fallback sans resolution interprocedurale parfaite; `gopls` optionnel.

---

## Dependency Graph

```text
Phase 1: T001 -> T002 -> T003 -> T005
              \-> T004 ------/

Phase 2: T006 -> T007 -> T008 -> T010
                     \-> T009 -/

Phase 3: T011 -> T012
          T010 -> T013 -> T014 -> T015

Phase 4: T016 -> T017 -> T018 -> T019

Phase 5: T020 -> T021 -> T022 -> T023

Phase 6: T024 -> T025 -> T026 -> T027
```

## Parallel Execution Opportunities

- T006 peut etre fait en parallele de T001-T003.
- T009 peut etre fait pendant T006/T007.
- T013 peut etre fait des que la fixture Go existe.
- T020/T021 peuvent etre faits apres T006 sans attendre toute la function-level.
- T024 peut commencer apres stabilisation des commandes CLI.

## Summary

- **Total tasks**: 27
- **Priorite P1**: parser Go, resolver `go.mod`, `explore`, `impact`
- **Priorite P2**: function-level Go, `gopls`
- **Priorite P3**: documentation exhaustive et polish
- **Effort estime**: 1.5 a 3 jours selon profondeur LSP et tests d'integration
