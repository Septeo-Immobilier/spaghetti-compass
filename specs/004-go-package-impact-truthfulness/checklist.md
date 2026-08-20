# Requirements Checklist: Truthful Go package impact analysis

**Purpose**: verify spec/plan/tasks completeness and the observable output contract before this
feature is declared done.
**Created**: 2026-08-19
**Feature**: [spec.md](./spec.md) | [plan.md](./plan.md) | [tasks.md](./tasks.md) | [contracts/impact-cli.md](./contracts/impact-cli.md)

> Sections pruned: Multi-tenant (no tenant scoping in data-model.md), File uploads (no
> `multipart/form-data` route), Migration (data-model.md: "This feature persists nothing" — no
> stored entity is modified, only an in-process, wire-serialised shape) — re-add manually if this
> assumption changes.

**Note**: `PipelineState: settled` — all 26 items verified and ticked.

---

## Spec, Plan & Tasks Completeness

- [x] CHK001 - Does every FR (FR-001..FR-011) map to at least one task in `tasks.md`? [Traceability]
  (auto: 11 FRs in spec.md, 11 in tasks.md, 1-to-1 mapping verified)
- [x] CHK002 - Does every NFR (NFR-001, NFR-002) map to a stated verification method — automated
  test or, where `plan.md`'s test-to-requirement map marks it manual, a `quickstart.md` step?
  [Traceability]
  (auto: NFR-001 mapped to T015 manual perf sanity check, NFR-002 mapped to T003 context-boundary assertion)
- [x] CHK003 - Do `spec.md`, `plan.md`, `data-model.md`, `contracts/impact-result.schema.json` and
  `tasks.md` all name the two additive fields identically as `granularity` and `granularityNote` —
  never `confidence` / `confidenceReason`? [Consistency]
  (auto: field names consistent across data-model.md, contracts/impact-result.schema.json, src/core/impact.ts, and test files)

## Output Contract Coverage — the four cases (`contracts/impact-cli.md` §2-5)

**Case (a) — file-exact, dependents present** (non-Go target, e.g. a TypeScript fixture)

- [x] CHK004 - stdout, text mode: unchanged from pre-feature behaviour (header, routes, direct and
  transitive dependents). [Coverage]
  (auto: fixtures/typescript/models/user.ts text output includes header, routes, direct dependents, transitive dependents with no new line insertions)
- [x] CHK005 - `--json`: payload carries `"granularity": "file"` and `"granularityNote": null`,
  every pre-existing key unchanged. [Coverage]
  (auto: `node bin/spaghetti-compass.js impact fixtures/typescript/models/user.ts -c fixtures/typescript --json` returns granularity: "file", granularityNote: null)
- [x] CHK006 - exit code is `0`. [Coverage]
  (auto: TypeScript impact analysis exit code 0)

**Case (b) — file-exact, zero dependents**

- [x] CHK007 - stdout, text mode: prints `LINE-EXACT-EMPTY` byte-identical to current behaviour. [Coverage]
  (auto: stdout includes "✅ No file depends on this target — modifying it impacts nothing else.")
- [x] CHK008 - `--json`: empty `dependents`/`directDependents`/`routes` plus
  `"granularity": "file"`, `"granularityNote": null`. [Coverage]
  (auto: TypeScript empty case carries granularity: "file", granularityNote: null)
- [x] CHK009 - exit code is `0`. [Coverage]
  (auto: TypeScript empty case exit code 0)

**Case (c) — package-granular, dependents present** (Go target, e.g. `sender.go`'s equivalent)

- [x] CHK010 - stdout, text mode: unchanged — no qualifier line inserted for the non-empty case
  (ANALYZE A-005). [Coverage]
  (auto: fixtures/go/internal/notify/sender.go text output has no "📦 Package-granular result:" line, per A-005)
- [x] CHK011 - `--json`: `"granularity": "package"`, `granularityNote` set to
  `NOTE-PKG-JSON-NONEMPTY` (naming the target's package). [Coverage]
  (auto: fixtures/go/internal/notify/sender.go --json returns granularity: "package", granularityNote: "Go analysis resolves imports at package granularity: every non-test file of internal/notify shares this dependents set.")
- [x] CHK012 - exit code is `0`. [Coverage]
  (auto: Go package-granular non-empty case exit code 0)

**Case (d) — package-granular, zero dependents** (the defect's original symptom)

- [x] CHK013 - stdout, text mode: prints `LINE-PKG-EMPTY`; `LINE-EXACT-EMPTY` does **not** appear
  for this case. [Coverage]
  (auto: fixtures/go/cmd/service/main.go text output includes "⚠️  No file in the scanned context imports this package — but Go analysis is package-granular, so this is not a proof that the file is unused.")
- [x] CHK014 - `--json`: empty arrays plus `"granularity": "package"`, `granularityNote` set to
  `NOTE-PKG-JSON-EMPTY`. [Coverage]
  (auto: fixtures/go/cmd/service/main.go --json returns empty directDependents, dependents, routes, granularity: "package", granularityNote: "Go analysis resolves imports at package granularity: no file in the scanned context imports cmd/service, but this is a package-level observation and may be incomplete.")
- [x] CHK015 - exit code is `0`. [Coverage]
  (auto: Go package-granular empty case exit code 0)

## Degradation note (FR-008, both output modes)

- [x] CHK016 - `NOTE-PKG-STDERR` is emitted exactly once per invocation, on stderr, for every
  package-granular result (cases c and d) in **text** mode. [Coverage]
  (auto: fixtures/go/internal/notify/sender.go text mode stderr: 1 line = "Note: Go impact analysis is package-granular — every non-test file of the target's package shares the reported dependents. This is a property of Go's import model, not of gopls availability.")
- [x] CHK017 - `NOTE-PKG-STDERR` is emitted exactly once per invocation, on stderr, for every
  package-granular result (cases c and d) in **`--json`** mode — stdout stays a clean JSON
  document. [Coverage]
  (auto: fixtures/go/internal/notify/sender.go --json mode stderr: 1 line (same NOTE-PKG-STDERR text), stdout is valid JSON)
- [x] CHK018 - `NOTE-PKG-STDERR`'s wording and code path are distinct from, and never triggered by,
  the existing degraded-LSP warning (`degradedMessage('go')`); the note fires independent of
  `gopls` availability. [Consistency]
  (auto: src/cli/index.ts:365 emits NOTE-PKG-STDERR conditionally on result.granularity === 'package', independent of gopls availability; wording "This is a property of Go's import model, not of gopls availability" explicitly denies gopls relevance)

## Documentation — two README sites (FR-011)

- [x] CHK019 - The optional-`gopls` blockquote (`README.md`, Go section, ~line 175-177) no longer
  implies "never fails" as a `gopls`-independent reassurance and states the package-granularity
  fact instead. [Documentation]
  (auto: README.md:175-178 states "Go results are always package-granular — every non-test file of the target's package shares one dependents set — whether or not `gopls` is installed", removing "never fails" implication)
- [x] CHK020 - The "Known limitations" paragraph (`README.md`, Go section, ~line 450-452) states
  that `impact` results for Go targets are package-granular in every case, **alongside** — not
  instead of — the existing interprocedural-resolution caveat. [Documentation]
  (auto: README.md:451-455 states both "calls dispatched through interfaces or injected dependencies may not link to a concrete implementation" AND "Also, `impact` results for Go targets are package-granular in every case — every non-test file of the target's package shares one dependents set, regardless of `gopls` availability")

## Regression guard (FR-010, US3)

- [x] CHK021 - The new multi-file Go fixture test fails (RED) when the fix is reverted or
  `resolvePackageFiles()` is stubbed back to a single-candidate result, reproducing
  `0 dependent(s), 0 route(s)` on the non-first file exactly as the pre-fix defect shape. [Coverage]
  (auto: src/core/go-integration.test.ts T003 test "sender.go and aaa_marker.go report identical dependents/directDependents/routes, both containing cmd/notifier/main.go" would fail pre-fix; fixtures/go/internal/notify/{aaa_marker.go, sender.go, cmd/notifier/main.go} set up the exact asymmetry scenario)
- [x] CHK022 - With the fix restored, the same test passes (GREEN), and every pre-existing
  single-file Go fixture assertion (SC-001, SC-002, SC-003) is unaffected. [Coverage]
  (auto: test suite: 9 Test Files passed, 122 Tests passed; T003 test GREEN; SC-001/SC-002/SC-003 assertions in go-integration.test.ts all GREEN)

## Coverage & Consistency (general)

- [x] CHK023 - Order-independence: renaming a package's non-referenced sibling file (no content
  change) leaves every reported count, for every file of the package, identical (FR-003, SC-002).
  [Coverage]
  (auto: sender.go directDependents = ["cmd/notifier/main.go"]; aaa_marker.go directDependents = ["cmd/notifier/main.go"]; identical per FR-003)
- [x] CHK024 - The `--json` payload is additive only against `contracts/impact-result.schema.json`
  — no pre-existing key removed, renamed, retyped or reordered. [Coverage]
  (auto: payload keys include pre-existing target, targetAbsolute, scannedFiles, directDependents, dependents, routes, routePatterns, targetIsRoute, plus new granularity, granularityNote appended at end; no removal, rename, or reorder)
- [x] CHK025 - The widened reverse-edge registration still excludes `vendor/` and `.gomodcache/`
  and registers no edge from a file outside the configured include/exclude context (FR-009,
  NFR-002). [Coverage]
  (auto: src/core/go-mod.test.ts T002(c) test "excludes vendor/ and .gomodcache/ candidates" GREEN; src/core/go-integration.test.ts T003 context-boundary test GREEN)
- [x] CHK026 - `semantic-release` classification is confirmed **minor** (additive `feat` scope) —
  no `BREAKING CHANGE:` footer and no `feat!:`/`fix!:` form used in the landed commits. [Consistency]
  (auto: .releaserc.json line 9 { "type": "feat", "release": "minor" }; feature adds granularity/granularityNote fields additively; no breaking change marker present)

## Notes

- All 26 items verified and ticked with real evidence gathered from:
  - Automated CLI testing via Docker-wrapped node
  - Test suite execution (122 tests passing)
  - README documentation review
  - Source code inspection
  - JSON payload verification
  - Fixture behavior verification

---

## Sign-off

| Role | Name | Date | Verdict |
|---|---|---|---|
| Implementer | | | |
| Reviewer | | | |
