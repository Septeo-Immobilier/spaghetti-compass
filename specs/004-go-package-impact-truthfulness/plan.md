# Implementation Plan: Truthful Go package impact analysis

**Branch**: `004-go-package-impact-truthfulness` | **Date**: 2026-08-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/004-go-package-impact-truthfulness/spec.md`

---

## Summary

`ImpactAnalyzer` builds its reverse graph from `PathResolver.resolve()`, which for Go delegates to
`GoModResolver.resolveImport()`. That method returns **one** representative `.go` file per imported
package — the alphabetically first non-test file (`src/core/go-mod.ts:265-273`). Every reverse edge
for an imported Go package therefore lands on that single file, and every sibling file of the same
package reports zero dependents.

The fix has two halves:

1. **Widen the reverse edge (FR-001..FR-003, FR-009).** Give `GoModResolver` a second, additive entry
   point `resolvePackageFiles()` returning **every** file of the package under the same
   non-test-preferred selection rule. `PathResolver` exposes it as `resolveAll()`; only `ImpactAnalyzer`
   consumes it. `resolveImport()` keeps returning `resolvePackageFiles()[0]`, so `explore`, the call
   graph and every existing caller are byte-for-byte unchanged.
2. **Label the granularity (FR-004..FR-008).** `ImpactResult` gains two additive fields, `granularity`
   and `granularityNote`, derived from the target's language. Text output replaces the unqualified
   success line for package-granular empty results; the CLI emits one stderr note per invocation; the
   exit code stays `0`.

Plus a multi-file Go fixture as the regression guard (FR-010) and a README correction (FR-011).

## Technical Context

**Language/Version**: TypeScript 5.9.3 (`strict`, `NodeNext` ESM, `tsc` build to `dist/`)
**Primary Dependencies**: commander 12.1 (CLI), typescript 5.9.3 (runtime dep, used by the TS parser). No new dependency.
**Storage**: N/A — the tool reads the filesystem and holds in-process `Map` caches only.
**Testing**: vitest 4.0.18 (`npm run test:run`), co-located `*.test.ts` next to sources
**Target Platform**: Node.js >= 20 CLI, published as `@septeo-immo/spaghetti-compass` (v1.0.0)
**Project Type**: single CLI package (`src/{cli,core,output,parser,config,types}/`)
**Performance Goals**: NFR-001 — <= 20% added wall-clock on a ~1,900-file mixed context with a ~90-file Go package
**Constraints**: `--json` payload additive only; exit code `0` preserved (FR-007); no LSP, no Go toolchain, no network
**Scale/Scope**: 5 source files touched, 1 source file created, 3 fixture files added, 2 README paragraphs. No new module, no new dependency.

**Version evidence**: TypeScript 5.9.3, vitest 4.0.18 and eslint 9.39.2 are the three entries in the
Context7 cache (`.claude-flow/state/flow-context7-fetcher.json`), all `speculative: false` and all
declared in `package.json`. No decision in this plan rests on anything outside that set — the feature
introduces no dependency.

Two caveats on that evidence, verified during ANALYZE (A-009) and recorded rather than glossed:

- **Node**: `package.json:53` declares `"node": ">=20.0.0"`. An earlier PLAN input said `>=18`; that was
  wrong. The pinned Docker image below is chosen against `>=20.0.0`, not against `>=18`.
- **vitest**: the cache entry carries `"version": "4.0.18"` but `"actualVersionResolved": "4.0.7"` and
  links to `v4.0.7` docs. The cache's own `manifestDrift` summary calls this "minor within range", which
  is **false** — `4.0.7` does not satisfy `^4.0.18` (`package.json:75`). The declared range is
  authoritative; the snippets were fetched against an older minor. No decision in this plan depends on a
  vitest API that moved between 4.0.7 and 4.0.18, so the drift is recorded, not acted on.

## Constitution Check

`.specify/memory/constitution.md` is an **unfilled spec-kit template**: every principle is still the
literal placeholder `[PRINCIPLE_N_NAME]` / `[PRINCIPLE_N_DESCRIPTION]`, and `[GOVERNANCE_RULES]` is
likewise unwritten. There is no ratified principle for this plan to comply with or to waive.

- **Gate result**: vacuous pass — nothing to check against.
- **Constitution waivers**: none. A waiver against a placeholder would be theatre.
- **Recorded for ANALYZE**: the absent constitution is a repository-level gap, not a defect of this
  feature. It is out of scope here and should not be silently filled in inside a bug-fix branch.

The de-facto conventions this plan does follow, read off the codebase rather than off a document:
TDD via co-located `*.test.ts`, `strict` TypeScript with no `any` escape, no new runtime dependency,
and additive-only changes to published output contracts.

## Blast radius

**Blast radius: RESOLVED (spaghetti-compass)**

`spaghetti-compass doctor` succeeded on the host (the binary is this repository, linked globally).
Reach resolved with `spaghetti-compass impact <file> -c . --json -e "**/node_modules/**" "**/dist/**" "**/vendor/**"`
— the default exclude list drops `**/*.test.*`, which would have hidden every test-file dependent:

| Touched file | Direct dependents | Transitive reach |
|---|---|---|
| `src/core/go-mod.ts` | `resolver.ts`, `go-mod.test.ts` | `resolver.ts`, `impact.ts`, `analyzer.ts`, `cli/index.ts`, `output/impact.ts`, + `resolver.test.ts`, `impact.test.ts`, `go-integration.test.ts` |
| `src/core/resolver.ts` | `analyzer.ts`, `impact.ts`, `resolver.test.ts` | `cli/index.ts`, `output/impact.ts`, + `impact.test.ts`, `go-integration.test.ts` |
| `src/core/impact.ts` | `cli/index.ts`, `output/impact.ts`, `impact.test.ts`, `go-integration.test.ts` | same (no deeper layer) |
| `src/output/impact.ts` | `cli/index.ts` | `cli/index.ts` |
| `src/cli/index.ts` | none | none (true leaf; only `bin/spaghetti-compass.js` loads it, through `dist/`) |

Two consequences the tasks must honour:

- `src/core/analyzer.ts` (the `explore` path) sits in `go-mod.ts`'s reach. It is **not** in the touched
  set, which is exactly why `resolveImport()` must keep its current single-file semantics.
- `src/core/resolver.test.ts:124` asserts on Go resolution behaviour and must stay green unmodified.

## Architecture Decision

### Points of impact

| Component | Current role | Change |
|---|---|---|
| `src/core/go-mod.ts` | `resolveImport()` -> one representative `.go` file | Extract the candidate-selection logic; add public `resolvePackageFiles()` -> `string[]`; `resolveImport()` becomes `resolvePackageFiles()[0] ?? null` |
| `src/core/resolver.ts` | `resolve()` -> `string \| null` for every language | Add `resolveAll()` -> `string[]`: Go delegates to `resolvePackageFiles()`, every other language wraps `resolve()` in a 0-or-1 array |
| `src/core/impact.ts` | `resolveInternalImports()` uses `resolve()` | Use `resolveAll()`; add `granularity` / `granularityNote` to `ImpactResult`, computed from the target's parser name |
| `src/output/impact.ts` | Prints the unqualified success line on empty | Branch on `granularity` for the empty case (FR-006) |
| `src/cli/index.ts` | Prints result, exits `0` | Emit one stderr note when `granularity === 'package'` (FR-008); exit code untouched (FR-007) |
| `fixtures/go/**` | 5 files, every package single-file | Add a two-file package plus an external consumer (FR-010) |
| `README.md` | **Two** Go claim sites, not one (ANALYZE A-007) | See "README scope (FR-011)" below |

### Decision 1 — second entry point, not a changed one

`GoModResolver.resolveImport()` is consumed by `PathResolver.resolve()` (`src/core/resolver.ts:127`),
which feeds **both** `Analyzer` (`explore`, call graph, storytelling) and `ImpactAnalyzer`. Those two
want different things from the same import:

- `explore` renders **one node per import edge**. Returning 90 files for one `import` line would turn a
  readable graph into noise and would change `explore`'s output — explicitly out of scope (spec, "Out of scope").
- `impact` asks "who reaches this file", and the honest Go answer is "everyone who imports the package".

So the widening is a **new method**, not a modified one. `resolveImport()` keeps returning the sorted
first candidate, which is definitionally `resolvePackageFiles()[0]`; the existing `go-mod.test.ts`
assertions stay green without edits, including the non-test-preference and `_test.go`-fallback pair.

Rejected alternative: a boolean flag on `resolveImport()`. It changes a published-behaviour method's
signature for every caller in order to read a call-site flag, and it makes "which mode am I in" implicit
at each of the five call sites. A second name states the intent where it is read.

### Decision 2 — cache the array, derive the scalar

`GoModResolver` holds `importCache: Map<string, string | null>` keyed `moduleRoot + '\0' + importPath`.
Replace it with `packageFilesCache: Map<string, string[]>` on the same key; `resolveImport()` reads
`[0] ?? null` from it. One `readdirSync` per package per process, as today — this is what keeps NFR-001
affordable: widening costs `k` extra `Set.add` calls per edge (`k` = files in the package), not `k`
extra directory reads. `clearCache()` clears the new map.

`PathResolver` gets a parallel `resolvedAllCache: Map<string, string[]>` keyed `fromFile + ':' + specifier`,
mirroring the existing `resolvedCache`.

### Decision 3 — granularity is a property of the target's language, computed in `core/impact.ts`

```text
ParserFactory.getParser(targetAbsolute).name === 'go'  ->  granularity = 'package'
otherwise                                              ->  granularity = 'file'
```

Derivation is **parser-based, not extension-based** (ANALYZE A-004): `src/parser/go.ts:14` already
declares `name = 'go'`, and reading it keeps one extension table in the repository instead of two that
can drift apart as the parser registry grows. This aligns `plan.md` with `data-model.md` section 1 and
`research.md` D2, which were written against the parser form.

Placed as a module-level helper in `src/core/impact.ts`, not on the parser interface. Granularity
describes the **reverse-edge resolution strategy**, not the parser: the Go parser reads imports at file
granularity perfectly well, it is `go.mod` resolution that lands on a directory. Putting a `granularity`
member on `Parser` would touch all four parsers plus `src/parser/types.ts` for a value none of them owns,
widening the blast radius from 5 files to 10 for no gain.

A cross-language target cannot flip the value: Go cannot import TypeScript and vice versa, so a `.go`
target's dependents are Go, and a `.ts` target's are not.

Note also what widening does **not** create: package-level import cycles are illegal in Go, so unioning
edges onto every file of a package cannot introduce a cycle the compiler would reject. The BFS in
`ImpactAnalyzer.analyze` is cycle-safe through its `parent` map regardless.

### Decision 4 — JSON contract: additive, minor release, not breaking

Payload today: `target`, `targetAbsolute`, `scannedFiles`, `directDependents`, `dependents`, `routes`,
`routePatterns`, `targetIsRoute`. The change **appends** two keys after `targetIsRoute` and removes,
renames or retypes nothing:

| Key | Type | Value |
|---|---|---|
| `granularity` | `'file' \| 'package'` | always present, every language (FR-004, FR-005) |
| `granularityNote` | `string \| null` | non-null only when `granularity === 'package'` |

This is **not** a breaking change for `--json` consumers: every pre-existing key keeps its name, type
and meaning, and `jq '.dependents'` behaves as before. The *values* of `dependents` / `routes` change for
Go targets, but that is the defect being repaired, not a contract break — a consumer relying on a Go file
falsely reporting zero dependents is relying on the bug.

**semantic-release classification** (`.releaserc.json`, `conventionalcommits` preset):

| Commit | Type/scope | Release rule | Effect |
|---|---|---|---|
| Widen the Go reverse edge | `fix(go): ...` | `fix` -> patch | the defect repair |
| Add `granularity` to text + JSON | `feat(impact): ...` | `feat` -> minor | new observable output field |
| Multi-file Go fixture + tests | `test(fixtures): ...` | `test` -> no release | |
| README limitations correction | `docs(README): ...` | `docs` scope `README` -> patch | the scope must be literally `README` to release |

Net effect: **1.1.0** (minor absorbs patch). **Do not** append a `BREAKING CHANGE:` footer and **do not**
use the `feat!:` / `fix!:` form. A major bump would tell every consumer to plan a migration that does not
exist, and `{ "breaking": true, "release": "major" }` is live in the release rules.

### Decision 5 — the stderr note is emitted in both output modes

FR-008 requires one stderr line per invocation when the result is package-granular; US2 scenario 6 phrases
it in text mode. The note is emitted for **both** `--json` and text, because stdout stays a clean parseable
payload either way and an agent piping `--json` needs the signal most. It is emitted from
`src/cli/index.ts` once, after `analyze()`, and not from the formatters — that placement is what makes
"exactly once per invocation" structural rather than a convention to remember.

It must not be routed through, or worded like, the degraded-LSP warning: `impact` starts no language
server, and `gopls` presence is irrelevant here (spec, Edge Cases).

**Settled by ANALYZE (R2).** `contracts/impact-cli.md` section 6 previously left this "recommended,
ANALYZE should settle". It is now normative: `NOTE-PKG-STDERR` is emitted in **both** text and `--json`
mode. FR-008 says "per invocation" without qualification; US2 scenario 6 illustrates text mode but does
not exclude JSON; and `src/cli/index.ts:182` already carries the codebase's own version of this
reasoning ("Under --json, send this to stderr to keep stdout clean"). stderr never pollutes the JSON
document on stdout, and an agent consuming `--json` is the caller who needs the signal most.

### Decision 6 — no stdout qualifier line for the non-empty Go case

`contracts/impact-cli.md` section 4 originally inserted a `📦 Package-granular result: …` line into the
**non-empty** Go text output. **Dropped by ANALYZE (A-005)**: no requirement backs it. FR-006 scopes the
text change to the zero-dependents case, in those words; US2 scenario 1 does the same; and US2
scenario 3, which is what covers the non-empty case, asks only for the `--json` field. The non-empty
text caller is not left unqualified either way, because Decision 5's stderr note fires for every
package-granular result, empty or not. Shipping an unrequired stdout line would change output for every
existing Go user of `impact` on the strength of no acceptance scenario at all.

## Project Structure

### Documentation (this feature)

```text
specs/004-go-package-impact-truthfulness/
├── plan.md          # this file
├── quickstart.md    # manual verification of the four acceptance stories
├── research.md      # emitted by the PLAN research scope
├── data-model.md    # emitted by the PLAN research scope
├── contracts/
│   ├── impact-cli.md              # normative stdout / stderr / exit code for the four cases
│   └── impact-result.schema.json  # machine-readable ImpactResult payload schema
├── spec.md
└── tasks.md         # emitted by /speckit.tasks
```

The feature exposes no HTTP or RPC surface, but it does have an observable contract: the CLI's stdout,
stderr and exit code, plus the `--json` payload. `contracts/impact-cli.md` is **normative** and names
the five fixed output strings (`LINE-EXACT-EMPTY`, `LINE-PKG-EMPTY`, `NOTE-PKG-STDERR`,
`NOTE-PKG-JSON-NONEMPTY`, `NOTE-PKG-JSON-EMPTY`) so that the tests and the implementation cannot drift;
`contracts/impact-result.schema.json` fixes the payload shape. Decision 4 below and `data-model.md`
section 2 describe the same shape in prose — where they disagree with the contract files, the contract
files win.

### Source code (repository root)

```text
src/
├── core/
│   ├── go-mod.ts              # MODIFY  + resolvePackageFiles(), packageFilesCache
│   ├── go-mod.test.ts         # MODIFY  + resolvePackageFiles() unit tests (existing tests untouched)
│   ├── resolver.ts            # MODIFY  + resolveAll(), resolvedAllCache
│   ├── impact.ts              # MODIFY  resolveInternalImports uses resolveAll; + granularity fields
│   ├── impact.test.ts         # MODIFY  + granularity === 'file' on TypeScript fixtures
│   └── go-integration.test.ts # MODIFY  + FR-001/002/003/004 assertions on the new fixture
├── output/
│   ├── impact.ts              # MODIFY  qualified empty-result line
│   └── impact.test.ts         # CREATE  first test file for the impact formatter
└── cli/
    └── index.ts               # MODIFY  one stderr note, exit code unchanged

fixtures/go/
├── cmd/notifier/main.go            # CREATE external consumer, matches route **/cmd/**/main.go
├── internal/notify/aaa_marker.go   # CREATE sorts first, referenced by nothing
├── internal/notify/sender.go       # CREATE sorts second, holds the referenced symbol
└── README.md                       # MODIFY document the new package

README.md                           # MODIFY :175-177 gopls blockquote + :450-452 "Known limitations" (FR-011);
                                    #        :366-367 --json key list (optional, folded in)
```

**Structure Decision**: single CLI package, unchanged. No new directory, no new module, no new
dependency. `src/output/impact.test.ts` is the only new source file, and it exists because the formatter
has no test at all today — FR-006 cannot be guarded without one.

## Test strategy

### Fixture design (FR-010) — additive, so nothing existing shifts

Every Go fixture package today holds exactly one `.go` file, which is precisely why the suite is blind to
this defect. Three **new** files, no edit to any existing fixture:

- `fixtures/go/internal/notify/aaa_marker.go` — `package notify`, declares a symbol nothing references.
  Sorts before `sender.go`, so pre-fix it is the elected representative.
- `fixtures/go/internal/notify/sender.go` — `package notify`, declares the `Sender` interface and its
  constructor. This is the symbol the external consumer actually uses.
- `fixtures/go/cmd/notifier/main.go` — `package main`, imports `github.com/example/app/internal/notify`
  and calls the constructor. Matches the default route pattern `**/cmd/**/main.go`, so the impacted-route
  assertion of US1 scenario 1 has something to assert on.

Pre-fix behaviour this reproduces exactly: `impact sender.go` -> `0 dependent(s), 0 route(s)`, while
`impact aaa_marker.go` -> 1 dependent, 1 route. Post-fix: both report the same non-empty set.

**Existing fixture-dependent assertions: none shift.** Checked file by file:

- `go-integration.test.ts` SC-001 (`explore main.go`) analyses `cmd/service/main.go`, which does not
  import `internal/notify`; its `>= 1` node assertions are untouched.
- SC-003 (`ReceiveInvoice.Execute` call edges) lives in `internal/application/usecases/`, untouched.
- SC-002 (`impact entity.go`) asserts `dependents` contains `receive_invoice` and `main.go`. The `notify`
  package imports nothing from `invoice`, so `entity.go`'s dependent set is unchanged. `scannedFiles`
  grows by 3, and **no test asserts on `scannedFiles`** — the identifier appears only in
  `src/core/impact.ts` and `src/output/impact.ts`.
- Every package under `fixtures/go` stays single-file except the new `internal/notify`, so widening is a
  no-op for the pre-existing graph.

Rejected alternative: adding the second file to `internal/ports/`. A file named `notifier.go` there would
sort before `repository.go` and steal its reverse edge, breaking SC-002's chain **pre-fix**. That turns a
new fixture into a failure of an unrelated existing test and muddies the RED signal.

### README scope (FR-011) — two sites, verified against the working tree

`spec.md:67` quotes the sentence *"analysis stays file/package-level and never fails"*. That sentence
does **not** live in the "Known limitations" paragraph. Line ranges re-verified at commit `cc67147`:

| Site | Lines | Current text | Required change |
|---|---|---|---|
| Optional-`gopls` blockquote, Go section | `README.md:175-177` | "install it … for exact symbol positions in multi-file packages. Without it, analysis stays file/package-level and never fails." | **Mandatory (FR-011, SC-005).** "never fails" is the misleading claim `spec.md:67` names: it reads as a reassurance where the truth is that `impact` answers at package granularity for Go whether or not `gopls` is installed. State the granularity here and stop implying `gopls` changes it. |
| "Known limitations" paragraph, Go section | `README.md:450-452` | "the no-`gopls` fallback … does not perform full interprocedural resolution, so calls dispatched through interfaces or injected dependencies may not link to a concrete implementation." | **Mandatory (FR-011, SC-005).** Add, alongside the existing interprocedural caveat and not instead of it, that `impact` results for Go targets are package-granular in every case. |
| `--json` key enumeration | `README.md:366-367` | "The JSON output exposes `target`, `scannedFiles`, `directDependents`, `dependents`, and `routes`" | **Optional but folded into the same task** (ANALYZE A-011). The list will silently omit `granularity` / `granularityNote`. One-line addition; no FR mandates it. |

The two mandatory sites sit ~275 lines apart, which is precisely why fixing one alone leaves the other
lying. `research.md` section 8.3 previously described these as "three lines apart" — corrected there.

### Rename invariance (FR-003, SC-002)

Cannot be asserted by renaming a committed fixture. Use a temporary Go module built inside the test, the
pattern `src/core/go-mod.test.ts:197-231` already uses (`fs.mkdtempSync` plus `afterAll` cleanup): create a
package with two files, record the impact result, rename the non-referenced file so the alphabetical winner
flips, assert the dependents / directDependents / routes counts are identical.

### Test-to-requirement map

| Requirement | Test | File |
|---|---|---|
| FR-001 | `resolvePackageFiles()` returns every non-test file, sorted | `src/core/go-mod.test.ts` |
| FR-001 (fallback) | package holding only `_test.go` -> returns the test files | `src/core/go-mod.test.ts` |
| FR-001 (regression) | `resolveImport()` still returns the first candidate | existing `go-mod.test.ts`, unmodified |
| FR-002 | `impact` on `sender.go` and on `aaa_marker.go` yield equal dependent sets | `src/core/go-integration.test.ts` |
| FR-003 | rename invariance on a temp module | `src/core/go-mod.test.ts` or `go-integration.test.ts` |
| FR-004 | Go target -> `granularity === 'package'`, empty and non-empty | `src/core/go-integration.test.ts` |
| FR-005 | TypeScript target -> `granularity === 'file'` | `src/core/impact.test.ts` |
| FR-006 | empty + package granularity -> no unqualified success line | `src/output/impact.test.ts` (new) |
| FR-007 | exit code `0` — the CLI action's `process.exit(EXIT_SUCCESS)` is unchanged | manual, `quickstart.md` |
| FR-008 | one stderr line, distinct from the LSP warning | manual, `quickstart.md` |
| FR-009 | no edge from `vendor/` or from outside include/exclude | `src/core/go-mod.test.ts` (temp module with a `vendor/` dir) |
| FR-010 | the fixture itself | `fixtures/go/internal/notify/**` |
| FR-011 | Both README claim sites: `README.md:175-177` (optional-`gopls` blockquote) **and** `README.md:450-452` ("Known limitations") | review, `quickstart.md` step 8 |

No e2e task: this is a CLI with no UI surface, so WCAG does not apply.

### NFR-001 verification is manual, and stated as such

This repository's own context is 77 files; the reported regression context is ~1,900. A 20% wall-clock
budget cannot be measured meaningfully on the fixtures, and a timing assertion in vitest would be a flaky
gate rather than a guard. Two honest substitutes:

1. **Analytic bound**, argued in `research.md`: one `readdirSync` per package per process, unchanged by
   this feature (Decision 2). The added work is `O(k)` `Set.add` per resolved import edge.
2. **Manual measurement**, scripted in `quickstart.md`: time `impact` on a large mixed context before and
   after. Not a CI gate. If a reviewer wants a gate, that is a follow-up feature, not this one.

## Commands (Docker-only)

The host runs no language toolchain. Pinned image `node:20.18.1-bookworm-slim` matches
`.github/workflows/release.yml` (`node-version: "20"`) and satisfies `engines.node >= 20`.

```bash
# Install (once)
docker run --rm -v "$PWD:/workspace" -w /workspace node:20.18.1-bookworm-slim npm ci

# Test (RED then GREEN)
docker run --rm -v "$PWD:/workspace" -w /workspace node:20.18.1-bookworm-slim npm run test:run

# Single file, while iterating
docker run --rm -v "$PWD:/workspace" -w /workspace node:20.18.1-bookworm-slim \
  npm run test:run -- src/core/go-mod.test.ts

# Typecheck + build
docker run --rm -v "$PWD:/workspace" -w /workspace node:20.18.1-bookworm-slim npm run build

# Lint
docker run --rm -v "$PWD:/workspace" -w /workspace node:20.18.1-bookworm-slim npm run lint

# Run the built CLI
docker run --rm -v "$PWD:/workspace" -w /workspace node:20.18.1-bookworm-slim \
  ./bin/spaghetti-compass.js impact fixtures/go/internal/notify/sender.go -c fixtures/go --json
```

## Constitution waivers

None. See "Constitution Check": there is no ratified principle to waive.

## Complexity Tracking

No constitution violation to justify. The two judgement calls worth recording:

| Choice | Why | Simpler alternative rejected because |
|---|---|---|
| Second resolver entry point rather than a widened `resolveImport()` | `explore` and `impact` need different granularity from the same import | Widening the existing method changes `explore`'s graph output, which the spec puts out of scope, and silently rewrites behaviour for four other call sites |
| Two JSON fields (`granularity`, `granularityNote`) rather than one | FR-004 needs one machine-readable field; the reason string is what makes the degradation actionable for an agent reading `--json` | A lone enum forces every consumer to hard-code the explanatory text the tool already knows |
