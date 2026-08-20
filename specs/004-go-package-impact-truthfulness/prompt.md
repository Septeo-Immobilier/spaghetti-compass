# prompt — 004-go-package-impact-truthfulness

## Original request

> (French framing sentence from the user, followed by an English bug report received from a downstream Go project.)

Voici un retour d'un projet go.

# spaghetti-compass — `impact` silently returns an empty dependents list for Go files that are not the first file of their package

## Summary

`spaghetti-compass impact <file.go>` returns `0 dependent(s), 0 direct, 0 route(s)` and prints
`No file depends on this target — modifying it impacts nothing else.` with exit code 0, for any Go
file that is **not the lexicographically-first non-test `.go` file in its package directory**. The
same command run against the *first* file of the *same* package returns 925 dependents and 2 impacted
routes. The root cause is not the missing `gopls`: `ImpactAnalyzer` never starts an LSP at all, and we
reproduced the identical empty result in a container where `doctor` reports `OK gopls`. The cause is
that Go package imports are resolved to a **single representative file** per package
(`src/core/go-mod.ts:265-273`), so the reverse edge lands on one arbitrary file and every other file
of the package becomes invisible to the reverse graph. Because the empty result is rendered as a green
success rather than as a degraded or unknown answer, a caller reads "safe to edit" when the true blast
radius is the whole package.

Two defects, ranked:

1. **Correctness (main).** Package-granular import resolution feeding a file-granular reverse graph
   produces false negatives for N-1 of the N files of every multi-file Go package, and over-attributes
   the whole package's impact to the 1 remaining file.
2. **Discoverability (secondary).** `explore` emits the degraded-LSP warning
   (`src/cli/index.ts:244-252`); `impact` never does (`src/cli/index.ts:297-384`), and the JSON output
   carries no confidence/degradation field. The `MISS gopls` line that our caller noticed is a real but
   *unrelated* signal, which is precisely why it was misread as the explanation.

## Environment

| Item | Value |
|---|---|
| Package | `@septeo-immo/spaghetti-compass` |
| Version | `1.0.0` (from `spaghetti-compass --version`; `CHANGELOG.md` dates 1.0.0 to 2026-07-15) |
| Host OS | `darwin` (macOS, arm64) |
| Host Go toolchain | **absent** — `which go` and `which gopls` both fail on the host |
| Invocation here | Docker-wrapped (house rule: no language toolchain runs on the host). The host global install is bind-mounted read-only and executed by the container's Node. |
| Node in container | v22 (`node:22-bookworm`) |
| Second image (control) | `node:22-bookworm` + `gopls` + Go toolchain copied from `golang:1.25-bookworm`, used to re-run every case with `doctor` reporting `OK gopls` |

Every command below is a single line of the form:

```bash
docker run --rm -v "$PWD":/app -v <global-install>:/sc:ro -w /app node:22-bookworm node /sc/bin/spaghetti-compass.js <subcommand> <args>
```

where `<global-install>` is the directory of the globally installed package. Reading it as a plain
host invocation, that is `spaghetti-compass <subcommand> <args>` run from the repository root.

Target repository shape (private, but the shape is what matters and is reproduced publicly in step 5
below): a monorepo whose Go module lives in a subdirectory — `go.mod` at `apps/backend/go.mod`, **not**
at repository root — alongside a TypeScript SPA at `apps/frontend/` and a Next.js site at `apps/docs/`.
The Go packages involved are large: `apps/backend/internal/application/ports/` holds 90 `.go` files and
`apps/backend/internal/infrastructure/postgres/` holds 88, all in a single package each.

## Steps to reproduce

### 1. `doctor` — baseline, host without a Go toolchain

```
Spaghetti Compass environment

OK   spaghetti-compass    /sc/bin/spaghetti-compass.js
OK   node                 /usr/local/bin/node
OK   TypeScript            bundled
MISS intelephense         install with: npm install -g intelephense
MISS pyright-langserver   install with: npm install -g pyright
MISS gopls                install with: go install golang.org/x/tools/gopls@latest

LSP note: spaghetti-compass starts its own LSP processes when available; it does not reuse VSCode/Cursor LSP sessions.
exit=0
```

`doctor` behaves correctly: it reports the miss, gives the install hint, and exits 0 because the LSP is
optional. No complaint here.

### 2. `impact` on two real Go declarations — empty, green, exit 0

Targets (both verified present):
`apps/backend/internal/application/ports/inbound_repository.go`, which declares
`GetByPAExternalID` on an interface at line 14, and
`apps/backend/internal/infrastructure/postgres/inbound_document_repository.go`, which declares the
concrete `GetByPAExternalID` at line 72.

```
 Target: internal/application/ports/inbound_repository.go:1:1
 Scanned: 1900 files
 Impact: 0 dependent(s), 0 direct, 0 route(s) impacted
 Route patterns: **/*.controller.ts, [...], **/cmd/**/main.go, **/*handler.go, **/*handlers.go, **/*routes.go, **/*router.go, **/internal/http/**/*.go, **/internal/handlers/**/*.go, **/internal/server/**/*.go

No file depends on this target — modifying it impacts nothing else.
exit=0
```

The second target gives the byte-identical verdict:

```
 Target: internal/infrastructure/postgres/inbound_document_repository.go:1:1
 Scanned: 1900 files
 Impact: 0 dependent(s), 0 direct, 0 route(s) impacted

No file depends on this target — modifying it impacts nothing else.
exit=0
```

Note that `Scanned: 1900 files` proves the Go files *were* collected and parsed; this is not a
"nothing found to scan" situation.

### 3. Same package, different file — 925 dependents

`admin_query.go` is the lexicographically-first non-test `.go` file of the same `ports` package that
step 2 reported as impacting nothing:

```
 Target: internal/application/ports/admin_query.go
 Scanned: 1900 files
 Impact: 925 dependent(s), 637 direct, 2 route(s) impacted

IMPACTED ROUTES (verify these):
- cmd/api/main.go        (main.go -> admin_query.go)
- internal/infrastructure/http/router.go   (router.go -> admin_query.go)
exit=0
```

The same experiment on the `postgres` package: `admin_query_catalog.go` (its first non-test file)
returns `105 dependent(s), 105 direct, 1 route(s)`, while `inbound_document_repository.go` in that same
directory returns 0.

This is the whole bug in two commands: **two files of one package, 925 dependents versus 0.** Neither
number is right. 925 is the impact of the *package*, wrongly attributed to one file; 0 is the impact of
the same package, wrongly denied to another.

### 4. Control: the same runs with `gopls` present change nothing

Image built as: `FROM golang:1.25-bookworm AS gotools` with `GOTOOLCHAIN=auto` and
`go install golang.org/x/tools/gopls@latest`, then `FROM node:22-bookworm` copying
`/usr/local/go` and `/go/bin/gopls` into it. With `gopls` OK (`OK gopls /usr/local/bin/gopls`), the
three `impact` runs are unchanged: 0 / 0 / 925.

`gopls` is exonerated. This matters for triage: "install gopls" is not the fix.

### 5. Minimal public reproduction — 4 files, no private code

A maintainer can replay the whole defect with this tree, which mirrors the input shape (Go module in a
monorepo subdirectory, multi-file package):

```
apps/backend/go.mod                                module example.com/app / go 1.25.0
apps/backend/internal/ports/aaa_alpha.go           package ports — type AlphaPort interface { Alpha() error }
apps/backend/internal/ports/inbound_repository.go  package ports — type InboundDocumentRepositoryPort interface { GetByPAExternalID(...) }
apps/backend/cmd/api/main.go                       package main — import "example.com/app/internal/ports"; var _ ports.InboundDocumentRepositoryPort
```

`main.go` imports the package **specifically to reference the symbol declared in
`inbound_repository.go`**, and references nothing from `aaa_alpha.go`. Then:

- `impact apps/backend/internal/ports/inbound_repository.go -c . --no-links`
  -> `Scanned: 3 files`, `0 dependent(s), 0 direct, 0 route(s)`, green success, exit=0.
- `impact apps/backend/internal/ports/aaa_alpha.go -c . --no-links`
  -> `Scanned: 3 files`, `1 dependent(s), 1 direct, 1 route(s)`, impacted route `apps/backend/cmd/api/main.go`.

The impact is attributed to the file nothing references, and denied to the file that is the sole
reason the import exists. Renaming `aaa_alpha.go` to `zzz_alpha.go` flips which file gets the
dependents — that is the sort order at `src/core/go-mod.ts:271` deciding the answer.

An identical variant with `go.mod` at the root of the scanned tree (`go.mod`, `internal/ports/*.go`,
`cmd/api/main.go`) produces exactly the same 0-versus-1 split, which refutes the `go.mod`-in-a-
subdirectory hypothesis (see Hypotheses below).

### 6. Contrast: the TypeScript path is correct at file granularity

Same install, same invocation, TypeScript target
(`impact apps/frontend/src/routes/invoices/index.tsx -c apps/frontend/src --no-links`):

```
 Target: routes/invoices/index.tsx
 Scanned: 228 files
 Impact: 2 dependent(s), 1 direct, 0 route(s) impacted

No route matched **/*.controller.ts, [...] among the dependents.
    Use --routes to point at your entry points, or inspect the dependents below.

DIRECT DEPENDENTS (import the target directly):
- routeTree.gen.ts

ALL TRANSITIVE DEPENDENTS (2):
- main.tsx
- routeTree.gen.ts
exit=0
```

Correct, and correctly per-file. A second TypeScript target (`hooks/useInvoiceSearch.ts`) returns
`7 dependent(s), 4 direct` with the four real importers named. So the install is healthy and the
defect is language-specific.

This run also shows the tool *does* own a hedging vocabulary — the `No route matched ... inspect the
dependents below` branch. It is reached only when `dependents.length > 0`; the
`dependents.length === 0` branch at `src/output/impact.ts:59-61` is unconditionally the green
`No file depends on this target` line.

### 7. `explore` on the same Go file does warn

```
No tsconfig.json found, alias resolution disabled
Warning: Go LSP unavailable: `gopls` was not found in PATH. Continuing with parser fallback; symbol positions may be less precise.
 Entry Point: internal/application/ports/inbound_repository.go
 Stats: 2 internal, 0 external, 2 third-party, 2 unresolved
```

So the warning machinery works — it is simply not wired into `impact`. A caller who runs `doctor` and
`explore` sees the degradation; a caller who runs only `impact` (the documented review recipe) sees
nothing.

## Expected vs actual

**Actual.** `impact` on a Go file that is not its package's first non-test file: `dependents: []`,
`directDependents: []`, `routes: []`, `scannedFiles: 1900`, exit code 0, and the rendered line
`No file depends on this target — modifying it impacts nothing else.` The `--json` payload contains
no field distinguishing this from a genuine leaf: keys are `target`, `targetAbsolute`, `scannedFiles`,
`directDependents`, `dependents`, `routes`, `routePatterns`, `targetIsRoute`.

**Expected — correctness.** Since Go's unit of import is the package, a reverse edge derived from a Go
import should attach to **every** `.go` file of the imported package, not to one representative. The
truthful answer for `inbound_repository.go` is the same set the tool already computes for
`admin_query.go`: the 925 files that (transitively) import package `ports`, and the 2 route entry
points. Conversely, if the tool intends genuine file-level Go precision, the answer must be narrowed by
symbol usage for *both* files — but it must not be package-granular in one direction and file-granular
in the other.

**Expected — contract when a backend is unavailable or the analysis is inherently coarse.** An empty
list must be distinguishable from an unknown. Concretely, for the Go path we would expect either
(a) a non-empty answer at package granularity, or (b) an explicit third state — e.g. a
`"confidence": "package-level" | "exact"` or `"degraded": true` field in JSON plus a stderr line and a
non-green rendering — so that automation can branch on it. The current output makes
"nothing depends on this" and "we cannot see what depends on this" the same value. A reviewer, human or
agent, cannot tell them apart.

## Ground truth

Independent evidence for the target symbol, collected with plain grep over the Go tree
(`grep -rn "GetByPAExternalID" --include="*.go" apps/backend`):

- **22** textual occurrences across **14** files.
- **9** actual invocation sites (`grep -rn "\.GetByPAExternalID("`) across **6** files:

| Path (repo-relative) | Line |
|---|---|
| `apps/backend/internal/application/usecases/ingest_reception_webhook.go` | 94 |
| `apps/backend/internal/application/usecases/ingest_reception_webhook.go` | 127 |
| `apps/backend/internal/application/usecases/receive_invoice.go` | 47 |
| `apps/backend/internal/application/usecases/receive_webhook.go` | 45 |
| `apps/backend/internal/infrastructure/river/polling_worker.go` | 151 |
| `apps/backend/tests/integration/inbound_document_repository_test.go` | 46 |
| `apps/backend/tests/integration/inbound_document_repository_test.go` | 57 |
| `apps/backend/tests/integration/reception_convergence_test.go` | 105 |
| `apps/backend/tests/integration/reception_convergence_test.go` | 166 |

- Declaration sites: 1 interface method (`apps/backend/internal/application/ports/inbound_repository.go:14`),
  1 concrete implementation (`apps/backend/internal/infrastructure/postgres/inbound_document_repository.go:72`),
  and 5 test doubles implementing the same method.

**On the "eight call sites" figure our caller reported: it does not reproduce exactly.** The closest
reproducible counts are 9 invocations / 6 files / 22 occurrences / 14 files. The direction of the claim
holds decisively (the true count is not zero, and five of the nine invocations are production code on
the inbound-reception path), but the exact number 8 should not be quoted to maintainers.

The cleanest ground truth for a *file-level* claim, however, does not depend on our grep at all: it is
the tool's own output. `impact` says 925 files depend on `ports/admin_query.go` and 0 files depend on
`ports/inbound_repository.go`. Both files are in the same package, in the same directory, imported by
the same import statements. At most one of those two answers can be right.

## Impact

The skill shipped with the tool (`skills/spaghetti-compass/SKILL.md`) advertises `impact` as the review
gate — its first documented use case is, in substance, run `impact` on each changed file and read the
`routes` field to know which entry points to re-test. It supplies a `for f in $(git diff --name-only ...)`
loop for exactly that. Under that recipe, on a Go monorepo:

- Every changed Go file that is not its package's alphabetically-first file yields
  `0 dependent(s), 0 route(s)` and the affirmative sentence *"modifying it impacts nothing else"*.
- The recipe's own guidance for the empty case only covers empty **routes** with non-empty dependents
  ("either the change is purely internal, or the route patterns do not match"). It offers no reading
  for empty **dependents**, because empty dependents is presented as a fact, not a possibility.
- Exit code is 0, so a CI or agent loop cannot detect the condition programmatically. Neither can it
  detect it from the JSON, which has no degradation field.
- The failure is *systematically biased toward the interesting files*. Large Go packages accumulate
  files alphabetically; the file being edited during a feature is almost never `admin_query.go`. The
  more mature the package, the more likely the answer is a false negative.

Empty-and-confident is worse than an error here because it inverts the tool's value proposition. An
error costs a caller one minute and a fallback to grep. A green "impacts nothing else" on a repository
port implemented by 5 test doubles and called from 5 production sites invites an unreviewed
signature change. In our case the caller had to be told the tool was wrong before believing the grep.

## Hypotheses, ranked

### H1 — Go imports resolve to a single representative file per package (confirmed)

`GoModResolver._resolveImportInternal` maps an import path to a package directory, lists its `.go`
files, prefers non-test files, sorts them, and returns `candidates[0]`
(`src/core/go-mod.ts:254-273`). `ImpactAnalyzer` then builds `reverseDeps` keyed on exactly that
resolved path (`src/core/impact.ts:82-92`, via `resolveInternalImports` at 165-195). Therefore at most
one file per Go package can ever appear as a key in the reverse graph, and the BFS from any other file
of that package starts from a node with no in-edges.

**Evidence for:** the source path above; the 925-vs-0 split within one package (step 3); the same split
reproduced in a 4-file public module (step 5); the sort order deciding the winner
(`aaa_alpha.go` wins, rename flips it); the postgres package behaving identically with a different
first file. **Evidence against:** none found.

Corroborating detail worth flagging to maintainers: the README states that for Go, "Internal imports
point at the package's `.go` files" (plural). The implementation points at one. And **every Go fixture
package in the repository is a single-file package** — `fixtures/go/cmd/service/`,
`fixtures/go/internal/application/usecases/`, `fixtures/go/internal/domain/invoice/`,
`fixtures/go/internal/handlers/`, `fixtures/go/internal/ports/` each hold exactly one `.go` file. The
defect is structurally invisible to the current fixture set, including to the README's own example
`spaghetti-compass impact fixtures/go/internal/domain/invoice/entity.go -c fixtures/go`. Adding a second
file to `fixtures/go/internal/ports/` and asserting on the non-first file should reproduce this in the
project's own test suite.

### H2 — `impact` never surfaces LSP degradation (confirmed, but it is a second defect, not this one)

The degraded-warning loop exists only in the `explore` action (`src/cli/index.ts:244-252`); the
`impact` action (`src/cli/index.ts:297-384`) constructs `ImpactAnalyzer` and formats the result without
consulting any LSP status. `ImpactAnalyzer.analyze` is synchronous and uses only `ParserFactory` and
`PathResolver` — it starts no language server at all, for any language.

**Evidence for:** the source; step 7 (explore warns) versus step 2 (impact silent). **Evidence
against:** nothing — but note this means it is *correct* that `impact` does not warn about `gopls`,
since `gopls` genuinely does not affect `impact`. The reportable gap is narrower: `impact` has no way to
express *any* reduced-confidence state, LSP-related or not, which is what let H1 present itself as a
clean negative.

### H3 — `go.mod` in a monorepo subdirectory rather than at repository root (refuted)

This was our most attractive hypothesis before testing, and it is wrong. Tested four ways:

| Configuration | `inbound_repository.go` | `admin_query.go` |
|---|---|---|
| cwd = repo root, `-c apps/backend` (go.mod one level below cwd) | 0 dependents | 925 dependents |
| cwd = `apps/backend` (inside the module), `-c .` | 0 dependents | 925 dependents |
| cwd = repo root, `-c .` (scans 2273 files incl. the TypeScript apps) | 0 dependents | 925 dependents |
| public repro with `go.mod` at the scanned-tree root | 0 dependents | 1 dependent |

`go.mod` placement changes nothing; `GoModResolver.findModule` walks up from each source file
(`src/core/go-mod.ts:43-84`) and finds the module correctly in every configuration. Nearest-`go.mod`
detection works as documented.

### H4 — The user's environment lacks `gopls`, i.e. a setup problem (true but irrelevant; and it is not a packaging bug)

The host has no Go toolchain, so `MISS gopls` is expected and accurate. On packaging: `gopls` is
declared **optional by design** — `LSP_COMMANDS` gives it the install hint
`go install golang.org/x/tools/gopls@latest` (`src/core/lsp/availability.ts:72-79`), the README calls it
"Optional `gopls`" with a "clean file-level fallback when absent", TypeScript is the only bundled
language service (`typescript` is a runtime dependency; `intelephense` is a devDependency), and the
project ships no Dockerfile or image reference. There is nothing to fix in packaging: `gopls` is
correctly expected on the host PATH, correctly detected, correctly reported as MISS, and correctly
never auto-installed. **We are explicitly not filing a packaging bug.** Step 4 shows installing it does
not change the result.

### Is the limitation already documented?

Partly, and not in a way that covers this. The README's Go section has a "Known limitations" paragraph,
but it scopes the no-`gopls` fallback to interprocedural resolution: calls dispatched through
interfaces or injected dependencies "may not link to a concrete implementation". It says analysis
"stays file/package-level and never fails". Neither sentence tells a reader that `impact` on a Go file
can return a confident empty dependents list. The gap between "less precise symbol positions" and
"zero dependents reported for a file with 925" is the whole report. So this is not a
"documentation exists, warning not surfaced" downgrade — the documented limitation describes a
different, milder behaviour than what occurs.

## Suggested fix

Kept deliberately short and non-prescriptive about internals; any of these would have saved us the
investigation.

1. **Make Go reverse edges package-wide.** When a Go import resolves to a package directory, register
   the reverse edge against every non-excluded `.go` file in that directory rather than one
   representative. This makes `impact` truthful in both directions and needs no LSP.
2. **Never render an empty result as a success.** Reserve `... impacts nothing else` for cases the
   analyzer can actually vouch for. For anything coarser, say so — e.g. "0 direct importers found;
   Go analysis is package-granular, so this may be incomplete" — and give `--json` a machine-readable
   `confidence` or `degraded` field so agent loops and CI can branch on it. Today an empty list is
   indistinguishable from an unknown, in both the text and the JSON.
3. **Wire the existing degradation channel into `impact`.** `degradedMessage()` and the
   `LspProviderStatus` plumbing already exist and already work in `explore`; `impact` returns no status
   at all.
4. **Add a multi-file Go package to the fixtures.** One extra file in `fixtures/go/internal/ports/`
   plus an assertion on the non-first file would have caught this, and would guard the fix.

## What we did instead

We fell back to `grep -rn` for the call sites and recorded the change's blast radius as INFERRED rather
than proven, since no tool in the chain could vouch for the reverse dependency set of a Go file.

## English translation

The report above is already in English. The only non-English element is the user's framing
sentence: "Voici un retour d'un projet go." — "Here is feedback from a Go project."
