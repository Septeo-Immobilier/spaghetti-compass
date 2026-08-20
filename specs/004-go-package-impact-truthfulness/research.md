# Research: Truthful Go package impact analysis

**Feature**: `004-go-package-impact-truthfulness` | **Scope**: PLAN / research | **Date**: 2026-08-19
**Spec**: [spec.md](./spec.md)

## Method

Every claim below is grounded in the working tree at commit `cc67147`, not in the
published v1.0.0 line numbers quoted by the bug report. Files read: `src/core/go-mod.ts`,
`src/core/impact.ts`, `src/core/resolver.ts`, `src/core/analyzer.ts`, `src/output/impact.ts`,
`src/output/json.ts`, `src/cli/index.ts`, `src/core/lsp/availability.ts`, `src/parser/factory.ts`,
`src/core/go-mod.test.ts`, `src/core/go-integration.test.ts`, `src/core/impact.test.ts`,
`fixtures/go/**`, `config/route-patterns.txt`, `README.md`, `package.json`, `tsconfig.json`.

The defect was reproduced against the installed v1.0.0 binary on a throwaway module written
outside the repository. Reverse reach was resolved with the project's own `impact` command
(the tool under repair analysing itself), not inferred from text search.

## 1. Ground truth: where the defect lives

### 1.1 The single-representative-file rule

`GoModResolver._resolveImportInternal` (`src/core/go-mod.ts:219-274`) maps a Go import path to
exactly one file. The relevant tail:

```
src/core/go-mod.ts:265  const nonTestFiles = goFiles.filter((f) => !f.endsWith('_test.go'));
src/core/go-mod.ts:268  const candidates = nonTestFiles.length > 0 ? nonTestFiles : goFiles;
src/core/go-mod.ts:271  candidates.sort();
src/core/go-mod.ts:273  return path.join(pkgDir, candidates[0]);
```

Line 271 is the defect. The directory listing at line 249 already enumerates the whole package;
line 273 discards all of it but the alphabetically first entry. The public signature is
`resolveImport(importPath: string, fromFile: string): string | null` (`src/core/go-mod.ts:93`),
memoised at `src/core/go-mod.ts:99-106` through `importCache: Map<string, string | null>`
(`src/core/go-mod.ts:34`) keyed on `moduleRoot + '\0' + importPath`.

The `vendor/` and `.gomodcache/` exclusion is applied per candidate file at
`src/core/go-mod.ts:254-258` via `_isInVendorOrCache` (`src/core/go-mod.ts:279-282`).

### 1.2 How the single path becomes a single reverse edge

`PathResolver.resolve` routes Go sources into that resolver and returns its scalar result
unchanged (`src/core/resolver.ts:124-130`). `ImpactAnalyzer.resolveInternalImports`
(`src/core/impact.ts:165-195`) then pushes one absolute path per import specifier
(`src/core/impact.ts:187-192`), and `ImpactAnalyzer.analyze` registers one reverse edge per
resolved path (`src/core/impact.ts:81-92`). A package with ninety files therefore contributes
one reverse edge, attached to whichever file sorts first.

`directDependents` is read straight off that map at `src/core/impact.ts:100`, and the BFS at
`src/core/impact.ts:102-112` walks the same edges, so the error propagates identically into
`dependents` and `routes`.

### 1.3 The unqualified success line

`formatImpactText` prints the green verdict unconditionally when the set is empty:

```
src/output/impact.ts:59  if (result.dependents.length === 0) {
src/output/impact.ts:60    lines.push('✅ No file depends on this target — modifying it impacts nothing else.');
src/output/impact.ts:61    return lines.join('\n');
```

`formatImpactJson` (`src/output/impact.ts:112-114`) is a bare `JSON.stringify(result, null, 2)`,
so the wire payload is exactly the `ImpactResult` interface declared at `src/core/impact.ts:30-47`.
Any field added to that interface reaches the JSON with no formatter change.

### 1.4 `impact` starts no language server — confirmed

`src/core/impact.ts` imports only `node:path`, `node:fs`, `PathResolver` and `ParserFactory`
(`src/core/impact.ts:10-14`). It has no reference to `LspProviderFactory`, and the CLI's
degraded-LSP loop lives exclusively in the `explore` action (`src/cli/index.ts:243-251`, reading
`analyzer.getLspStatuses()`). The `impact` action (`src/cli/index.ts:281-390`) writes nothing to
stderr on a successful run. Measured on the reproduction: stderr is zero bytes.

This settles FR-008 and the corresponding edge case: the package-granularity note is a new,
independent signal. It must not reuse `degradedMessage('go')` (`src/core/lsp/availability.ts:164-173`),
whose text names `gopls` and would be false here.

## 2. Reproduction evidence

A throwaway module — `internal/repo/aaa_alpha.go` (referenced by nothing) and
`internal/repo/inbound_repository.go` (whose constructor `cmd/api/main.go` calls) — run against
the published v1.0.0 binary:

| Target | `directDependents` | `dependents` | `routes` | exit |
|---|---|---|---|---|
| `internal/repo/inbound_repository.go` | `[]` | `[]` | `[]` | 0 |
| `internal/repo/aaa_alpha.go` | `["cmd/api/main.go"]` | `["cmd/api/main.go"]` | 1 (`cmd/api/main.go`) | 0 |

The file that is genuinely used reports nothing; the file that is used by nobody absorbs the
package's entire blast radius, including the route match, and text mode prints
`✅ No file depends on this target — modifying it impacts nothing else.` on the first row.

Renaming `aaa_alpha.go` to `zzz_alpha.go`, with no content change, swaps the two rows exactly.
This confirms SC-002's premise: today the reported impact of a Go file is a function of its
neighbours' filenames.

## 3. Decisions

### D1 — Widen inside `GoModResolver` behind a new additive API

**Decision**: add `GoModResolver.resolvePackageFiles(importPath, fromFile): string[]` next to the
existing `resolveImport`, and a `PathResolver.resolveAll(moduleSpecifier, fromFile): string[]`
that returns the package file set for Go sources and `[resolve(...)]` (or `[]`) for every other
language. Switch only `ImpactAnalyzer.resolveInternalImports` (`src/core/impact.ts:187`) to
`resolveAll`. Leave `resolve` and `resolveImport` untouched.

**Why**: `PathResolver.resolve` has seven call sites, six of them in `src/core/analyzer.ts`
(lines 229, 302, 515, 727) driving the `explore` command and its function-level call graph, and
one in `src/core/impact.ts:187`. Changing its `string | null` return type would force `explore`
to answer a question it does not ask, for no benefit the spec claims. An additive API confines
the change to the one consumer that needs it.

**Alternatives rejected**:

- *Change `resolveImport` to return `string[]`.* Ripples into `PathResolver.resolve`, then into
  all six `analyzer.ts` call sites and the node-identity logic at `src/core/analyzer.ts:247`
  (`targetId = resolvedPath || moduleSpecifier`). It also breaks two existing unit tests that
  assert a scalar (`src/core/go-mod.test.ts:153` and `:214`), which SC-004 requires to keep
  passing unchanged.
- *Expand siblings inside `ImpactAnalyzer`.* Cheaper, but it re-implements the non-test
  preference and the `vendor/`/`.gomodcache/` rule (`src/core/go-mod.ts:254-268`) in a second
  place, and it has no way to tell a directory that is a Go package from a directory that merely
  contains the resolved file. Keep it in mind only as a fallback if the resolver refactor proves
  larger than expected.

**Cache consequence**: `importCache` (`src/core/go-mod.ts:34`) must gain a sibling keyed the same
way but holding `string[] | null`. Without it, every importer of a ninety-file package repeats
the `readdirSync` at `src/core/go-mod.ts:249`, which is precisely how NFR-001 would be missed.

### D2 — Express granularity as an enum, not a boolean

**Decision**: add `granularity: 'file' | 'package'` to `ImpactResult`, plus a short
`granularityNote: string | null` carrying the human-readable reason. Derive it once per
invocation from the target's parser (`ParserFactory.getParser(target).name === 'go'`, see
`src/parser/go.ts:14`), not per edge.

**Why an enum**: the spec's own Out of Scope section keeps symbol-level narrowing as future work.
A boolean `packageGranular` cannot later express a third state without a breaking payload change;
an enum admits `'symbol'` additively. This mirrors the industry precedent surveyed in section 5.

**Why per-target rather than per-edge**: reverse edges never cross languages in this codebase —
`resolveInternalImports` produces an edge only when the importer's own parser resolves the
specifier, so a Go importer only ever points at Go files and the transitive closure of a Go
target is entirely Go. The target's language therefore determines the granularity of the whole
result. This invariant must be re-examined if cross-language edges are ever introduced; record it
as a comment at the derivation site.

**Naming**: `granularity` over `confidence`. What varies is the resolution unit, which is a fact
about the method; "confidence" suggests a probability the tool does not compute.

### D3 — Emit the stderr note from the CLI action, not from the core

**Decision**: emit the note in `src/cli/index.ts`, in the `impact` action, immediately after
`analyzer.analyze(...)` (`src/cli/index.ts:365`), guarded by `result.granularity === 'package'`.
Define its text as a new exported constant, not through `degradedMessage`.

**Why**: `ImpactAnalyzer` is a pure computation today and writing to stderr from it would make it
untestable without stream capture. The CLI is already the layer that owns degraded-mode output,
per the `explore` precedent at `src/cli/index.ts:243-251`. Guarding on the result field makes the
"exactly once per invocation" clause of FR-008 structural rather than bookkeeping — there is one
result per invocation, so there is one line.

**~~Open point for ANALYZE~~ — RESOLVED (R2): emit in both modes.** US2 acceptance scenario 6 scopes
the line to text mode, while FR-008 says "per invocation" without qualification. ANALYZE settled it in
favour of both modes: stderr never pollutes the JSON on stdout, and the codebase already applies that
reasoning explicitly at `src/cli/index.ts:182` ("Under --json, send this to stderr to keep stdout
clean"). `contracts/impact-cli.md` section 6 is normative on this; the guard is
`result.granularity === 'package'` with no `options.json` condition.

### D4 — Branch the empty-result text on granularity

**Decision**: replace the unconditional early return at `src/output/impact.ts:59-62` with a branch
that keeps the existing line verbatim for `granularity === 'file'` and prints a qualified
statement for `'package'`. Exact strings are fixed in
[`contracts/impact-cli.md`](./contracts/impact-cli.md).

**Why keep the existing line byte-identical for non-Go**: FR-005 and US2 scenario 4 require
TypeScript, Python and PHP output to be unchanged, and the string is plausibly asserted by
downstream consumers grepping the tool's output.

### D5 — Cost model for NFR-001

The widening does not add filesystem work. `readdirSync` at `src/core/go-mod.ts:249` already runs
once per distinct `(moduleRoot, importPath)` pair and is already memoised; the change returns the
list it already built instead of discarding it. Provided the cache widens with the return type
(see D1), added cost is confined to:

- **Reverse map size**: `reverseDeps` (`src/core/impact.ts:81`) grows from one entry per resolved
  import to `k` entries, `k` being the imported package's non-test file count. On the reported
  context — roughly 1,900 scanned files, largest Go package roughly 90 files — this is a growth in
  `Set` insertions, all O(1), with no additional parse or stat.
- **BFS frontier**: the loop at `src/core/impact.ts:102-112` dedupes through `parent`, so each
  file is still enqueued at most once. The visit count is bounded by the file count regardless of
  edge multiplicity; only edge traversal grows.

Parsing dominates total wall-clock time and is untouched, so the 20% budget is expected to hold
with wide margin. The measurement itself belongs to the plan's test strategy.

### D6 — Fixture placement must avoid the existing assertions

**Decision**: add the multi-file package as a **new** directory under `fixtures/go`, not by adding
a file to an existing package.

**Why**: `src/core/go-integration.test.ts:71-82` asserts on
`fixtures/go/internal/domain/invoice/entity.go`. Widening only ever adds dependents, so that
assertion survives — but adding a second file to that same directory would be gratuitous risk.
More sharply, the new file must not sort before an existing one in any package an assertion names.

`src/core/go-mod.test.ts` is unaffected either way: it builds its own module under `os.tmpdir()`
(`src/core/go-mod.test.ts:33-72`) and never reads `fixtures/go`.

**Route-pattern hazard**: `config/route-patterns.txt` marks `**/*handler.go`, `**/*handlers.go`,
`**/*routes.go`, `**/*router.go`, `**/internal/handlers/**/*.go` and `**/cmd/**/main.go` as Go
routes. New fixture filenames must avoid those suffixes unless the test intends a route match,
or existing route-count assertions will shift.

**Non-decision, recorded deliberately**: sibling files of the same package are *not* made
dependents of each other. Editing `p1.go` does recompile the package that `p2.go` belongs to, so
an argument exists for the edge — but no requirement asks for it, and adding it would make every
multi-file Go package report a non-zero `dependents` count even when nothing imports it,
destroying the leaf signal the spec is trying to make trustworthy.

## 4. Version grounding

No new runtime or development dependency is introduced by this feature. The work is confined to
existing modules and to `vitest` tests using APIs the suite already uses.

| Library | `package.json` | Context7 cache | Verdict |
|---|---|---|---|
| typescript | `^5.9.3` (`package.json:62`) | 5.9.3 | Trusted. Strict mode is already on (`tsconfig.json`), so the new `granularity` union type is checked exhaustively at compile time. |
| vitest | `^4.0.18` (`package.json:75`) | entry claims 4.0.7 | Version claim **distrusted**: 4.0.7 does not satisfy `^4.0.18`, and the cache's own summary mis-describes this as "minor within range". Treat the declared range as authoritative. The behavioural note that survives independently — v4 removed the `done()` callback, so all async tests use promises — matches the existing suite, which is already promise-based (`src/core/go-integration.test.ts:31`). |
| eslint | `^9.39.2` (`package.json:65`) | 9.39.3 | Trusted; the cached patch satisfies the declared range. No rule-level impact. |
| commander | `^12.1.0` (`package.json:59`) | absent from cache | No new option or subcommand is added, so no version-sensitive surface. Flagged as unfetched. |

**Manifest drift to report upstream**: the PLAN input describes the runtime as `Node >=18`, but
`package.json:53` declares `"node": ">=20.0.0"` and `.github/workflows/release.yml:35` pins
`node-version: "20"`. Node 20 is the correct floor.

**Docker pin for every command this feature needs** (Docker-only policy). One tag for the whole
feature: `node:20.18.1-bookworm-slim`. An earlier draft of this section used `node:20.19-alpine`;
ANALYZE harmonized it to the tag `plan.md` and `quickstart.md` already carry (A-006). The pinned tag
wins on two counts — it fixes a patch version rather than floating on a minor, and `bookworm` matches
the CI runner's glibc userland where `alpine`'s musl does not. Both satisfy `engines.node >=20.0.0`
(`package.json:53`) and `.github/workflows/release.yml:35` (`node-version: "20"`).

```bash
# Unit and integration suite
docker run --rm -v "$PWD:/workspace" -w /workspace node:20.18.1-bookworm-slim \
  sh -c "npm ci && npm run test:run"

# Dogfood the CLI against the Go fixtures
docker run --rm -v "$PWD:/workspace" -w /workspace node:20.18.1-bookworm-slim \
  sh -c "npm ci && npm run build && node bin/spaghetti-compass.js impact \
         fixtures/go/internal/domain/invoice/entity.go -c fixtures/go --json"
```

## 5. Survey: how comparable tools express granularity

The question FR-004 poses — how a reverse-dependency answer declares the unit it resolved at — has
an established answer in code-intelligence tooling.

- **SCIP / LSIF, and the GitHub and Sourcegraph code-navigation UIs built on them** draw the
  sharpest precedent. Results are labelled *precise* when produced by a language indexer and
  *search-based* when produced by text heuristics, and the label ships with the result rather than
  being inferred from its emptiness. This is exactly the shape FR-004 asks for, including the
  requirement that the label be present on non-empty results too.
- **Bazel and Buck** make the unit explicit in the query language itself: `rdeps(//..., //lib:foo)`
  answers in targets, and no user expects a file-level answer, because the build graph has no
  file-level node. Granularity is communicated by the type of the returned entity.
- **`madge` and `dependency-cruiser`** (JavaScript) are file-granular throughout and carry no
  confidence field, which matches what this tool does for TypeScript today and is why FR-005 can
  be satisfied by a constant `'file'`.
- **`pydeps` and `pyan`** answer at module granularity, where a Python module is a file, so the
  distinction collapses and never had to be named.
- **`cargo tree` and `npm ls`** answer at package granularity and, like Bazel, encode it in the
  entity type rather than in a field.

The consistent lesson is that a tool answering at a coarser unit than its output type suggests —
which is precisely this tool's situation, since it emits file paths for a package-level Go
computation — must name the discrepancy in the payload. The SCIP two-value label is the closest
precedent, and its weakness is instructive: a two-value enum was later strained by the wish to
express intermediate states, which is the concrete argument behind D2's rejection of a boolean.

## 6. Does Go's own tooling permit a file-exact answer?

It argues firmly against one.

The Go specification makes the package, not the file, the unit of import: an import declaration
names a package path and binds a package, and the file split within a package directory is
invisible to importers. `go list` reflects this everywhere — `go list -deps ./...` enumerates
packages, `go list -json` reports `GoFiles` as an attribute *of* a package, and there is no
`go list` form that answers "which files import this file", because the question has no referent
in the language. `go/packages`, the library gopls itself is built on, loads `NeedDeps` as a
package-to-package graph for the same reason.

The one place Go tooling does answer below package level is symbol reference lookup
(`textDocument/references` in gopls), which is symbol-exact — a strictly *finer* unit than files,
not a file-level unit. That is the future work the spec defers.

So the honest label for a Go `impact` result is `package` in every case, including single-file
packages and including non-empty results, which is what US2 scenarios 3 and the single-file edge
case already require. There is no configuration, and no `gopls` installation, under which the
current import-edge method could truthfully claim file exactness.

## 7. Resolved blast radius

`spaghetti-compass doctor` succeeds on the host and the binary resolves to this repository's own
`bin/spaghetti-compass.js`. Reach below is **RESOLVED**, obtained by running the tool's `impact`
command over the repository (69 scanned files, no route matches — this repository has no route
files, which is expected and not a failure):

| Touched file | Direct dependents | Transitive dependents |
|---|---|---|
| `src/core/go-mod.ts` | `src/core/resolver.ts` | `src/cli/index.ts`, `src/core/analyzer.ts`, `src/core/impact.ts`, `src/core/resolver.ts`, `src/output/impact.ts` |
| `src/core/resolver.ts` | `src/core/analyzer.ts`, `src/core/impact.ts` | `src/cli/index.ts`, `src/core/analyzer.ts`, `src/core/impact.ts`, `src/output/impact.ts` |
| `src/core/impact.ts` | `src/cli/index.ts`, `src/output/impact.ts` | `src/cli/index.ts`, `src/output/impact.ts` |
| `src/output/impact.ts` | `src/cli/index.ts` | `src/cli/index.ts` |

The single actionable reading: `src/core/analyzer.ts` sits in the blast radius of both
`go-mod.ts` and `resolver.ts`, which is the `explore` command. D1 exists specifically to keep that
reach inert — the additive API means `analyzer.ts` is reachable but unaffected. A regression run of
`src/core/go-integration.test.ts` SC-001 and SC-003, which exercise `explore`, is the cheap proof.

## 8. Questions carried into ANALYZE — all settled

ANALYZE (Stage `tasks-delta`, 2026-08-19) closed all three. Answers recorded here so no implementer
re-opens them.

1. **Stderr note under `--json`** (see D3). ~~US2 scenario 6 says text mode; FR-008 says per
   invocation. Recommendation: both modes.~~ **RESOLVED (R2): both modes.** FR-008's "per invocation"
   is unqualified, US2 scenario 6 illustrates text mode without excluding JSON, and stderr never
   pollutes the JSON document on stdout. `contracts/impact-cli.md` section 6 is now normative on this.
2. **Field naming is not fixed by the spec.** FR-004 requires "a field" without naming it. This
   research proposes `granularity` / `granularityNote`. **RESOLVED (R1): `granularity` /
   `granularityNote`, values `'file' | 'package'`.** The competing PLAN leg had proposed
   `confidence` / `confidenceReason`; `plan.md` and `quickstart.md` were amended to match this file,
   the contracts and `data-model.md`. Grounds: "confidence" implies a probability the tool never
   computes, `spec.md` already speaks of package granularity 8 times, and the machine-readable schema
   was already written around `granularity`. Renaming it after release is a breaking payload change.
3. **README JSON documentation** at `README.md:366-367` enumerates the payload fields and omits the
   new ones. FR-011 only mandates the "Known limitations" paragraph, so this stays a Low finding.
   **Two corrections (A-011).** The claim that "the two edits sit three lines apart" was wrong: the
   `--json` key list is at `README.md:366-367` and the limitations paragraph at `README.md:450-452`,
   ~85 lines apart. And FR-011's mandatory scope is itself two sites, not one — `README.md:175-177`
   (the optional-`gopls` blockquote, which is the sentence `spec.md:67` quotes) and
   `README.md:450-452`. All three edits are folded into one task; see `plan.md` "README scope
   (FR-011)".
