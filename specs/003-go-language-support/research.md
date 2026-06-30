# Research: Support Go

**Feature Branch**: `003-go-language-support`
**Created**: 2026-06-30

## Sources observees

### Repertoire Spaghetti Compass actuel

- Parsers existants: `src/parser/typescript.ts`, `src/parser/python.ts`, `src/parser/php.ts`.
- Resolution: `src/core/resolver.ts` gere deja TypeScript aliases, imports Python relatifs, PHP Composer/PSR-4.
- LSP: `src/core/lsp/*` fournit une interface commune et des providers TypeScript/PHP/Python.
- CLI: `src/cli/index.ts` parse explicitement les extensions supportees et a des defaults `include` a etendre.
- Impact inverse: `src/core/impact.ts` scanne les fichiers supportes via `ParserFactory`.

### Exemples Go consultes

Chemins fournis/corriges:

- `~/code/MODELO_HUB/modelo-broker-pa`
- `~/code/MODELO_HUB/modelo-bill-e` (le chemin `~/code/MODELO_HUB/bill-e` n'existe pas localement)

Observations principales:

- Les deux projets utilisent un module principal sous `apps/backend/go.mod`.
- `modelo-broker-pa` contient aussi un module separe sous `contracts/go/go.mod`.
- Les imports internes sont module-qualified, par exemple `github.com/septeo-immobilier/broker-pa/internal/application/dtos`.
- Les layouts sont idiomatiques Go: `cmd/...`, `internal/domain/...`, `internal/application/...`, `internal/ports/...`, `internal/adapters/...`, `internal/jobs/...`.
- Les APIs applicatives utilisent des structs et des methodes a receiver, par exemple `func (uc *ReceiveInvoice) Execute(...)`.
- Les constructeurs idiomatiques `NewX` sont nombreux (`NewManager`, `NewProvider`, `NewMeteringDashboardUsecase`, etc.).
- Les points d'entree et routes sont disperses: `cmd/service/main.go`, `cmd/api/...`, handlers HTTP, `chi`, `huma`, `http.Handler`, jobs River.

## Decisions

### Decision 1: Ajouter un support Go fallback sans dependance obligatoire a `gopls`

**Decision**: Implementer d'abord un `GoParser` et un `GoModResolver` en TypeScript, puis ajouter `GoLspProvider` comme amelioration optionnelle.

**Rationale**: Les commandes actuelles doivent fonctionner dans un environnement Node/npm sans supposer que Go ou `gopls` est installe. Les parsers Python/PHP existants utilisent deja une approche legere, adaptee a une premiere version.

**Alternatives considered**:

- Dependence obligatoire a `gopls`: precise, mais fragile en CI et bloque les utilisateurs sans toolchain Go.
- Ajouter une librairie npm de parsing Go: meilleure AST, mais augmente la surface de dependances; a envisager seulement si le fallback regex devient insuffisant.
- Executer `go list` systematiquement: utile pour modules/packages, mais depend de Go installe et peut telecharger des modules.

### Decision 2: Resolution interne basee sur `go.mod`

**Decision**: Resoudre un import interne quand il commence par le `module path` du `go.mod` le plus proche. Convertir le suffixe en chemin sous la racine module, puis choisir un fichier `.go` stable dans le package.

**Rationale**: C'est le cas dominant observe dans `modelo-broker-pa` et `modelo-bill-e`. Cela couvre `internal/...`, `cmd/...` et les packages applicatifs sans avoir besoin de compiler le module.

**Details proposes**:

- Chercher `go.mod` en remontant depuis le fichier source.
- Parser la ligne `module <path>`.
- Pour `importPath = modulePath + "/internal/domain/invoice"`, resoudre vers `<moduleRoot>/internal/domain/invoice`.
- Dans un repertoire package, choisir un fichier non-test de preference:
  1. fichier contenant `package <name>` et un symbole cible si connu;
  2. fichier non `*_test.go`, non cache, non vendor;
  3. fallback lexicographique.

### Decision 3: Classification standard library vs third-party

**Decision**: Considerer comme bibliotheque standard les imports sans domaine (`context`, `encoding/json`, `net/http`, `time`, etc.) ou connus par heuristique simple; les autres bare/module paths externes sont `third-party`.

**Rationale**: Le code actuel a une notion `isNpmPackage`; pour Go il faut eviter de traiter tous les imports bare comme npm. La classification doit etre language-aware.

**Note**: Une table exhaustive stdlib peut etre ajoutee, mais un premier heuristic "pas de point dans le premier segment" couvre correctement la majorite des imports stdlib.

### Decision 4: Function-level Go via declarations et appels directs

**Decision**: Le parser Go extrait:

- fonctions top-level: `func Name(...)`;
- methodes: `func (r Receiver) Method(...)`, nommees `Receiver.Method`;
- types top-level: `type Name struct`, `type Name interface`, alias;
- appels directs dans le corps: `Name(...)`, `pkg.Name(...)`, `receiver.Name(...)`.

**Rationale**: C'est suffisant pour les usages observes: use cases avec `Execute`, handlers, constructors `NewX`, jobs, repositories/adapters.

**Limit**: Le fallback ne resout pas parfaitement le type dynamique d'un receiver ni les appels via interface. `gopls` prend le relais quand disponible.

### Decision 5: Patterns route Go

**Decision**: Etendre `config/route-patterns.txt` avec des patterns Go conservateurs:

- `**/cmd/**/main.go`
- `**/*handler.go`
- `**/*handlers.go`
- `**/*routes.go`
- `**/*router.go`
- `**/internal/http/**/*.go`
- `**/internal/handlers/**/*.go`
- `**/internal/server/**/*.go`

**Rationale**: Les projets observes ont du cablage dans `cmd/service/main.go`, des handlers HTTP et des packages serveur. Les routes exactes peuvent etre framework-specific; l'impact inverse a besoin d'identifier des points d'entree, pas de parser toutes les routes HTTP.

### Decision 6: Ne pas exclure globalement les fichiers generes

**Decision**: Ne pas exclure `*.gen.go` par defaut. Exclure seulement les caches lourds (`vendor`, `.gomodcache`) par defaut.

**Rationale**: `modelo-broker-pa/contracts/go` contient des fichiers generes (`types.gen.go`, `client.gen.go`) qui peuvent etre de vraies dependances utiles. L'utilisateur peut toujours ajouter `--exclude "**/*.gen.go"`.

## Open Questions

- Faut-il ajouter une option explicite `--go-mod <path>` ou conserver uniquement l'auto-detection du `go.mod` le plus proche pour la premiere version ?
- Les points d'entree "routes" doivent-ils inclure les workers/jobs (`**/*worker.go`) par defaut, ou rester focalises HTTP/API ?
- Pour les packages multi-fichiers, le noeud cible file-level doit-il preferer le fichier contenant le symbole importe quand `gopls` est absent, ou un fichier stable du package suffit-il pour P1 ?
