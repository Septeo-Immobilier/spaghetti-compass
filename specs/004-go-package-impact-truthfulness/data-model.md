# Data Model: Truthful Go package impact analysis

**Feature**: `004-go-package-impact-truthfulness` | **Scope**: PLAN / research | **Date**: 2026-08-19
**Spec**: [spec.md](./spec.md) | **Rationale**: [research.md](./research.md)

This feature persists nothing. The entities below are in-memory analysis shapes and the wire
payload they serialise to. Line references point at the working tree at commit `cc67147`.

---

## 1. `ImpactGranularity` (new)

The qualifier FR-004 and FR-005 require. Declared in `src/core/impact.ts` next to `ImpactResult`.

| Value | Meaning | Emitted for |
|---|---|---|
| `file` | Every reported edge was resolved to the exact file that declares the imported symbol. | TypeScript, JavaScript, Python, PHP targets |
| `package` | Edges were resolved to the imported package's file set. Any file of that package carries the package's dependents, and none of them is individually proven to be used. | Go targets |

Type: a string union, not a boolean. The spec's Out of Scope section keeps symbol-level narrowing
as future work, and a `symbol` value must be addable without a breaking payload change
(research.md D2).

**Derivation**: computed once per `analyze()` call from the target file's parser —
`ParserFactory.getParser(targetAbsolute).name === 'go'` (`src/parser/go.ts:14`) — never per edge.
The derivation is sound because reverse edges never cross languages: `resolveInternalImports`
(`src/core/impact.ts:165-195`) only emits an edge when the importer's own parser resolved the
specifier, so a Go importer only ever points at Go files, and the transitive closure of a Go
target is entirely Go. The derivation site must carry a comment recording that this invariant is
load-bearing.

---

## 2. `ImpactResult` (modified)

Declared at `src/core/impact.ts:30-47`. Two fields are appended; nothing is removed, renamed or
reordered, so every existing key keeps its position in the serialised payload.

### Before

| Field | Type | Notes |
|---|---|---|
| `target` | `string` | Relative to context |
| `targetAbsolute` | `string` | Absolute |
| `scannedFiles` | `number` | |
| `directDependents` | `string[]` | Relative, sorted |
| `dependents` | `string[]` | Relative, sorted, transitive, excludes the target |
| `routes` | `ImpactRoute[]` | Sorted by `path` |
| `routePatterns` | `string[]` | Echo of the effective patterns |
| `targetIsRoute` | `boolean` | |

### After

The eight fields above, unchanged, then:

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `granularity` | `ImpactGranularity` | no | `'package'` for Go targets, `'file'` otherwise. Present whether `dependents` is empty or not (FR-004, US2 scenario 3). |
| `granularityNote` | `string \| null` | yes | Human-readable reason. `null` when `granularity === 'file'`, so non-Go payloads gain one key with a null value and no prose. Fixed text for Go in [`contracts/impact-cli.md`](./contracts/impact-cli.md). |

**Semantic shift with no signature change**: `directDependents` and `dependents` keep their types
but change meaning for Go targets. Before, a Go entry meant "this file imports the target file".
After, it means "this file imports the package the target belongs to". `granularity` exists
precisely to make that shift legible to a consumer rather than silent.

**Invariant introduced by FR-002**: for any two non-test files `a` and `b` of the same Go package,
`dependents(a) === dependents(b)` and `directDependents(a) === directDependents(b)` as sets. This
is the assertion the FR-010 fixture test should encode, and it is stronger and more durable than
asserting a literal expected list.

**Invariant introduced by FR-003**: the result is invariant under renaming any file of the target's
package, provided no content changes. Today it is not — see the reproduction table in research.md
section 2.

**Not changed**: `ImpactRoute` (`src/core/impact.ts:17-27`) and `ImpactOptions`
(`src/core/impact.ts:49-52`) keep their exact shapes. Route entries carry no per-route granularity;
the result-level field covers them, since all edges in a result share one granularity.

---

## 3. Reverse-dependency map (internal, modified in content only)

Built at `src/core/impact.ts:81-92`. Type is unchanged: `Map<string, Set<string>>`, absolute
dependency path to the set of absolute importer paths. `directDependents` reads it at
`src/core/impact.ts:100`; the BFS walks it at `src/core/impact.ts:102-112`.

What changes is its density for Go. One Go import statement contributes:

| | Entries created | Attached to |
|---|---|---|
| Before | 1 | the alphabetically first non-test `.go` file of the imported package (`src/core/go-mod.ts:271-273`) |
| After | `k` | every non-test `.go` file of the imported package; every `.go` file including tests when the package has no non-test file (FR-001) |

`k` is bounded by the package's file count — on the order of 90 for the largest package in the
reported context. Growth is in `Set` insertions only; no additional parse, `stat` or `readdir`
occurs, because the directory listing already happens at `src/core/go-mod.ts:249` and is memoised.

BFS visit count is unaffected: `parent` (`src/core/impact.ts:97`) still admits each file once.

**Boundary conditions preserved verbatim** (FR-009, NFR-002): `vendor/` and `.gomodcache/` are
filtered per candidate at `src/core/go-mod.ts:254-258`, and directory pruning in `collectFiles`
skips them at `src/core/impact.ts:214`. Importers are still constrained by
`matchesContextPatterns` (`src/core/impact.ts:239-246`). The widened set may only contain files the
unwidened set could already have contained; no new directory is read.

---

## 4. Resolver return types

### 4.1 `GoModResolver`

| Member | Before | After |
|---|---|---|
| `resolveImport(importPath, fromFile)` | `string \| null` (`src/core/go-mod.ts:93`) | unchanged — kept for `explore`, and asserted by `src/core/go-mod.test.ts:153` and `:214` which SC-004 requires green |
| `resolvePackageFiles(importPath, fromFile)` | absent | **new**: `string[]`. Empty array for stdlib, third-party, a missing directory, and a directory with no eligible `.go` file. Sorted, for determinism. |
| `importCache` | `Map<string, string \| null>` (`src/core/go-mod.ts:34`) | unchanged |
| `packageFilesCache` | absent | **new**: `Map<string, string[]>`, keyed identically (`moduleRoot + '\0' + importPath`). Mandatory — without it every importer of a large package repeats the `readdirSync`, which is how NFR-001 would be missed. |
| `clearCache()` | clears two maps (`src/core/go-mod.ts:133-136`) | must also clear `packageFilesCache` |

`resolvePackageFiles` returns an array rather than `string[] | null` so that callers loop without a
null guard. The stdlib/third-party case and the empty-package case are indistinguishable to the
caller, and neither produces an edge, so collapsing them loses nothing.

The selection rule is lifted unchanged from `_resolveImportInternal`
(`src/core/go-mod.ts:254-268`) — same `.go` filter, same `vendor/`/`.gomodcache/` exclusion, same
non-test preference with all-files fallback. Only the final `candidates[0]` narrowing
(`src/core/go-mod.ts:271-273`) is dropped. Both methods should share one private helper so the two
rules cannot drift.

### 4.2 `PathResolver`

| Member | Before | After |
|---|---|---|
| `resolve(spec, fromFile)` | `string \| null` (`src/core/resolver.ts` Go branch at `:124-130`) | unchanged — six `explore` call sites in `src/core/analyzer.ts` (lines 229, 302, 515, 727) depend on it |
| `resolveAll(spec, fromFile)` | absent | **new**: `string[]`. Go sources delegate to `resolvePackageFiles`; every other language returns `[resolve(...)]`, or `[]` when that is `null`. |
| `classifyLocation(resolvedPath, spec, fromFile)` | `NodeLocation` (`src/core/resolver.ts:318`) | unchanged; called once per element of the widened set |

`classifyLocation`'s Go branch (`src/core/resolver.ts:320-331`) already tests containment of a
single absolute path in the project root, so it applies to each widened member without
modification.

### 4.3 `ImpactAnalyzer.resolveInternalImports`

Signature unchanged: `(file: string) => string[]` (`src/core/impact.ts:165`). The inner loop at
`src/core/impact.ts:186-193` switches from one `resolve` result to iterating `resolveAll`,
classifying each and keeping the `internal` ones. Callers see only a longer array.

---

## 5. JSON payload, before and after

Both examples are the reproduction from research.md section 2: a package holding `aaa_alpha.go`
(used by nobody) and `inbound_repository.go` (whose constructor `cmd/api/main.go` calls).
`routePatterns` is elided for brevity; it is unchanged in every case.

### 5.1 Go target, the file that is genuinely used — before

```json
{
  "target": "internal/repo/inbound_repository.go",
  "targetAbsolute": "<context>/internal/repo/inbound_repository.go",
  "scannedFiles": 3,
  "directDependents": [],
  "dependents": [],
  "routes": [],
  "routePatterns": ["…"],
  "targetIsRoute": false
}
```

Wrong, and indistinguishable from a genuine leaf.

### 5.2 Same target — after

```json
{
  "target": "internal/repo/inbound_repository.go",
  "targetAbsolute": "<context>/internal/repo/inbound_repository.go",
  "scannedFiles": 3,
  "directDependents": ["cmd/api/main.go"],
  "dependents": ["cmd/api/main.go"],
  "routes": [
    {
      "path": "cmd/api/main.go",
      "absolutePath": "<context>/cmd/api/main.go",
      "chain": ["cmd/api/main.go", "internal/repo/inbound_repository.go"]
    }
  ],
  "routePatterns": ["…"],
  "targetIsRoute": false,
  "granularity": "package",
  "granularityNote": "Go analysis resolves imports at package granularity: every non-test file of internal/repo shares this dependents set."
}
```

`aaa_alpha.go` now returns the identical `directDependents`, `dependents` and `routes`, differing
only in `target`, `targetAbsolute` and the last element of each route `chain` (SC-001, FR-002).

### 5.3 Go target with genuinely zero dependents — after

A package that nothing in the context imports. The arrays stay empty; the label carries the
caveat, which is the whole of US2.

```json
{
  "target": "internal/orphan/thing.go",
  "targetAbsolute": "<context>/internal/orphan/thing.go",
  "scannedFiles": 3,
  "directDependents": [],
  "dependents": [],
  "routes": [],
  "routePatterns": ["…"],
  "targetIsRoute": false,
  "granularity": "package",
  "granularityNote": "Go analysis resolves imports at package granularity: no file in the scanned context imports internal/orphan, but this is a package-level observation and may be incomplete."
}
```

### 5.4 TypeScript, Python or PHP target — after

Every pre-existing key is byte-identical to the current output. Exactly one key is added, with a
constant value and a null note (FR-005, US2 scenario 4).

```json
{
  "target": "models/user.ts",
  "targetAbsolute": "<context>/models/user.ts",
  "scannedFiles": 5,
  "directDependents": ["services/auth-service.ts", "services/user-service.ts"],
  "dependents": ["main.ts", "services/auth-service.ts", "services/user-service.ts"],
  "routes": [{ "path": "main.ts", "absolutePath": "<context>/main.ts", "chain": ["main.ts", "models/user.ts"] }],
  "routePatterns": ["…"],
  "targetIsRoute": false,
  "granularity": "file",
  "granularityNote": null
}
```

### 5.5 Serialisation path

No formatter change is needed. `formatImpactJson` (`src/output/impact.ts:112-114`) is
`JSON.stringify(result, null, 2)` over the `ImpactResult` instance, so appending the fields to the
interface and populating them in `analyze()` is sufficient. The machine-readable schema is
[`contracts/impact-result.schema.json`](./contracts/impact-result.schema.json).

---

## 6. Fixture entities (FR-010)

New Go source files under `fixtures/go`, forming one package with two non-test files plus an
external caller that references a symbol declared only in the non-first file. Concrete names are
the plan's to choose; the constraints are not.

| Constraint | Source |
|---|---|
| New package must live in a **new** directory, not inside `internal/domain/invoice` | `src/core/go-integration.test.ts:71-92` asserts on that package |
| The externally referenced symbol must be declared in the file that sorts **last**, so the test fails before the fix | US3 scenario 1 |
| The two package files must not be named `*handler.go`, `*handlers.go`, `*routes.go`, `*router.go`, nor sit under `internal/handlers/` | `config/route-patterns.txt` Go section. Keeps the new package a plain domain package rather than an accidental entry point, so US1's "who imports this package" assertion is not confounded by the file also being its own route |
| The external caller **must** sit at `cmd/<name>/main.go` | `config/route-patterns.txt:88` (`**/cmd/**/main.go`). US1 scenario 1 asserts an impacted **route**, which requires the caller to match a default route pattern. Verified during ANALYZE (A-003) that this breaks nothing: no test asserts a Go route count — `src/core/go-integration.test.ts:73,88` pass `routePatterns` but assert only `dependents` / `directDependents`, and the only `routes).toHaveLength()` assertions, `src/core/impact.test.ts:59,75`, run against `fixtures/typescript` |
| The module path prefix stays `github.com/example/app` | `fixtures/go/go.mod` |
| `src/core/go-mod.test.ts` needs no change | it builds its own module under `os.tmpdir()` (`src/core/go-mod.test.ts:33-72`) and never reads `fixtures/go` |
