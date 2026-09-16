---
name: spaghetti-compass
description: >
  Explore, review, and narrate code with the spaghetti-compass CLI. Four use-cases —
  (1) in review, run reverse impact analysis on changed files to know which files and
  routes to re-test; (2) explore dependencies and the call-graph before refactoring,
  including cycle detection; (3) narrate the data flow in plain prose with clickable
  `path:line:col` links to each symbol; (4) file a reproducible bug report as a GitHub
  issue when the tool answers wrongly. Use when the user asks to "review", "see the
  impact of a change", "refactor", "explore dependencies", "see who calls X", "detect
  cycles", "explain / narrate how a flow works", or "report a spaghetti-compass bug".
---

# `spaghetti-compass` — explore, review, and narrate code

`spaghetti-compass` leans on **LSP** servers (TypeScript, Intelephense, Pyright, gopls) and parsers to give **semantic resolution** (real definitions and calls, not text matches), a **transitive dependency graph**, **cycle detection**, and **reverse impact analysis** (who depends on this file).

Three commands:

- `explore <entry>` — **forward** analysis: from a file (or `file:function`), follow imports and calls.
- `impact <file>` — **reverse** analysis: from a target file, find every file **and route** that depends on it.
- `doctor` — diagnose the environment: Node, the `spaghetti-compass` CLI, and LSP-tool availability.

The **text** output of `explore` and `impact` exposes clickable `path:line:col` paths (Ctrl+Click in VSCode/Cursor). `--json` carries no `:line:col` suffix at all — the text formatter adds it — so its `path`, `target` and `chain` entries are plain relative paths, alongside the absolute variants `targetAbsolute` and `routes[].absolutePath`. `doctor` prints filesystem paths, not source locations. Add `--json` for any programmatic use.

License: MIT. npm package: **`@septeo-immo/spaghetti-compass`** (Node >= 20). The unscoped name `spaghetti-compass` is **not** on the registry — only the binary it installs is called that.

## Availability & install (OPTIONAL — degrade gracefully if absent)

This tool is **optional**. Probe first; if it is unavailable, skip it and fall back to normal reasoning — never block on it.

**Probe**:
```bash
spaghetti-compass doctor
# or, when only the Docker-wrapped npx form is available:
docker run --rm -v "$(pwd)":/app -w /app node:20 npx -y @septeo-immo/spaghetti-compass doctor
```

**`-y` is not optional.** Without it, `npx` asks "Ok to proceed?", gets no TTY, abandons the
install, and falls through to a `PATH` lookup — which prints `sh: 1: spaghetti-compass: not found`
**and exits 0**. An agent reading the exit code sees success; an agent reading the text concludes
the tool does not exist. Both are wrong: the invocation was.

`doctor` prints one `OK` / `MISS` line per tool. **Read the rows, not the exit code**: as of 1.1.2
the two runtime rows are computed from a hard-coded `true` and from `path.resolve()`, which never
fails, so `doctor` exits `0` even when `bin/spaghetti-compass.js` has been deleted. A `MISS` on an
LSP row never affects the exit code either.

```
Spaghetti Compass environment

OK   spaghetti-compass    /usr/local/lib/node_modules/@septeo-immo/spaghetti-compass/bin/spaghetti-compass.js
OK   node                 /usr/local/bin/node
OK   TypeScript            bundled
MISS intelephense         install with: npm install -g intelephense
MISS pyright-langserver   install with: npm install -g pyright
MISS gopls                install with: go install golang.org/x/tools/gopls@latest
```

A `MISS` never blocks an analysis — it degrades the precision of **`explore`**, and the warning goes to **stderr** so `--json` on stdout stays parseable. Install the matching LSP before any precision-sensitive `explore` on PHP, Python, or Go. It changes nothing for `impact`, which starts no language server and reads every file through the parsers regardless.

**Install** (host global binary): `npm i -g @septeo-immo/spaghetti-compass`.

**Host vs Docker execution rule** — a Docker-only policy applies to language toolchains (`node`/`npm`/`npx`/`python`/…), but:

- The standalone **`spaghetti-compass` binary is not a forbidden toolchain**. When it is installed on the host, run it **directly on the host** — host LSPs improve resolution:
  ```bash
  spaghetti-compass impact src/shared/domain/project.model.ts -c . --json
  ```
- The **`npx` form is denied** by that policy, so Docker-wrap it:
  ```bash
  docker run --rm -v "$(pwd)":/app -w /app node:20 npx -y @septeo-immo/spaghetti-compass impact src/app.ts -c src --json
  ```
  Adding `--user $(id -u):$(id -g)` needs a writable npm cache, or the install dies the same
  silent way: `--user $(id -u):$(id -g) -e HOME=/tmp -e npm_config_cache=/tmp/.npm`. The tool only
  reads the mounted tree, so it creates no root-owned files and `--user` buys nothing here.

`spaghetti-compass` never reuses the LSP session VSCode/Cursor already runs: it starts its own processes when the executables are in `PATH`. In Docker, the image must carry them too.

**Arguments**:
- `explore <entry>`: a repo-relative path, optionally suffixed with a symbol —
  `src/core/analyzer.ts` or `src/services/auth.ts:login`.
- `impact <file>`: a repo-relative path, **file only**. The `:function` suffix is parsed by
  `explore` alone; passing it to `impact` looks for a file literally named `auth.ts:login` and
  exits 1 with `Error: File not found: <resolved absolute path>`.
- `<context>` (`-c`): the "internal" directory (e.g. `src/` or `.`) used to classify internal / external / third-party.

---

## Use-case 1 — In review: impact of changed files

**When**: review phase, or before committing / pushing a change. Goal: know **which routes and files** could break, with no glue code — `impact` is enough.

**Recipe**: take the changed files from git, run `impact` on each, read the `routes` field.

```bash
# Files changed relative to the PR base (or HEAD)
git diff --name-only -z --diff-filter=d origin/main...HEAD |
  while IFS= read -r -d '' f; do
    case "$f" in
      *.ts|*.tsx|*.js|*.jsx|*.py|*.pyi|*.php|*.go) ;;
      *) continue ;;
    esac
    echo "### $f"
    spaghetti-compass impact "$f" -c . --json
  done
```

Three details in that loop are load-bearing, and the obvious one-liner gets all three wrong.
`-z` with `read -d ''` survives a path containing a space, which `for f in $(git diff …)` splits
into two invocations. `--diff-filter=d` drops deleted files, which `impact` cannot resolve and
which exit 1. The `case` list is exactly `impact`'s own default scan set — a changed `.yml` or
`.md` otherwise costs a full context scan to produce nothing, and `.mjs` / `.cjs` are left out on
purpose: `explore` accepts them as an entry, but `impact`'s default `--include` does not collect
them as dependents. Pass `-i` explicitly for an `.mjs` codebase, remembering that `-i` **replaces**
the default list rather than extending it.

In each JSON output:

- `routes`: the **impacted entry points** (route, handler, cron…) — re-test / re-review these first. Each entry carries a relative `path`, its `absolutePath`, and a `chain` (route → … → changed file) explaining *why* the route is affected. None of them is suffixed with `:line:col`; run without `--json` if you want clickable output.
- `directDependents`: files that import the target directly.
- `dependents`: all transitive dependents (the real blast radius).
- `granularity`: `"file"` or `"package"` — how precisely the answer is scoped. Read it before you trust a count.
- `granularityNote`: the one-line caveat when `granularity` is `"package"`; `null` otherwise.
- `coveringTests`: the test files that reach the target — **what to re-run**, kept deliberately out of the three fields above.

**How to use it in review**: for each changed file, cite the impacted routes, then read `coveringTests` to name the tests that already exercise them — that pair is the whole review answer, "what could break" and "what proves it still works". If `routes` is empty while dependents exist, either the change is purely internal, or the route patterns don't match (see `--routes` / `config/route-patterns.txt`).

### Two questions, two fields — never mix them

A test file that imports the target **is** a reverse dependency, and reporting it as blast radius
is how this tool used to lie. Measured on a real Go backend: 120 impacted routes, of which 116
were `_test.go` files, the four real entry points buried underneath and the tests sorted first.

So the reverse set is split, *after* the graph is built rather than by excluding tests from the
scan — an excluded file cannot be reported at all:

| Field | Holds | Answers |
|-------|-------|---------|
| `dependents`, `directDependents`, `routes` | production code only | what could break |
| `coveringTests` | test files reaching the target | what to re-run |

`testPatterns` reports how the two were told apart. `--tests <glob...>` replaces that list for a
project whose tests are named otherwise — and like `--routes`, `--include` and `--exclude`, it
**replaces**, never extends.

### Reading an empty answer on Go — never as a proof

**Go targets always report `granularity: "package"`**, because Go's unit of import is the package, not the file. Consequences, and they are load-bearing:

- Every non-test `.go` file of a package **shares one dependents set**. A file that nothing references still reports the whole package's dependents, and that is correct, not a bug.
- A zero on a Go file means *no file in the scanned context imports this package*. It is **not** a proof that the file is unused. The text output says so rather than printing the green leaf line:
  > ⚠️  No file in the scanned context imports this package — but Go analysis is package-granular, so this is not a proof that the file is unused.
- One stderr line is emitted per invocation, in both text and `--json` mode:
  > Note: Go impact analysis is package-granular — every non-test file of the target's package shares the reported dependents. This is a property of Go's import model, not of gopls availability.
- That note has nothing to do with `gopls`: `impact` starts **no** language server, for any language. Installing `gopls` does not make a Go `impact` result file-granular.

So on Go, treat a zero as "widen the search" (grep the symbol, check other modules, check the `--context` you passed), and never quote a per-file dependent count — quote the package's.

TypeScript, JavaScript, Python, and PHP targets report `granularity: "file"` — an answer scoped to the file, not to a package. That is still not a proof of absence: a context file whose parser throws contributes no edges and is skipped silently, so an empty `dependents` means "nothing the parsers could read imports this", not "nothing imports this".

---

## Use-case 2 — Explore the code efficiently

**When**: before a **refactoring** (rename, move, extract), to understand a complex file or function, or to check for **circular dependencies**.

**Why not grep?** Grep searches text (and matches comments, strings, false positives). `spaghetti-compass` resolves the **real** definitions and calls via LSP, follows transitivity, and flags cycles.

```bash
# Dependencies of a file (transitive tree)
spaghetti-compass explore src/main.ts -c src/ --json

# Call-graph of a function / method
spaghetti-compass explore src/services/auth.ts:login -c src/ --json
spaghetti-compass explore src/core/Analyzer.ts:Analyzer.analyze -c src/ --json

# Direct dependencies only
spaghetti-compass explore src/main.ts -c src/ --no-transitive --json

# Detect cycles
spaghetti-compass explore src/index.ts -c src/ --json
# then: jq '.stats.circularDependencies'
```

In the JSON: `nodes` (files / functions / external modules — id, type, name, path, location), `edges` (from, to, type `import-static` | `import-dynamic` | `call`, resolved), `stats.circularDependencies`, `entryPoint`.

---

## Use-case 3 — Narrate the data flow in plain language

**When**: the user wants to **understand / explain** a flow ("explain how … works", "narrate what happens when we call …"). Goal: a **prose story**, from the HTTP request to the end (response, DB write, external call), where **each sentence or sentence fragment** is followed in parentheses by the **Ctrl+Click link** to the symbol that carries the meaning of that fragment.

**Recipe**:

1. Find the route's **handler** (the `file:function` of the HTTP entry point).
2. `spaghetti-compass explore <file>:<handler> -c <context> --json` to get the call-graph. Each `node` carries `path` + `line` → that's the link to cite. The traversal is depth-first over the call sites **in source order**, which is not the same thing as execution order: a call inside an `if`, a loop, an early return or an `await` appears where it is written, not where it runs.
3. Walk the tree top-down and write the prose. For each step, paste the `path:line:col` link of the relevant symbol right after the fragment that describes it.
4. If a call crosses into another layer (service → repository → external client), re-run `explore` on that symbol to continue the story.

**Style rule**: the link follows the **fragment that expresses that symbol's action**, not the whole sentence. Prefer fine granularity (one link per step) over a single link at the end of a paragraph.

### Example — user registration (route `register`)

> *The paths below are illustrative: replace them with what `explore` actually returns for the current project.*

Starting point:
```bash
spaghetti-compass explore src/modules/auth/auth.controller.ts:AuthController.register -c src/ --json
```

Resulting narrative:

> When a client sends a `POST /auth/register`, the request reaches the route handler (src/modules/auth/auth.controller.ts:42:3), which starts by validating the received body against the registration schema (src/modules/auth/dto/register.dto.ts:8:14). Once the payload is deemed valid, the controller delegates all the logic to the authentication service (src/modules/auth/auth.service.ts:55:3). That service first checks that no account already exists for this email (src/modules/auth/auth.service.ts:61:5), then hashes the password before any storage (src/modules/auth/auth.service.ts:64:5). It then propagates the identity to the Septeo Hub by calling the registration API (src/integrations/hub/hub.client.ts:30:3), which triggers a `PATCH /v1/register` on the Keycloak side (src/integrations/hub/hub.client.ts:34:5). On success, the user is persisted locally with its Hub identifier (src/modules/users/users.repository.ts:48:3), a "user registered" event is emitted for subscribers (src/modules/auth/auth.service.ts:78:5), and the controller finally returns a 201 response describing the created account (src/modules/auth/auth.controller.ts:50:5).

Each parenthesised segment is a Ctrl+Click link: the reader jumps straight to the symbol that performs the described action. The link order follows the call-graph's source order — read the branches yourself before asserting a sequence, because the graph cannot tell you which arm of an `if` ran.

---

## Use-case 4 — Report a problem as a GitHub issue

**When**: the tool answers something you can prove is wrong, incomplete, or misleading — a dependent that is missing, a route never flagged, an import the resolver drops, a crash. File it against the tool's own repository, never in the consumer project's tracker.

Repository: **`Septeo-Immobilier/spaghetti-compass`** · [issue tracker](https://github.com/Septeo-Immobilier/spaghetti-compass/issues)

### Before filing — the two-minute reproducibility bar

A report that sends maintainers chasing the wrong cause is worse than no report.

1. **Re-run the exact command** and keep the verbatim output — stdout *and* stderr.
2. **Test the obvious hypothesis — but only where it applies.** For an `explore` defect, a missing
   LSP is the usual suspect: run `spaghetti-compass doctor`, install the LSP, re-run. If the output
   is byte-identical, say so — that control run is the most valuable line in the report. For an
   `impact` defect it is **not** a hypothesis at all: `impact` starts no language server, in any
   language, so installing one cannot change its answer. Reporting an `impact` bug with "gopls was
   missing" sends maintainers down a dead end.
3. **On Go, know which zero you are looking at** (see Use-case 1). A zero on every file of a
   package means nothing in the scanned context imports that package — expected, not a defect.
   Two files of the **same** package disagreeing is the defect shape: that one is worth a report.
4. **Bring the ground truth**, not an impression: a `grep -rn` count, a call-site list, or a second file of the same package that answers differently.

### File it with the `gh` CLI

The template below matches the web form at [`.github/ISSUE_TEMPLATE/bug_report.yml`](https://github.com/Septeo-Immobilier/spaghetti-compass/blob/main/.github/ISSUE_TEMPLATE/bug_report.yml). Fill every field, then create the issue non-interactively.

The example below is a **specimen**, not an open bug: its `Actual output` is a verbatim paste from
the current binary, so copying its shape teaches an output the tool can really produce. Only the
`Expected` section is invented. Replace every field.

````bash
cat > /tmp/sc-issue.md <<'EOF'
## Version
1.1.2

## Command
impact

## Target language / LSP
Go (gopls)

## Was the matching LSP available?
MISS — not found in PATH

Not a factor: `impact` starts no language server, and a control run on a host
with gopls in PATH produced byte-identical output.

## Framework / routing convention
chi router, hexagonal layout, routes under internal/http/**

## How was it run?
Host binary (npm i -g)

## Exact command
```bash
spaghetti-compass impact internal/ports/inbound_repository.go -c .
```

## Actual output
stdout (the route-patterns line is long because it carries all 29 defaults):
```
═════════════════════════════════════════════════════════════════
 🎯 Target: internal/ports/inbound_repository.go:1:1
 📁 Scanned: 1204 files
 📊 Impact: 0 dependent(s), 0 direct, 0 route(s) impacted
 🚪 Route patterns: **/*.controller.ts, **/*.controller.js, **/*.routes.ts, **/*.routes.js, **/*.route.ts, **/*.route.js, **/*.handler.ts, **/*.handler.js, **/app/**/route.ts, **/app/**/route.js, **/app/**/page.tsx, **/app/**/page.jsx, **/server/api/**/*.ts, **/server/routes/**/*.ts, **/+server.ts, **/+page.server.ts, **/routes/**/*.py, **/routers/**/*.py, **/*_router.py, **/views.py, **/*Controller.php, **/cmd/**/main.go, **/*handler.go, **/*handlers.go, **/*routes.go, **/*router.go, **/internal/http/**/*.go, **/internal/handlers/**/*.go, **/internal/server/**/*.go
═════════════════════════════════════════════════════════════════

⚠️  No file in the scanned context imports this package — but Go analysis is package-granular, so this is not a proof that the file is unused.
```
stderr:
```
Note: Go impact analysis is package-granular — every non-test file of the target's package shares the reported dependents. This is a property of Go's import model, not of gopls availability.
```

## Expected output, and the ground truth behind it
Non-zero. `grep -rn "InboundRepository" --include='*.go'` returns 9 invocations
across 6 files, 5 of them production code on the inbound-reception path. The
package IS imported, so the package-granular zero is not merely coarse, it is
wrong: `cmd/api/main.go` carries `import "github.com/acme/app/internal/ports"`
on line 12.

## `spaghetti-compass doctor` output
```
Spaghetti Compass environment

OK   spaghetti-compass    /usr/local/lib/node_modules/@septeo-immo/spaghetti-compass/bin/spaghetti-compass.js
OK   node                 /usr/local/bin/node
OK   TypeScript            bundled
MISS intelephense         install with: npm install -g intelephense
MISS pyright-langserver   install with: npm install -g pyright
MISS gopls                install with: go install golang.org/x/tools/gopls@latest

LSP note: spaghetti-compass starts its own LSP processes when available; it does not reuse VSCode/Cursor LSP sessions.
```

## Repository shape
Go monorepo, one go.mod at the root, apps/backend/ + apps/worker/.
Custom --routes not used; default config/route-patterns.txt.
EOF

gh issue create \
  --repo Septeo-Immobilier/spaghetti-compass \
  --title "[bug] impact reports 0 dependents for a non-first file of a Go package" \
  --label bug \
  --body-file /tmp/sc-issue.md
````

Adjust `--label` to the finding's nature: `bug`, `enhancement`, `documentation`, `question`. `gh` prints the issue URL — hand it back to the user.

**Check for a duplicate first**, and cite it instead of opening a second one:

```bash
gh issue list --repo Septeo-Immobilier/spaghetti-compass --search "go package impact" --state all
```

### What belongs in the consumer repo instead

Never commit the report into the project you were working on — it pollutes a history that has no use for it. Keep a local copy at the repo root if you need one, and exclude it through your global ignore file, not the project's `.gitignore`. Git reads no such file by default, so the path has to be declared once per machine:

```bash
git config --global core.excludesFile ~/.gitignore_global
echo 'spaghetti-compass-*-report.md' >> ~/.gitignore_global
```

---

## Quick reference

**Input formats**

- File only: `path/to/file.ts`
- Function / method: `path/to/file.ts:function` or `path/to/file.ts:ClassName.method`

Supported extensions: `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.py`, `.pyi`, `.php`, `.go`. It does **not** analyze bash, markdown, JSON, YAML.

**Commands**

- `explore <entry>` — forward dependency / call-graph.
- `impact <file>` — reverse impact (files + routes that depend on the target).
- `doctor` — diagnose environment (Node, CLI, LSP tools).

**Useful flags**

- `-c, --context <dir>` — internal directory used for classification.
- `--json` / `-j` — machine output (parse with `jq`).
- `--no-transitive` (explore) — direct dependencies only.
- `-d, --depth <n>` (explore) — call-graph depth (default 5).
- `--same-file-only` (explore) — stay inside the entry file.
- `-t, --tsconfig <path>` — point alias resolution at a specific tsconfig. Its sibling `--no-tsconfig` is **a no-op as of 1.1.2**: Commander files a negated option under its positive key, so the `options.noTsconfig` both commands test is never defined and auto-discovery runs anyway. Move the tsconfig if you really need resolution off.
- `-r, --root <path>` — project root (default: nearest `package.json`; failing that, the tsconfig's directory).
- `-i, --include <glob...>` / `-e, --exclude <glob...>` — scan filters.
- `--routes <glob...>` (impact) — define route patterns (else `config/route-patterns.txt`).
- `--tests <glob...>` (impact) — define what counts as a test file; they leave the blast radius and land in `coveringTests`.
- `--absolute-paths` / `--no-links` — path rendering.
- `--hyperlinks` (explore) — OSC 8 terminal hyperlinks.

**Exit codes — `explore` and `impact`**: `0` success · `1` entry file **or `--tsconfig` file** not found, and also every Commander usage error (unknown option, missing argument) · `2` context directory **or `--root`** not found, or not a directory · `3` any error escaping the command — for `explore`, also an entry that parsed to zero nodes · `4` function not found, `explore` only. Three traps: `4` is checked **before** `3`, so `explore file.ts:fn` yielding zero nodes exits `4`; an empty result is `0` in every language; and a *scanned* file whose parser throws does not raise `3` — `impact` swallows it and drops that file's edges. `doctor` exits `3` if the report throws and `0` otherwise; see above for why it cannot currently return `1`.

**JSON schema — `explore`**: `nodes`, `edges`, `stats.circularDependencies`, `entryPoint`.
**JSON schema — `impact`**: `target`, `targetAbsolute`, `scannedFiles`, `directDependents`, `dependents`, `routes` (each `path`, `absolutePath`, `chain`), `coveringTests`, `routePatterns`, `testPatterns`, `targetIsRoute`, `granularity`, `granularityNote`. All twelve keys, verified against a live `--json` run.
