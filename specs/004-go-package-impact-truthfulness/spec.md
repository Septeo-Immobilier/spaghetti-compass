# Feature Specification: Truthful Go package impact analysis

**Feature Branch**: `004-go-package-impact-truthfulness`
**Created**: 2026-08-19
**Status**: Draft
**Input**: Bug report from a downstream Go project consuming `@septeo-immo/spaghetti-compass`. `impact` on a Go file reports zero dependents and a green "impacts nothing else" verdict whenever that file is not the alphabetically-first non-test `.go` file of its package, while another file of the same package absorbs the whole package's true dependents. The empty result is indistinguishable, in both text and `--json`, from a genuine leaf with no dependents.

---

## User Scenarios & Testing

### User Story 1 - Get a truthful dependents answer for any file of a Go package (Priority: P1)

As a reviewer or agent running `spaghetti-compass impact` on a changed Go file, I want the reported dependents, direct dependents, and impacted routes to reflect the fact that Go's unit of import is the package — not to depend on which file inside that package happens to sort first alphabetically — so that I never read "impacts nothing else" about a file that is, in truth, imported everywhere the rest of its package is imported.

**Why this priority**: This is the correctness defect. Every multi-file Go package currently produces one file that absorbs the package's whole blast radius and every other file that falsely reports zero. Any caller following the tool's own documented review recipe (run `impact` on each changed file, read `routes`) is silently misled on exactly the files most likely to be edited.

**Independent Test**: Build a fixture Go package with at least two non-test `.go` files, where an external file imports the package to reference a symbol declared in the second (non-first) file only. Run `impact` on each of the two package files and verify both report the same non-empty dependents set, the same direct dependents, and the same impacted route(s).

**Acceptance Scenarios**:

1. **Given** a Go module with a package directory holding `aaa_alpha.go` (declares a symbol referenced by nothing) and `inbound_repository.go` (declares a symbol referenced by `cmd/api/main.go`), **When** I run `impact` on `inbound_repository.go`, **Then** the result reports `main.go` as a dependent and, if it matches a route pattern, as an impacted route — not `0 dependent(s), 0 route(s)`.
2. **Given** the same package, **When** I run `impact` on `aaa_alpha.go` instead, **Then** the result reports the same dependent set as for `inbound_repository.go` (the package as a whole is what `main.go` imports), not a set that excludes `inbound_repository.go`'s true dependents.
3. **Given** the same package with `aaa_alpha.go` renamed to `zzz_alpha.go` (no content change), **When** I re-run `impact` on any file of the package, **Then** the reported dependents, direct dependents, and route count are identical to before the rename.
4. **Given** a package where `admin_query.go` and `inbound_document_repository.go` sit in the same directory and are both imported by the same external callers, **When** I run `impact` on either file, **Then** neither file reports `0 dependent(s)` while the other reports a large non-zero count for the same import.

---

### User Story 2 - Tell an empty answer apart from an unknown one (Priority: P1)

As a reviewer or agent, when `impact` reports zero dependents for a Go file, I want the text output and the `--json` payload to tell me whether that zero is a confirmed leaf or the coarser, package-granular kind of answer Go analysis produces, so that I do not treat a package-level "nothing seen at this granularity" as an exact, provable guarantee.

**Why this priority**: An empty-and-confident answer is worse than an error: it costs nothing to double-check an explicit "uncertain," but a green "impacts nothing else" invites an unreviewed change. This is also the fix that lets CI or an agent loop branch programmatically, since exit code alone cannot carry this distinction without breaking the existing "0 is not an error" contract shared with every other supported language.

**Independent Test**: Run `impact --json` on a Go target with zero dependents and on a Go target with non-zero dependents; verify both JSON payloads carry a field that distinguishes Go's package-level granularity from the exact, file-level granularity reported for TypeScript, Python, and PHP targets. Run the same Go target as text and verify the zero-dependents case does not print the unqualified success line used for confirmed exact leaves.

**Acceptance Scenarios**:

1. **Given** a Go target with zero dependents, **When** I run `impact` in text mode, **Then** the output does not print the unqualified `No file depends on this target — modifying it impacts nothing else.` line; it instead states that the analysis is package-granular and may be incomplete.
2. **Given** the same Go target, **When** I run `impact --json`, **Then** the payload carries a field whose value distinguishes this package-granular result from an exact, file-level result, in addition to the existing empty `dependents`/`directDependents`/`routes` arrays.
3. **Given** a Go target with a non-zero dependents count (e.g. `admin_query.go` from User Story 1), **When** I run `impact --json`, **Then** the same field is present and still marks the result as package-granular — the label is not reserved for the empty case, because over-attribution to one file is exactly as coarse as under-attribution to another.
4. **Given** a TypeScript, Python, or PHP target, **When** I run `impact --json`, **Then** the field marks the result as exact/file-level, unchanged from before this feature.
5. **Given** a Go target, **When** `impact` runs to completion (empty or non-empty, package-granular or not), **Then** the process exit code is `0` — reduced confidence is communicated through output content, never through a non-zero exit that would collide with the tool's existing "empty dependents is not a failure" contract shared by every language.
6. **Given** a Go target whose analysis is package-granular, **When** I run `impact` in text mode, **Then** stderr carries one line noting the package-level granularity, emitted once per invocation regardless of `gopls` availability — since `impact` never starts a language server for any language, this line is not, and must not be confused with, the existing degraded-LSP warning that `explore` already emits.

---

### User Story 3 - Catch this defect with the project's own multi-file Go fixture (Priority: P2)

As a maintainer, I want the Go fixture set to include at least one multi-file package with an assertion on a non-first file, so that this class of defect cannot silently reappear.

**Why this priority**: Every Go fixture package in the repository today holds exactly one `.go` file, so the project's own test suite is structurally blind to a defect that only manifests with two or more files per package. Without this fixture, User Story 1's fix has no regression guard.

**Independent Test**: Add a second `.go` file to an existing Go fixture package (or a new one) such that an external fixture file imports the package to reference a symbol declared only in the second file. Add a test asserting `impact` on that second, non-first file returns the expected non-empty, package-consistent result. Run the project's test command and confirm the new assertion fails against the pre-fix behavior and passes against the fix.

**Acceptance Scenarios**:

1. **Given** the Go fixture set, **When** the fix for User Story 1 is reverted, **Then** the new fixture-backed test fails (it exercises the exact defect shape: two files in one package, external caller referencing only the non-first one).
2. **Given** the Go fixture set with the fix applied, **When** the project's test command runs, **Then** the new test passes and existing single-file Go fixture tests are unaffected.

---

### User Story 4 - Read an accurate description of Go's known limitations (Priority: P3)

As a maintainer or a caller reading the documentation before trusting `impact` on a Go codebase, I want the Go "Known limitations" text to describe the actual current behavior, so that the documented limitation and the observed limitation are the same thing.

**Why this priority**: The current paragraph scopes the no-`gopls` fallback limitation to interprocedural resolution through interfaces or injected dependencies, and states analysis "stays file/package-level and never fails." Neither sentence prepares a reader for a confident zero-dependents answer on a file with hundreds of true dependents. This is documentation hygiene, not a functional gap — it ships after the fix, not instead of it.

**Independent Test**: Read the Go section's "Known limitations" paragraph after the fix lands and confirm it names package-level granularity for `impact` explicitly, alongside the existing interprocedural-resolution caveat.

**Acceptance Scenarios**:

1. **Given** the fix for User Stories 1 and 2 has landed, **When** a reader reviews the Go "Known limitations" paragraph, **Then** it states that `impact` results for Go targets are package-granular (every non-test file of an imported package shares the same dependents set) and that this applies uniformly, not only when interfaces or dependency injection are involved.

---

### Edge Cases

- A Go package holding only test files (`*_test.go`, no non-test file): the widened resolution falls back to the full file set of the package, consistent with the existing non-test-preferred, all-files-otherwise selection rule.
- A single-file Go package: still reported as package-granular (the analysis method does not narrow by file count), so a maintainer adding a second file later does not silently introduce a new discoverability gap.
- Generated files (`*.gen.go`, `zz_generated*.go`) inside the package directory: included in the widened reverse-edge set like any other non-test `.go` file, consistent with the project's existing "no default exclusion for generated Go files" behavior.
- `vendor/` and `.gomodcache/` directories: excluded from the widened reverse-edge registration exactly as they are excluded today.
- A package referenced from an external file that itself lies outside the configured `--include`/`--exclude` context: not registered as a dependent, consistent with existing scan-boundary behavior.
- `gopls` present or absent: does not change any result described in this spec — `impact` starts no language server for any language, so the package-granularity signal is unrelated to, and must never be conflated with, `gopls` availability.
- TypeScript, Python, and PHP targets: unaffected; their results keep reporting exact, file-level confidence.

## Requirements

### Functional Requirements

- **FR-001**: When an external file imports a Go package, the system MUST register a reverse dependency edge from that external file to every non-test `.go` file of the imported package (falling back to every `.go` file, tests included, only when the package holds no non-test file) — not to a single representative file.
- **FR-002**: For any two `.go` files that are members of the same Go package and are both actually imported by at least one external file, `impact` MUST NOT report contradictory dependents (one file non-empty, the other empty) for that shared import.
- **FR-003**: Renaming a `.go` file within a package (no content or import change) MUST NOT change the dependents, direct dependents, or route count reported by `impact` for any file of that package or for any of its dependents.
- **FR-004**: The `--json` payload for a Go target MUST carry a field that distinguishes package-granular results from exact, file-level results, present whether `dependents` is empty or non-empty.
- **FR-005**: The `--json` payload for a TypeScript, Python, or PHP target MUST carry the same field with the exact, file-level value, unchanged from the behavior before this feature.
- **FR-006**: When rendering a Go target with zero dependents in text mode, the system MUST NOT print the unqualified success line reserved for a confirmed exact leaf; it MUST print a qualified statement noting that the analysis is package-granular and may be incomplete.
- **FR-007**: The process exit code for `impact` on a Go target MUST be `0` in every case described by this spec (empty or non-empty dependents, package-granular or exact) — degraded confidence MUST be communicated exclusively through text and JSON content, never through the exit code.
- **FR-008**: When a Go target's result is package-granular, the system MUST emit exactly one stderr line per invocation stating so, independent of `gopls` availability, and this line MUST be distinct from — and MUST NOT be triggered by, or confused with — the existing degraded-LSP warning already emitted by `explore`.
- **FR-009**: The widened Go reverse-edge registration MUST continue to exclude `vendor/` and `.gomodcache/` directories and MUST NOT register or report an edge from any file outside the configured include/exclude context.
- **FR-010**: The Go fixture set MUST include at least one package with two or more non-test `.go` files, where an external fixture file imports the package to reference a symbol declared only in a non-first file, with a test asserting the non-first file's `impact` result is non-empty and consistent with the package's true dependents.
- **FR-011**: The README's Go "Known limitations" paragraph MUST be corrected to state that `impact` results for Go targets are package-granular in every case, in addition to the existing interprocedural-resolution caveat.

### Non-Functional Requirements

- **NFR-001 (Performance)**: Widening reverse-edge registration from one file to every non-test file of a Go package MUST NOT introduce more than a small constant-factor overhead on `impact`'s total wall-clock time for a mixed-language context of the size reproduced in this report (on the order of 1,900 scanned files, largest single Go package on the order of 90 files); target no more than 20% added wall-clock time versus the pre-fix baseline on such a context.
- **NFR-002 (Security / data boundary)**: The widened resolution MUST NOT read, register, or expose reverse edges for any file outside the scanned context's configured include/exclude boundary, and MUST continue to honor the existing `vendor/`/`.gomodcache/` exclusion (see FR-009) — the fix must not widen the tool's effective read boundary, only the fidelity of edges within it.

### Key Entities

- **Go Package**: a directory whose `.go` files share one `package` declaration; the unit Go import resolution operates on, as opposed to a single file.
- **Impact Granularity**: a qualifier attached to an `impact` result distinguishing "exact" (file-level, e.g. TypeScript/Python/PHP today) from "package-level" (Go), surfaced in both text and `--json`. No functional requirement names the carrying field; the design settled on `granularity` (values `file` / `package`) with a companion `granularityNote` — see `data-model.md` section 2 and `contracts/impact-result.schema.json`. Earlier drafts called this entity "Impact Confidence"; the term was dropped because the tool computes a resolution unit, not a probability.
- **Reverse Dependency Edge**: an edge from an importing file to the file(s) it depends on; for Go, this feature widens the edge's target from one representative file to every non-test file of the imported package.

## Success Criteria

### Measurable Outcomes

- **SC-001**: On the minimal reproduction described in this report's origin (a package with a file referenced by an external caller and a sibling file referenced by nothing), `impact` on either file reports the same non-empty dependents set and the same impacted route.
- **SC-002**: Renaming the non-referenced sibling file changes no reported count for any file of the package (order-independence, closing the "alphabetical sort decides the winner" defect).
- **SC-003**: Every `impact --json` payload for a Go target, empty or non-empty, carries a package-level granularity marker; every payload for a TypeScript, Python, or PHP target carries an exact, file-level marker.
- **SC-004**: The new multi-file Go fixture test (FR-010) fails against the pre-fix behavior and passes against the fix, and all pre-existing Go, TypeScript, Python, and PHP `impact` tests continue to pass unchanged.
- **SC-005**: The README Go "Known limitations" paragraph, read after the fix, names package-level granularity for `impact` explicitly.

## Out of Scope

- Changing how `gopls` is packaged, detected, or installed; `gopls` availability is confirmed irrelevant to this defect and no packaging change is warranted.
- Shipping a Docker image for Go tooling; this defect and its fix require no LSP and no container change.
- Any change to the TypeScript import-resolution path, which this report verifies is already correct at file granularity.
- Any change to Go module discovery (`go.mod` lookup relative to a source file); this report verifies module discovery is already correct in every monorepo layout tested.
- Narrowing Go's package-level answer down to exact symbol-level precision (e.g. resolving that only files calling a specific interface method are true dependents). This feature makes the package-level answer truthful and clearly labeled; symbol-level narrowing remains future work.

## Roadmap Alignment

[unaligned] — no `ROADMAP.md` or milestone reference was supplied for this feature; it originates directly from an external bug report against the current release.
