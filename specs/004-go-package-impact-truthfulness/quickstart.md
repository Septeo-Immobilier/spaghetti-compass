# Quickstart: Truthful Go package impact analysis

Manual smoke test for `specs/004-go-package-impact-truthfulness/`. Every command runs inside
`node:20.18.1-bookworm-slim`; nothing is installed on the host. From the repository root.

## 0. Build

```bash
docker run --rm -v "$PWD:/workspace" -w /workspace node:20.18.1-bookworm-slim npm ci
docker run --rm -v "$PWD:/workspace" -w /workspace node:20.18.1-bookworm-slim npm run build
```

## 1. Test suite is green (SC-004)

```bash
docker run --rm -v "$PWD:/workspace" -w /workspace node:20.18.1-bookworm-slim npm run test:run
```

Expect: all suites pass, including the pre-existing `go-mod.test.ts`, `resolver.test.ts`,
`impact.test.ts` and `go-integration.test.ts` cases, none of which were edited for the widening itself.

## 2. Both files of the multi-file package agree (US1, SC-001)

```bash
docker run --rm -v "$PWD:/workspace" -w /workspace node:20.18.1-bookworm-slim \
  ./bin/spaghetti-compass.js impact fixtures/go/internal/notify/sender.go -c fixtures/go --json

docker run --rm -v "$PWD:/workspace" -w /workspace node:20.18.1-bookworm-slim \
  ./bin/spaghetti-compass.js impact fixtures/go/internal/notify/aaa_marker.go -c fixtures/go --json
```

Expect for **both**: `dependents` and `directDependents` contain `cmd/notifier/main.go`, and `routes`
holds one entry for it (it matches the default pattern `**/cmd/**/main.go`). The two payloads differ only
in `target` / `targetAbsolute`.

Pre-fix contrast, worth reproducing once on `main` before merging: `sender.go` returns
`0 dependent(s), 0 route(s)` while `aaa_marker.go` returns 1 and 1. That asymmetry is the defect.

## 3. Rename invariance (US1 scenario 3, SC-002)

```bash
git mv fixtures/go/internal/notify/aaa_marker.go fixtures/go/internal/notify/zzz_marker.go

docker run --rm -v "$PWD:/workspace" -w /workspace node:20.18.1-bookworm-slim \
  ./bin/spaghetti-compass.js impact fixtures/go/internal/notify/sender.go -c fixtures/go --json

git mv fixtures/go/internal/notify/zzz_marker.go fixtures/go/internal/notify/aaa_marker.go
```

Expect: `dependents`, `directDependents` and `routes` identical to step 2. Restore the name before
committing — the automated equivalent lives in a temp module inside the test suite.

## 4. Granularity marker, empty and non-empty (US2, SC-003)

Non-empty Go target — step 2's payload already shows it:

```json
"granularity": "package",
"granularityNote": "<one sentence naming Go package granularity>"
```

Empty Go target (nothing imports `cmd/service/main.go`):

```bash
docker run --rm -v "$PWD:/workspace" -w /workspace node:20.18.1-bookworm-slim \
  ./bin/spaghetti-compass.js impact fixtures/go/cmd/service/main.go -c fixtures/go --json
```

Expect: `dependents: []` **and** `granularity: "package"`. The marker is not reserved for the empty
case.

Non-Go target, for the unchanged side of the contract:

```bash
docker run --rm -v "$PWD:/workspace" -w /workspace node:20.18.1-bookworm-slim \
  ./bin/spaghetti-compass.js impact fixtures/typescript/models/user.ts -c fixtures/typescript --json
```

Expect: `granularity: "file"`, `granularityNote: null`, every other key byte-identical to v1.0.0.

## 5. Qualified text output on an empty Go result (FR-006)

```bash
docker run --rm -v "$PWD:/workspace" -w /workspace node:20.18.1-bookworm-slim \
  ./bin/spaghetti-compass.js impact fixtures/go/cmd/service/main.go -c fixtures/go
```

Expect: the line `No file depends on this target — modifying it impacts nothing else.` is **absent**,
replaced by a statement that the analysis is package-granular and may be incomplete
(`LINE-PKG-EMPTY`, `contracts/impact-cli.md` §1).

Then the **non-empty** Go case, which must be the opposite — stdout unchanged:

```bash
docker run --rm -v "$PWD:/workspace" -w /workspace node:20.18.1-bookworm-slim \
  ./bin/spaghetti-compass.js impact fixtures/go/internal/notify/sender.go -c fixtures/go
```

Expect: no qualifier line anywhere in stdout. ANALYZE dropped it (A-005) because no FR requires it;
the package-granularity signal for this case travels on stderr instead (step 6). A `📦
Package-granular result: …` line appearing here is a defect, not a feature.

## 6. One stderr line, distinct from the LSP warning (FR-008)

```bash
docker run --rm -v "$PWD:/workspace" -w /workspace node:20.18.1-bookworm-slim \
  ./bin/spaghetti-compass.js impact fixtures/go/internal/notify/sender.go -c fixtures/go \
  2>/tmp/sc-stderr.txt >/dev/null
wc -l < /tmp/sc-stderr.txt
```

Expect: exactly `1`. The line names Go package granularity and mentions neither `gopls` nor a degraded
language server — `impact` starts no LSP for any language.

Same check with `--json`: stdout stays a single parseable object, stderr still one line.

## 7. Exit code stays 0 (FR-007)

```bash
docker run --rm -v "$PWD:/workspace" -w /workspace node:20.18.1-bookworm-slim \
  ./bin/spaghetti-compass.js impact fixtures/go/cmd/service/main.go -c fixtures/go >/dev/null 2>&1
echo "exit=$?"
```

Expect: `exit=0`. Same for the non-empty case in step 2.

## 8. README corrections — two sites (FR-011, SC-005)

Both sites are mandatory. Line ranges are pre-edit, verified at commit `cc67147`.

```bash
sed -n '173,179p' README.md   # (a) optional-gopls blockquote
sed -n '448,454p' README.md   # (b) Go "Known limitations"
sed -n '364,369p' README.md   # (c) --json key list, optional
```

- **(a) `README.md:175-177`** — the optional-`gopls` blockquote. Expect the claim "analysis stays
  file/package-level and never fails" to be gone or qualified: `impact` answers at package
  granularity for Go whether or not `gopls` is installed, and the text must no longer imply
  otherwise. This is the sentence `spec.md:67` quotes, so leaving it untouched fails SC-005 even if
  (b) is perfect.
- **(b) `README.md:450-452`** — the Go "Known limitations" paragraph. Expect it to state that
  `impact` results for Go targets are package-granular in every case — every non-test file of an
  imported package shares one dependents set — **alongside** the pre-existing
  interprocedural-resolution caveat, not instead of it.
- **(c) `README.md:366-367`** — the `--json` key enumeration. Optional: check whether it now lists
  `granularity` and `granularityNote`. No FR mandates it.

## 9. Performance sanity (NFR-001, manual, not a gate)

Not measurable on the 77-file fixture set. Run against a large mixed context — the reporting project, or
any checkout with ~1,900 files and a Go package of ~90 files — once on `main` and once on this branch:

```bash
docker run --rm -v "$PWD:/workspace" -w /workspace node:20.18.1-bookworm-slim \
  bash -c 'time ./bin/spaghetti-compass.js impact <target.go> -c <large-context> --json > /dev/null'
```

Expect: no more than 20% added wall-clock. If the delta exceeds that, the likely cause is a lost cache —
check that `packageFilesCache` is hit rather than re-reading the package directory per import edge.
