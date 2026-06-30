# Feature Specification: Support du langage Go

**Feature Branch**: `003-go-language-support`
**Created**: 2026-06-30
**Status**: Draft
**Input**: Etendre les capacites de Spaghetti Compass au langage Go. On veut avoir les memes commandes (`explore`, `impact`, exploration par fonction/methode, sorties texte/JSON), mais adaptees au langage Go. Exemples terrain consultes: `~/code/MODELO_HUB/modelo-broker-pa` et `~/code/MODELO_HUB/modelo-bill-e` (chemin corrige depuis `bill-e`).

---

## User Scenarios & Testing

### User Story 1 - Explorer les imports Go fichier par fichier (Priority: P1)

En tant qu'utilisateur, lorsque j'execute `spaghetti-compass explore` sur un fichier `.go`, je veux voir les packages Go dont ce fichier depend, avec les imports internes resolus vers les fichiers/repertoires du module, les packages standards et tiers classes comme externes, et la meme sortie navigable que pour TypeScript, Python et PHP.

**Why this priority**: C'est la parite minimale avec les commandes existantes. Sans resolution d'import Go, Spaghetti Compass ne peut pas aider sur les backends `apps/backend` observes dans `modelo-broker-pa` et `modelo-bill-e`.

**Independent Test**: Creer une fixture Go avec `go.mod`, `cmd/service/main.go`, `internal/usecases/receive_invoice.go` et `internal/domain/invoice/entity.go`; executer `spaghetti-compass explore fixtures/go/cmd/service/main.go -c fixtures/go --json` et verifier que les imports internes pointent vers les fichiers Go attendus.

**Acceptance Scenarios**:

1. **Given** un module Go avec `go.mod` et un import interne `github.com/example/app/internal/domain/invoice`, **When** j'execute `explore` sur un fichier qui importe ce package, **Then** l'arete cible un fichier `.go` du package interne et la localisation est `internal`.
2. **Given** un fichier qui importe `context`, `encoding/json` ou `net/http`, **When** j'execute `explore`, **Then** ces imports sont classes `third-party` ou equivalent externe sans tenter de les resoudre dans le workspace.
3. **Given** un fichier qui importe `github.com/google/uuid`, **When** j'execute `explore`, **Then** l'import est visible comme dependance tierce et ne casse pas l'analyse transitive.
4. **Given** un import groupe avec alias, blank import ou dot import, **When** le fichier est parse, **Then** l'import est extrait sans erreur et l'alias n'empeche pas la resolution du package.

---

### User Story 2 - Analyse d'impact inverse sur projets Go (Priority: P1)

En tant qu'utilisateur, lorsque je modifie un fichier Go interne, je veux savoir quels fichiers Go et quels points d'entree/routes peuvent etre impactes via `spaghetti-compass impact`, comme je le fais deja pour les autres langages.

**Why this priority**: Les projets exemples contiennent beaucoup de domaines, use cases, ports, adapters, jobs et handlers. L'impact inverse est le flux le plus utile pour evaluer une modification dans ces architectures.

**Independent Test**: Dans la fixture Go, executer `spaghetti-compass impact fixtures/go/internal/domain/invoice/entity.go -c fixtures/go --json` et verifier que le resultat liste les use cases, handlers ou `cmd/service/main.go` qui dependent transitivement de ce domaine.

**Acceptance Scenarios**:

1. **Given** un fichier domaine importe par un use case lui-meme cable par `cmd/service/main.go`, **When** j'execute `impact` sur le fichier domaine, **Then** le use case apparait dans `dependents` et le point d'entree Go apparait dans `routes` si le pattern route le couvre.
2. **Given** un import interne resolu via le module path de `go.mod`, **When** l'analyse inverse construit le graphe, **Then** elle utilise le meme resolver Go que `explore`.
3. **Given** un repertoire `vendor/`, `.gomodcache/` ou un cache de dependances, **When** `impact` scanne le contexte, **Then** ces repertoires sont ignores par defaut.

---

### User Story 3 - Explorer une fonction, une methode ou un constructeur Go (Priority: P2)

En tant qu'utilisateur, lorsque je cible `file.go:FunctionName`, `file.go:Type.Method` ou un constructeur idiomatique `NewType`, je veux obtenir le graphe d'appels pertinent pour ce point d'entree Go.

**Why this priority**: Les deux projets Go consultes utilisent massivement les methodes a receiver (`func (uc *ReceiveInvoice) Execute`) et les constructeurs `NewX`. La parite "meme commandes" doit inclure ces formes.

**Independent Test**: Explorer `fixtures/go/internal/usecases/receive_invoice.go:ReceiveInvoice.Execute` et verifier que le graphe inclut les appels directs a `normalizeDocument`, `routeInvoice`, `reception.NewInboundDocument` ou equivalences de fixture.

**Acceptance Scenarios**:

1. **Given** une methode `func (uc *ReceiveInvoice) Execute(...)`, **When** j'execute `explore file.go:ReceiveInvoice.Execute`, **Then** le noeud fonction cible est trouve et ses appels directs sont affiches.
2. **Given** un constructeur `func NewManager(...) *Manager`, **When** j'execute `explore file.go:NewManager`, **Then** le noeud fonction cible est trouve comme une fonction top-level.
3. **Given** un appel `pkg.Function(...)` ou `receiver.Method(...)`, **When** le parser extrait les appels, **Then** le nom d'appel est conserve sous une forme exploitable pour une resolution LSP/fallback ulterieure.
4. **Given** une fonction demandee qui n'existe pas, **When** j'execute `explore file.go:Missing`, **Then** le comportement d'erreur existant `Function not found` est conserve.

---

### User Story 4 - Navigation precise avec gopls quand disponible (Priority: P2)

En tant qu'utilisateur, lorsque `gopls` est installe, je veux que Spaghetti Compass utilise le LSP Go pour trouver la definition exacte des symboles importes ou appeles, tout en gardant un fallback sans LSP.

**Why this priority**: Go a des packages multi-fichiers et des symboles dont la resolution precise depend du compilateur/module. `gopls` ameliore la navigation sans devenir une dependance obligatoire.

**Independent Test**: Avec `gopls` disponible, analyser une fixture dont un package contient plusieurs fichiers et verifier que `targetLine`/`targetColumn` pointent vers le symbole exact. Sans `gopls`, verifier que l'analyse reste file-level et ne plante pas.

**Acceptance Scenarios**:

1. **Given** `gopls` est disponible, **When** une definition de symbole Go est demandee, **Then** le provider Go LSP renvoie une position exacte si le serveur la fournit.
2. **Given** `gopls` est absent, **When** `explore` ou `impact` analyse un fichier `.go`, **Then** Spaghetti Compass utilise le parser/resolver Go fallback et affiche les dependances fichier/package.
3. **Given** un projet multi-module avec plusieurs `go.mod`, **When** un fichier `.go` est analyse, **Then** le module racine le plus proche du fichier source est utilise.

---

### User Story 5 - Documentation et fixtures Go (Priority: P3)

En tant que mainteneur, je veux des fixtures et une documentation Go claires pour valider rapidement les commandes existantes sur un projet Go representatif.

**Why this priority**: Les futures regressions seront plus faciles a attraper, et les agents pourront decouvrir le support Go sans deviner les options.

**Independent Test**: Lancer les commandes du quickstart Go et comparer la sortie texte/JSON aux criteres documentes.

**Acceptance Scenarios**:

1. **Given** le README liste les langages supportes, **When** le support Go est ajoute, **Then** Go apparait avec `.go`, resolution `go.mod` et niveau de support fonctionnel.
2. **Given** `fixtures/README.md`, **When** le support Go est ajoute, **Then** une section Go fournit au moins une commande `explore`, une commande fonction/methode et une commande `impact`.

---

### Edge Cases

- Imports groupes, alias (`foo "module/path"`), blank imports (`_ "module/path"`) et dot imports (`. "module/path"`).
- Fichiers Go avec `package main`, packages internes et packages multi-fichiers.
- Monorepo avec plusieurs `go.mod` (`apps/backend/go.mod`, `contracts/go/go.mod`) : choisir le `go.mod` le plus proche du fichier source.
- Imports module-qualified qui pointent vers un repertoire contenant plusieurs fichiers `.go`; choisir un fichier de package stable pour le noeud file-level, puis utiliser `gopls` pour la ligne exacte si disponible.
- Fichiers generes (`*.gen.go`, `zz_generated*.go`) : inclus si explicitement analyses, mais evitables via `--exclude`; ne pas imposer d'exclusion par defaut qui cacherait les clients generes utiles.
- Tests `*_test.go` : supportes comme entree explicite; exclus de l'impact par defaut si la commande exclut deja les tests, sauf override via `--include`.
- Build tags Go : ne doivent pas faire planter le parser fallback; `gopls` peut fournir une meilleure precision selon la configuration du module.
- Appels via interfaces ou injection de dependances : ne pas promettre une resolution interprocedurale parfaite en fallback.

## Requirements

### Functional Requirements

- **FR-001**: Le systeme DOIT reconnaitre `.go` comme extension supportee dans le parser, la factory parser, la factory LSP, le parsing d'entree CLI et les patterns d'inclusion par defaut des commandes concernees.
- **FR-002**: Le systeme DOIT extraire les imports Go simples et groupes depuis les blocs `import`, en conservant le module specifier exact et la ligne de declaration.
- **FR-003**: Le systeme DOIT parser le `go.mod` le plus proche du fichier source pour determiner le `module path` courant.
- **FR-004**: Le resolver DOIT resoudre les imports internes dont le specifier commence par le `module path` vers un repertoire ou fichier `.go` du workspace.
- **FR-005**: Le resolver DOIT classifier les packages de la bibliotheque standard Go et les modules externes comme dependances tierces/non internes, sans les confondre avec des packages npm.
- **FR-006**: Le systeme DOIT extraire les exports Go suivants: fonctions top-level, methodes a receiver (`Type.Method`), types top-level (`struct`, `interface`, alias/type), constantes et variables top-level lorsque c'est utile pour la navigation.
- **FR-007**: Le systeme DOIT permettre `explore file.go:Function`, `explore file.go:Type.Method` et `explore file.go:Type/Method` avec la meme normalisation que les autres langages.
- **FR-008**: Le parser Go DOIT extraire les appels directs dans les fonctions/methodes: appels locaux (`foo()`), selecteurs (`pkg.Foo()`, `receiver.Method()`), constructeurs `NewX(...)` et appels courants dans les closures.
- **FR-009**: Le systeme DOIT prendre en charge `impact` pour les fichiers `.go` en scannant les fichiers Go internes et en utilisant la resolution `go.mod`.
- **FR-010**: Les sorties texte et JSON DOIVENT conserver le contrat existant (`nodes`, `edges`, `stats`, `targetLine`, `targetColumn`, `resolvedVia`) et ne pas introduire de format Go separe.
- **FR-011**: Si `gopls` est disponible, le systeme DEVRAIT l'utiliser pour ameliorer `getDefinition`, `getDefinitionByName` et `getDefinitionFromImport` pour Go.
- **FR-012**: Si `gopls` est absent ou echoue, le systeme DOIT degrader proprement vers la resolution file/package sans interrompre `explore` ni `impact`.
- **FR-013**: Les commandes existantes TypeScript, Python et PHP NE DOIVENT PAS changer de comportement, hors ajout de `.go` dans les defaults documentes.
- **FR-014**: La documentation DOIT inclure des exemples Go pour `explore`, `impact`, sortie JSON et exploration fonction/methode.

### Key Entities

- **GoModuleInfo**: represente un `go.mod` trouve (`modulePath`, `moduleRoot`, `goVersion`, `filePath`).
- **GoImportInfo**: import Go extrait (`moduleSpecifier`, `alias`, `line`, `isBlank`, `isDot`, `isStandardLibrary`, `resolved`).
- **GoSymbol**: symbole exporte ou navigable (`name`, `kind`, `line`, `receiverType?`, `packageName`).
- **GoParser**: parser `.go` charge d'extraire imports, exports, fonctions et appels.
- **GoModResolver**: resolver module path -> chemin local, avec cache par racine de module.
- **GoLspProvider**: provider optionnel `gopls` conforme a l'interface `LspProvider`.

## Success Criteria

### Measurable Outcomes

- **SC-001**: `spaghetti-compass explore fixtures/go/cmd/service/main.go -c fixtures/go --json` retourne au moins une dependance interne Go resolue et au moins une dependance tierce/standard classee hors interne.
- **SC-002**: `spaghetti-compass impact fixtures/go/internal/domain/invoice/entity.go -c fixtures/go --json` retourne des dependants directs et transitifs Go coherents dans la fixture.
- **SC-003**: `spaghetti-compass explore fixtures/go/internal/usecases/receive_invoice.go:ReceiveInvoice.Execute -c fixtures/go --json` trouve la methode cible et au moins deux appels directs.
- **SC-004**: La suite `npm run test:run` passe apres l'ajout du support Go, avec tests unitaires pour parser/resolver et tests d'integration CLI ou core.
- **SC-005**: En absence de `gopls`, les tests Go fallback passent sans dependance reseau ni installation systeme.
- **SC-006**: Les snapshots/contrats JSON existants pour TypeScript, Python et PHP restent compatibles.
