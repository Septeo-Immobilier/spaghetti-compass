# Contract: `impact` command-line surface

**Feature**: `004-go-package-impact-truthfulness` | **Scope**: PLAN / research | **Date**: 2026-08-19
**Spec**: [../spec.md](../spec.md) | **Shapes**: [../data-model.md](../data-model.md)
**Schema**: [impact-result.schema.json](./impact-result.schema.json)

This file fixes the observable behaviour of `spaghetti-compass impact` after the feature lands:
stdout, stderr and exit code for the four cases the spec distinguishes. It is the reference the
implementation and its tests must both match; where the spec left a string unnamed, the string is
named here so that TASKS and the implementation cannot drift apart.

Command under contract (`src/cli/index.ts:281-390`):

```
spaghetti-compass impact <file> [-c <dir>] [-j|--json] [--routes <glob...>] …
```

No option is added, removed or changed by this feature.

---

## 1. Fixed strings

| Id | Text | Stream |
|---|---|---|
| `LINE-EXACT-EMPTY` | `✅ No file depends on this target — modifying it impacts nothing else.` | stdout |
| `LINE-PKG-EMPTY` | `⚠️  No file in the scanned context imports this package — but Go analysis is package-granular, so this is not a proof that the file is unused.` | stdout |
| `NOTE-PKG-STDERR` | `Note: Go impact analysis is package-granular — every non-test file of the target's package shares the reported dependents. This is a property of Go's import model, not of gopls availability.` | stderr |
| `NOTE-PKG-JSON-NONEMPTY` | `Go analysis resolves imports at package granularity: every non-test file of <pkg> shares this dependents set.` | JSON `granularityNote` |
| `NOTE-PKG-JSON-EMPTY` | `Go analysis resolves imports at package granularity: no file in the scanned context imports <pkg>, but this is a package-level observation and may be incomplete.` | JSON `granularityNote` |

`LINE-EXACT-EMPTY` is the string that exists today at `src/output/impact.ts:60` and must remain
byte-identical (FR-005, US2 scenario 4).

`NOTE-PKG-STDERR` deliberately names `gopls` only to deny its relevance. It must be a new
constant, not `degradedMessage('go')` (`src/core/lsp/availability.ts:169`), whose text asserts
that `gopls` is missing — an assertion `impact` is in no position to make, since it starts no
language server (FR-008).

`<pkg>` is the target's package directory relative to the scanned context, for example
`internal/repo`.

---

## 2. Case (a) — non-Go target, dependents present

Granularity is `file`. Nothing about this case changes except the two appended JSON keys.

**stdout, text mode**: unchanged from current behaviour — header block, impacted routes, direct
dependents, transitive dependents (`src/output/impact.ts:39-107`).

**stderr**: empty.

**`--json`**: current payload plus `"granularity": "file"` and `"granularityNote": null`. See
[../data-model.md](../data-model.md) section 5.4.

**exit code**: `0`.

---

## 3. Case (b) — non-Go target, zero dependents

**stdout, text mode**: header block, then `LINE-EXACT-EMPTY`, then end of output. Byte-identical
to current behaviour.

```
═════════════════════════════════════════════════════════════════
 🎯 Target: main.ts:1:1
 📁 Scanned: 5 files
 📊 Impact: 0 dependent(s), 0 direct, 0 route(s) impacted
 🚪 Route patterns: **/*.controller.ts, …
═════════════════════════════════════════════════════════════════

✅ No file depends on this target — modifying it impacts nothing else.
```

**stderr**: empty.

**`--json`**: empty `directDependents`, `dependents` and `routes`, plus
`"granularity": "file"` and `"granularityNote": null`.

**exit code**: `0`.

---

## 4. Case (c) — Go target, dependents present

Granularity is `package` even though the answer is non-empty. Over-attributing a package's
dependents to one of its files is exactly as coarse as under-attributing them to another, which is
why the label is not reserved for the empty case (US2 scenario 3).

**stdout, text mode**: **unchanged from current behaviour.** No qualifier line is added here.

An earlier draft of this contract inserted a `📦 Package-granular result: …` line after the header
separator. **ANALYZE dropped it (A-005)**: no requirement backs it. FR-006 scopes the text change to
the zero-dependents case in those words, US2 scenario 1 does the same, and US2 scenario 3 — the
scenario that does cover the non-empty case — asks only for the `--json` field. The signal is not lost:
`NOTE-PKG-STDERR` below fires on stderr for every package-granular result, empty or not.

```
═════════════════════════════════════════════════════════════════
 🎯 Target: internal/repo/inbound_repository.go:1:1
 📁 Scanned: 3 files
 📊 Impact: 1 dependent(s), 1 direct, 1 route(s) impacted
 🚪 Route patterns: **/cmd/**/main.go, …
═════════════════════════════════════════════════════════════════

🚪 IMPACTED ROUTES (verify these):
└── cmd/api/main.go:1:1
    ↳ main.go ↳ inbound_repository.go

📄 DIRECT DEPENDENTS (import the target directly):
└── cmd/api/main.go:1:1

📄 ALL TRANSITIVE DEPENDENTS (1):
└── cmd/api/main.go:1:1
```

The `🎯 NOTE: the target itself matches a route pattern.` block
(`src/output/impact.ts:54-57`) keeps its current position and precedence when applicable.

**stderr**: exactly one line, `NOTE-PKG-STDERR`. Emitted once per invocation, in both text and `--json` mode (section 6).

**`--json`**: `"granularity": "package"` and `granularityNote` set to
`NOTE-PKG-JSON-NONEMPTY`. See [../data-model.md](../data-model.md) section 5.2.

**exit code**: `0`.

---

## 5. Case (d) — Go target, zero dependents

The case the whole feature exists for. `LINE-EXACT-EMPTY` must not appear (FR-006).

**stdout, text mode**:

```
═════════════════════════════════════════════════════════════════
 🎯 Target: internal/orphan/thing.go:1:1
 📁 Scanned: 3 files
 📊 Impact: 0 dependent(s), 0 direct, 0 route(s) impacted
 🚪 Route patterns: **/cmd/**/main.go, …
═════════════════════════════════════════════════════════════════

⚠️  No file in the scanned context imports this package — but Go analysis is package-granular, so this is not a proof that the file is unused.
```

**stderr**: exactly one line, `NOTE-PKG-STDERR`, in both text and `--json` mode (section 6).

**`--json`**: empty arrays, `"granularity": "package"`, `granularityNote` set to
`NOTE-PKG-JSON-EMPTY`. See [../data-model.md](../data-model.md) section 5.3.

**exit code**: `0`.

---

## 6. Cross-cutting guarantees

**Exit code** is `0` for all four cases and for every combination of emptiness and granularity
(FR-007). The existing non-zero codes keep their current meanings and triggers: `1` file not
found, `2` context not found, `3` unhandled error (`src/cli/index.ts:21-25`). Reduced confidence
never reaches the exit code, because the "empty dependents is not a failure" contract is shared
with every other supported language and a caller cannot branch on the exit code without breaking
that.

**stdout under `--json`** carries the JSON document and nothing else. The `impact` action writes
no informational line to stdout today, and case (d)'s `LINE-PKG-EMPTY` is text-mode output only.

**`NOTE-PKG-STDERR` under `--json`**: **normative — emitted in both text and `--json` mode.** Settled
by ANALYZE (R2); this section previously left the choice open. FR-008 says "per invocation" without
qualification; US2 scenario 6 illustrates text mode but does not exclude JSON; stderr does not pollute
the JSON document on stdout; and the codebase already applies exactly that reasoning at
`src/cli/index.ts:182` ("Under --json, send this to stderr to keep stdout clean"). An agent consuming
`--json` is the caller who needs the signal most. In either mode the line appears exactly once,
because it is emitted from the CLI action after `analyze()` returns and never from a formatter.

**Ordering within a text-mode run**: stdout and stderr are independent streams and no test may
assert their interleaving. Assert each stream separately.

**Determinism**: `directDependents`, `dependents` and `routes` remain sorted
(`src/core/impact.ts:130-132`), so the same input yields byte-identical output across runs and
across filename permutations within a package (FR-003, SC-002).
