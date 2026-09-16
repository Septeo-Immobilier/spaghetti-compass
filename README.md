# Spaghetti Compass 🍝🧭

CLI tool to explore and visualize code dependency relations in **TypeScript**, **Python**, **PHP**, and **Go** projects.

## Features

- **Multi-language support**: TypeScript/JavaScript, Python, PHP, and Go
- **Explore file dependencies**: Analyze imports/exports from any entry point (forward analysis)
- **Reverse impact analysis**: From a target file, find every file — and every route/entry point — that depends on it, to know what could break if you change it
- **Context-aware classification**: Define a "context" folder to distinguish internal vs external dependencies
- **Transitive analysis**: See the complete dependency graph, not just direct imports
- **Function-level exploration**: Drill down to specific functions and their call graphs
- **Multiple output formats**: Human-readable tree or JSON for tooling integration
- **Circular dependency detection**: Automatically identifies and reports cycles
- **Clickable navigation**: Output paths are formatted for Ctrl+Click in VSCode/Cursor

## Installation

### From npm

The package is published as **`@septeo-immo/spaghetti-compass`**; the binary it installs is
called `spaghetti-compass`. The unscoped name is not on the registry — always install the
scoped one.

```bash
# Global installation
npm install -g @septeo-immo/spaghetti-compass

# Or use via npx
npx -y @septeo-immo/spaghetti-compass explore src/main.ts
```

`-y` matters outside an interactive terminal. Without it `npx` asks "Ok to proceed?", gets no
TTY in CI or under an agent, abandons the install, falls through to a `PATH` lookup and prints
`sh: 1: spaghetti-compass: not found` **while exiting 0** — a failure that reads as a success.

### From source (local development)

```bash
# Clone the repository
git clone https://github.com/Septeo-Immobilier/spaghetti-compass.git
cd spaghetti-compass

# Install dependencies
npm install

# Build the project
npm run build

# Install globally from local source
npm install -g .

# Or use npm link for development (auto-updates on rebuild)
npm link
```

After local installation, the `spaghetti-compass` command is available globally.

## Quick Start

```bash
# Explore a TypeScript file's dependencies
spaghetti-compass explore src/main.ts

# Explore with a specific context directory
spaghetti-compass explore src/main.ts --context src/

# Output as JSON
spaghetti-compass explore src/main.ts --json

# Show help
spaghetti-compass --help
spaghetti-compass explore --help
```

## Multi-Language Examples

### TypeScript / JavaScript

```bash
# Explore file dependencies
spaghetti-compass explore fixtures/typescript/main.ts

# Explore a specific method (Class.method format)
spaghetti-compass explore fixtures/typescript/services/auth-service.ts:authenticate
```

Output:
```
═════════════════════════════════════════════════════════════════
 📍 Entry Point: fixtures/typescript/services/auth-service.ts:1:1
 📁 Context: /home/user/project
 📊 Stats: 3 internal, 0 external, 0 third-party, 0 unresolved
═════════════════════════════════════════════════════════════════

fixtures/typescript/services/auth-service.ts:1:1
├── 📥 IMPORTS (internal)
│   └── fixtures/typescript/services/user-service.ts:11:9 (getAll)
```

### Python

```bash
# Explore file dependencies (resolves relative imports like .services.user_service)
spaghetti-compass explore fixtures/python/app/main.py
```

Output:
```
═════════════════════════════════════════════════════════════════
 📍 Entry Point: fixtures/python/app/main.py:1:1
 📁 Context: /home/user/project
 📊 Stats: 5 internal, 0 external, 11 third-party, 0 unresolved
═════════════════════════════════════════════════════════════════

fixtures/python/app/main.py:1:1
├── 📥 IMPORTS (internal)
│   ├── fixtures/python/app/services/user_service.py:38:1
│   │   ├── fixtures/python/app/models/user.py:28:1
│   │   └── fixtures/python/app/services/auth_service.py:25:1
│   ├── fixtures/python/app/services/auth_service.py:62:1
│   └── fixtures/python/app/utils/helpers.py:28:1

─────────────────────────────────────────────────────────────────
 🔄 Circular Dependencies Detected:
    fixtures/python/app/services/user_service.py ↔ fixtures/python/app/services/auth_service.py
─────────────────────────────────────────────────────────────────
```

### PHP

```bash
# Explore file dependencies (resolves PSR-4 namespaces via composer.json)
spaghetti-compass explore fixtures/php/src/Services/AuthService.php

# Explore a specific method - resolves $this->method and $obj->method calls
spaghetti-compass explore fixtures/php/src/Services/AuthService.php:login

# PSR-4 project example (Symfony/Laravel style)
spaghetti-compass explore tests/fixtures/php-psr4/src/Services/UserService.php
```

Output (PSR-4 project):
```
═════════════════════════════════════════════════════════════════
 📍 Entry Point: tests/fixtures/php-psr4/src/Services/UserService.php:1:1
 📁 Context: /home/user/project
 📊 Stats: 2 internal, 0 external, 0 third-party, 0 unresolved
═════════════════════════════════════════════════════════════════

tests/fixtures/php-psr4/src/Services/UserService.php:1:1
├── 📥 IMPORTS (internal)
│   └── tests/fixtures/php-psr4/src/Models/User.php:10:1
```

The link points to line 10 where `class User` is defined, not to the `use` statement line.

### Go

Internal imports are resolved through the nearest `go.mod` (module path → local package
directory). Standard-library and external module imports are classified as third-party.
Methods are addressed as `Type.Method`. `gopls` is used for precise navigation when
available, with a graceful file-level fallback when it is not.

```bash
# Explore a Go file's dependencies (resolves module-qualified internal imports)
spaghetti-compass explore fixtures/go/cmd/service/main.go -c fixtures/go

# Explore a method's call graph (receiver methods use the Type.Method form)
spaghetti-compass explore fixtures/go/internal/application/usecases/receive_invoice.go:ReceiveInvoice.Execute -c fixtures/go

# JSON output
spaghetti-compass explore fixtures/go/cmd/service/main.go -c fixtures/go --json

# Reverse impact: who depends on a domain entity?
spaghetti-compass impact fixtures/go/internal/domain/invoice/entity.go -c fixtures/go
```

Internal imports point at the package's `.go` files; stdlib (`context`, `net/http`, …) and
external modules (`github.com/...`) are shown as third-party. `cmd/**/main.go` and `*handler.go`
are treated as routes/entry points by default (see [`config/route-patterns.txt`](config/route-patterns.txt)).

> **Optional `gopls`**: install it (`go install golang.org/x/tools/gopls@latest`) for exact
> symbol positions in multi-file packages. Go results are always package-granular — every
> non-test file of the target's package shares one dependents set — whether or not `gopls`
> is installed. Multi-module repos use the `go.mod` nearest the source file.

## Usage

### Basic file exploration

```bash
# Explore main.ts with src/ as context
spaghetti-compass explore src/main.ts --context src/
```

Output:
```
═════════════════════════════════════════════════════════════════
 📍 Entry Point: main.ts:1:1
 📁 Context: /project/src
 📊 Stats: 12 internal, 3 external, 5 third-party, 0 unresolved
═════════════════════════════════════════════════════════════════

main.ts:1:1
├── 📥 IMPORTS (internal)
│   ├── services/user-service.ts:3:1
│   │   ├── models/user.ts:2:1
│   │   └── utils/validation.ts:4:1
│   └── utils/helpers.ts:5:1
├── 📦 IMPORTS (third-party)
│   ├── lodash:1:1
│   └── express:2:1
└── ⚠️  DYNAMIC IMPORTS (unresolved)
    └── ./plugins/* (line 42)
```

The `path:line:column` format allows Ctrl+Click navigation in VSCode/Cursor terminals.

### Function-level exploration

```bash
# Explore the 'login' function in auth-service.ts
spaghetti-compass explore src/services/auth-service.ts:login --context src/
```

### JSON output

```bash
# Generate JSON for tooling integration
spaghetti-compass explore src/main.ts -c src/ --json > deps.json
```

### Direct dependencies only

```bash
# Skip transitive dependencies
spaghetti-compass explore src/main.ts -c src/ --no-transitive
```

### Filter files

```bash
# Exclude test files
spaghetti-compass explore src/main.ts -c src/ --exclude "**/*.test.ts" --exclude "**/*.spec.ts"
```

### Clickable navigation

By default, file paths are formatted as `path:line:column` which is recognized by VSCode/Cursor terminals and allows Ctrl+Click navigation to the exact line.

```bash
# Default output shows clickable paths
spaghetti-compass explore src/main.ts -c src/
# Output: src/services/user-service.ts:5:1

# Use absolute paths for better compatibility
spaghetti-compass explore src/main.ts -c src/ --absolute-paths
# Output: /project/src/services/user-service.ts:5:1

# Disable line:column format if not needed
spaghetti-compass explore src/main.ts -c src/ --no-links
# Output: src/services/user-service.ts
```

### OSC 8 Hyperlinks (advanced)

```bash
# Enable OSC 8 hyperlinks for terminals that support them
spaghetti-compass explore src/main.ts -c src/ --hyperlinks
```

When hyperlinks are enabled, file paths become clickable links using the OSC 8 escape sequence. This works in terminals that support OSC 8 hyperlinks (iTerm2, Windows Terminal, some Linux terminals).

## LSP Availability and Degraded Mode

`spaghetti-compass` uses a hybrid resolution architecture: TypeScript/JavaScript resolution is bundled (built-in), while PHP, Python, and Go resolution is *enhanced* when an optional external LSP tool is present in your PATH:

- **PHP**: `intelephense` (detect with `npm install -g intelephense`)
- **Python**: `pyright-langserver` (detect with `npm install -g pyright`)
- **Go**: `gopls` (detect with `go install golang.org/x/tools/gopls@latest`)

When an optional LSP is **missing**, `spaghetti-compass` **continues to work** using a parser-only fallback, but **symbol resolution may be less precise**. You will see a warning on stderr letting you know:

```bash
spaghetti-compass explore src/api/handler.php
# Warning: PHP LSP unavailable: `intelephense` was not found in PATH. 
# Continuing with parser fallback; symbol resolution may be less precise.
```

### Diagnose your environment with `doctor`

To see a summary of all available tools and LSPs, run:

```bash
spaghetti-compass doctor

# Output:
# Spaghetti Compass environment
#
# OK   spaghetti-compass    /usr/local/lib/node_modules/@septeo-immo/spaghetti-compass/bin/spaghetti-compass.js
# OK   node                 /usr/local/bin/node
# OK   TypeScript            bundled
# MISS intelephense         install with: npm install -g intelephense
# OK   pyright-langserver   /usr/local/bin/pyright-langserver
# OK   gopls                /Users/me/go/bin/gopls
#
# LSP note: spaghetti-compass starts its own LSP processes when available; 
# it does not reuse VSCode/Cursor LSP sessions.
```

For JSON output (to parse in scripts):

```bash
spaghetti-compass doctor --json
```

**Key points:**

- External LSPs are **optional** — the tool always works, with or without them.
- Missing LSP warnings appear on **stderr only**, never in JSON output on **stdout** (so they don't break tooling or CI).
- Exit codes are unaffected by LSP availability.
- For **maximum precision** on Python, PHP, or Go projects, install the matching LSP.

## Reverse impact analysis (`impact`)

`explore` answers *"what does this file depend on?"* (forward). `impact` answers the opposite,
load-bearing question: *"if I modify this file, **what depends on it** and could break?"* — and in
particular **which routes / entry points** are affected, including ones outside the path you are
currently working on.

```bash
# Which files and routes depend on a shared domain model?
spaghetti-compass impact src/shared/domain/project.model.ts --context src

# Customize what counts as a "route" (--routes REPLACES the 29 defaults from config/route-patterns.txt)
spaghetti-compass impact src/shared/utils/date.ts --context src --routes "**/*.controller.ts" "**/*.route.ts"

# JSON for tooling / CI
spaghetti-compass impact src/shared/domain/project.model.ts --context src --json
```

Output:
```
═════════════════════════════════════════════════════════════════
 🎯 Target: shared/domain/project.model.ts:1:1
 📁 Scanned: 364 files
 📊 Impact: 30 dependent(s), 12 direct, 3 route(s) impacted
 🚪 Route patterns: **/*.controller.ts, **/*.controller.js
═════════════════════════════════════════════════════════════════

🚪 IMPACTED ROUTES (verify these):
├── modules/photo-gallery/infrastructure/http/photo-gallery.controller.ts:1:1
│   ↳ photo-gallery.controller.ts ↳ create-photo.use-case.ts ↳ project.repository.ts ↳ project.model.ts
└── shared/http/projects.controller.ts:1:1
    ↳ projects.controller.ts ↳ create-project-for-user.use-case.ts ↳ project.model.ts
```

Each impacted route is shown with the **shortest dependency chain** from the route down to the
target — so you can see *why* a route is affected. This is the answer to *"I changed file A used by
route R; which **other** routes also go through A and must be re-checked?"*.

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--context <dir>` | `-c` | Directory to scan for dependents | `.` |
| `--routes <glob...>` | | Globs identifying routes / entry points (overrides the config file) | from [`config/route-patterns.txt`](config/route-patterns.txt) |
| `--tests <glob...>` | | Globs identifying test files — kept out of the blast radius, reported as `coveringTests` (replaces the built-in list) | the conventions of the four supported languages |
| `--json` | `-j` | Output as JSON | `false` |
| `--include <glob...>` | `-i` | Files to scan | all supported languages |
| `--exclude <glob...>` | `-e` | Files to skip. **Replaces** the default list, never extends it | `**/node_modules/**`, `**/dist/**`, `**/vendor/**`, `**/.gomodcache/**` — tests are scanned on purpose, then classified |
| `--tsconfig <path>` | `-t` | tsconfig for alias resolution | auto-discover |
| `--root <path>` | `-r` | Project root | auto-discover |
| `--absolute-paths` | | Absolute instead of relative paths | `false` |
| `--no-links` | | Disable `path:line:column` format | |

The JSON output exposes all twelve keys: `target`, `targetAbsolute`, `scannedFiles`,
`directDependents`, `dependents`, `routes` (each with `path`, `absolutePath`, and a `chain` array
from route to target), `coveringTests`, `routePatterns`, `testPatterns`, `targetIsRoute`,
`granularity`, and `granularityNote`.

### Tests are not blast radius — they are coverage

A test file that imports the target is a genuine reverse dependency, but it is not something a
change can *break* in the sense that matters, and counting tests destroys the answer: on one real
Go backend, `impact` reported 120 impacted routes of which **116 were `_test.go` files**. The four
real entry points were buried under them, and the test files sorted first, so the whole first
screen was noise.

So `impact` splits its reverse-dependency set in two:

| Field | Contains | Answers |
|-------|----------|---------|
| `dependents`, `directDependents`, `routes` | production code only | what could break |
| `coveringTests` | test files reaching the target | what already exercises it, so what to re-run |

The split happens **after** the graph is built, never by excluding tests from the scan — an
excluded file cannot be reported. `testPatterns` says how the two were told apart; it defaults to
the conventions of the four supported languages (`**/*_test.go`, `**/*.test.*`, `**/*.spec.*`,
`**/test_*.py`, `**/*Test.php`, `**/tests/**`, …). `--tests <glob...>` replaces that list
entirely for a project that names tests differently.

```bash
# What breaks, and what already covers it
spaghetti-compass impact internal/notify/sender.go -c . --json | jq '{dependents, coveringTests}'
```

### Customizing what counts as a "route"

The default route patterns live in a single, plain-text, heavily-commented file:
**[`config/route-patterns.txt`](config/route-patterns.txt)**. It is read **at runtime**, so you can
add or remove naming conventions by hand — **no rebuild needed**.

- One glob per line; blank lines ignored; anything after `#` is a comment.
- Ships with conventions for NestJS (`*.controller.ts`), Hono/Fastify/Express (`*.routes.ts`,
  `*.handler.ts`), Next.js (`app/**/route.ts`), Nuxt (`server/api/**`), SvelteKit (`+server.ts`),
  Python (`routers/**`, `*_router.py`), PHP (`*Controller.php`) and Go (`cmd/**/main.go`,
  `*handler.go`, `*routes.go`).
- The `--routes` CLI flag overrides the file entirely for a one-off run.

```bash
# uses config/route-patterns.txt
spaghetti-compass impact src/domain/errors/auth.errors.ts -c src

# one-off override, ignores the file
spaghetti-compass impact src/domain/errors/auth.errors.ts -c src --routes "**/*.routes.ts"
```

## Agent skill

An agent skill that teaches an AI assistant (Cursor, Claude, etc.) how and when to use
spaghetti-compass is provided as plain Markdown:

**[`skills/spaghetti-compass/SKILL.md`](skills/spaghetti-compass/SKILL.md)**

It covers four use cases — reverse impact analysis during review (including how to read a
package-granular Go result), efficient dependency exploration, narrating a data flow in natural
language with clickable symbol links, and filing a reproducible bug report as a GitHub issue.

To install it, copy the file into your agent's skill directory, e.g.:

```bash
mkdir -p .claude/skills/spaghetti-compass
cp skills/spaghetti-compass/SKILL.md .claude/skills/spaghetti-compass/
# or .cursor/skills/… , .agents/skills/… depending on your tool
```

## Options (`explore`)

Every row below describes **`explore`**. `impact` has its own flag set and its own, wider
defaults — see [its table](#reverse-impact-analysis-impact). `--depth`, `--same-file-only` and
`--hyperlinks` do not exist on `impact` or `doctor`, which reject them with
`error: unknown option`.

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--context <dir>` | `-c` | Context directory for classification | `.` |
| `--json` | `-j` | Output as JSON | `false` |
| `--include <glob...>` | `-i` | Include patterns | `**/*.ts, **/*.js, **/*.go` — everything else, `.tsx` / `.jsx` / `.py` / `.php` / `.mjs` / `.cjs` included, needs an explicit `-i`. Note `-i` **replaces** the list, it does not add to it |
| `--exclude <glob...>` | `-e` | Exclude patterns | `**/node_modules/**` |
| `--no-transitive` | | Direct dependencies only | `false` |
| `--depth <n>` | `-d` | Max depth of the recursive function call-graph | `5` |
| `--same-file-only` | | Only explore functions declared in the entry file | `false` |
| `--tsconfig <path>` | `-t` | tsconfig used for alias resolution | auto-discover |
| `--no-tsconfig` | | Intended to disable TypeScript alias resolution. **Currently a no-op** on both commands — see below | |
| `--root <path>` | `-r` | Project root | nearest `package.json`; failing that, the tsconfig's directory |
| `--absolute-paths` | | Use absolute paths instead of relative | `false` |
| `--no-links` | | Disable `path:line:column` format | `false` |
| `--hyperlinks` | | Enable OSC 8 hyperlinks (advanced) | `false` |
| `--help` | `-h` | Show help | |
| `--version` | `-v` | Show version | |

> **`--no-tsconfig` does nothing as of 1.1.2.** Commander stores a negated option under its
> *positive* key, so `--no-tsconfig` sets `options.tsconfig` to `false` and never defines the
> `options.noTsconfig` both commands branch on. Alias resolution stays on. To analyze without it,
> move or rename the tsconfig. (`--no-transitive` and `--no-links` are wired correctly and do work.)

## Supported Languages

| Language | File Extensions | Import Resolution | Function-Level |
|----------|----------------|-------------------|----------------|
| TypeScript | `.ts`, `.tsx`, `.js`, `.jsx` | ✅ Full (ESM, CJS, aliases) | ✅ LSP-based |
| Python | `.py`, `.pyi` | ✅ Relative imports (`.module`) | ⚠️ Basic |
| PHP | `.php` | ✅ PSR-4 namespaces + `require_once` | ✅ Method calls |
| Go | `.go` | ✅ `go.mod` module paths (stdlib/external → third-party) | ✅ Functions & `Type.Method` (gopls optional) |

### Go Support

Spaghetti Compass resolves Go internal imports through the nearest `go.mod`, mapping the
module path to local package directories. It works without a Go toolchain installed.

```bash
# "github.com/acme/app/internal/domain" → <moduleRoot>/internal/domain/*.go
spaghetti-compass explore cmd/service/main.go -c .
```

**Features:**
- Nearest-`go.mod` detection, including monorepos with several modules.
- Standard library and external modules (`github.com/...`) classified as third-party.
- Receiver methods addressed as `Type.Method`; `NewX` constructors and selector calls extracted.
- Optional `gopls` for exact symbol positions; clean file-level fallback when absent.
- `vendor/` and `.gomodcache/` are skipped by default; generated files (`*.gen.go`) are **not**
  excluded by default (add `--exclude "**/*.gen.go"` if you want to).

**Known limitations:** the no-`gopls` fallback is deterministic but not a compiler — it does not
perform full interprocedural resolution, so calls dispatched through interfaces or injected
dependencies may not link to a concrete implementation. Install `gopls` for higher precision.
Also, `impact` results for Go targets are package-granular in every case — every non-test file
of the target's package shares one dependents set, regardless of `gopls` availability.

### PHP PSR-4 Support

Spaghetti Compass automatically resolves PHP namespaces using PSR-4 autoloading configuration from `composer.json`:

```bash
# Explore a Symfony/Laravel service
spaghetti-compass explore src/Services/UserService.php

# Links point to class definitions, not use statements
# e.g., "use App\Models\User;" → src/Models/User.php:10 (class User line)
```

**Features:**
- Automatic `composer.json` detection (searches up the directory tree)
- PSR-4 namespace resolution (`App\Models\User` → `src/Models/User.php`)
- Vendor packages classified as "third-party"
- Fallback to Intelephense LSP for complex cases
- Works without LSP (graceful degradation)

## Exit Codes

For `explore` and `impact`. An empty result is a success: `0` dependents exits `0`, in every
language.

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Entry file — or `--tsconfig` file — not found. Commander also exits `1` on a usage error |
| `2` | Context directory — or `--root` — not found, or not a directory |
| `3` | Any error escaping the command; for `explore`, also an entry that parsed to zero nodes |
| `4` | Function not found (`explore` only) |

Three asymmetries worth knowing before scripting against these:

- Code `1` is not only "file missing". Commander rejects an unknown option or a missing argument
  before either command runs — `impact foo.ts --depth 1` exits `1` without touching the filesystem.
- Code `4` wins over `3`. `explore` checks the requested function before it checks for an empty
  graph, so `explore file.ts:fn` that yields zero nodes exits `4`, never `3`.
- Code `3` does **not** cover a *scanned* file with invalid syntax: `impact` catches that parser
  exception, drops the file's edges, and still exits `0`.

`doctor` has its own scale — `3` if the report itself throws, otherwise the value of
`getDoctorExitCode`, which today can only be `0`: both runtime rows are computed from a hard-coded
`true` and from `path.resolve()`, which never fails. Read the `OK` / `MISS` rows, not the exit code.

## Usage by AI Agents

Spaghetti Compass is designed to be easily used by AI agents like **Cursor**, **GitHub Copilot**, and **Claude** for code analysis tasks.

### Quick Commands for Agents

```bash
# Explore file dependencies (JSON output for parsing)
npx -y @septeo-immo/spaghetti-compass explore src/main.ts --json

# Explore a specific function's call graph
npx -y @septeo-immo/spaghetti-compass explore src/services/auth.ts:login --json

# Check for circular dependencies
npx -y @septeo-immo/spaghetti-compass explore src/index.ts --json | jq '.stats.circularDependencies'

# Count impacted files
npx -y @septeo-immo/spaghetti-compass explore src/utils/helper.ts --json | jq '.nodes | length'

# Reverse: which routes depend on a file (impact analysis)
npx -y @septeo-immo/spaghetti-compass impact src/shared/domain/project.model.ts -c src --json | jq '.routes[].path'
```

### JSON Output Schema

The `--json` flag outputs a `DependencyGraph` object:

```typescript
interface DependencyGraph {
  version: string;           // Schema version (e.g., "1.0.0")
  generatedAt: string;       // ISO 8601 timestamp
  context: {
    rootPath: string;        // Analysis root directory
    includePatterns: string[];
    excludePatterns: string[];
  };
  entryPoint: string;        // Entry file path
  nodes: GraphNode[];        // Files, functions, modules
  edges: GraphEdge[];        // Import/call relationships
  stats: {
    totalNodes: number;
    internalNodes: number;   // Files in context
    externalNodes: number;   // Files outside context
    thirdPartyNodes: number; // npm packages
    unresolvedEdges: number; // Dynamic imports
    circularDependencies: string[][]; // Detected cycles
  };
}
```

### Example Agent Prompts

You can ask your AI agent:

- *"Use spaghetti-compass `impact` to tell me which files and routes would be affected if I modify `src/api/routes.ts`"* (reverse analysis)
- *"Use spaghetti-compass `explore` to list what `src/api/routes.ts` depends on"* (forward analysis)
- *"Check if there are any circular dependencies in the `src/` folder using spaghetti-compass"*
- *"Explore the call graph of the `authenticate` function and list all internal function calls"*

### Programmatic Usage

```bash
# Save analysis to file
npx -y @septeo-immo/spaghetti-compass explore src/main.ts --json > deps.json

# Extract specific data with jq
jq '.nodes[] | select(.location == "internal") | .path' deps.json
jq '.edges[] | select(.type == "call")' deps.json
jq '.stats.circularDependencies' deps.json
```

---

## CI/CD Integration

### Check for circular dependencies

```yaml
- name: Check for circular dependencies
  run: |
    npx -y @septeo-immo/spaghetti-compass explore src/index.ts -c src/ --json > deps.json
    CYCLES=$(jq '.stats.circularDependencies | length' deps.json)
    if [ "$CYCLES" -gt "0" ]; then
      echo "❌ Circular dependencies detected!"
      jq '.stats.circularDependencies' deps.json
      exit 1
    fi
```

### Block PRs with new circular dependencies

```yaml
- name: Dependency analysis
  run: |
    npx -y @septeo-immo/spaghetti-compass explore src/index.ts --json > deps.json
    echo "📊 Dependency Stats:"
    jq '.stats' deps.json
    
    # Fail if circular dependencies exist
    if [ "$(jq '.stats.circularDependencies | length' deps.json)" -gt "0" ]; then
      echo "❌ Circular dependencies detected!"
      exit 1
    fi
```

## Publishing

Releases are automatic. A push to `main` runs
[`.github/workflows/release.yml`](.github/workflows/release.yml), which builds, tests, installs
the packed tarball in an isolated directory, then hands the publish to **semantic-release**.
One push is deliberately exempt: semantic-release commits the changelog and the bumped
`package.json` back to `main` with `[skip ci]` in the subject, so its own commit does not
re-trigger the workflow.

The version and the `CHANGELOG.md` entry come from the Conventional Commits in the range, per the
`releaseRules` in [`.releaserc.json`](.releaserc.json): `feat:` bumps the minor, a
`BREAKING CHANGE:` footer the major, and `fix:` / `perf:` / `refactor:` / `docs(README):` the
patch. `chore:`, `style:`, `test:` and any other `docs` scope release nothing. No releasable
commit means no release and no version bump.

**Never publish by hand.** `npm publish` from a workstation skips the changelog, the git tag,
and the provenance attestation, and desynchronizes `main` from the registry.

### Authentication: OIDC trusted publishing, not a token

There is **no `NPM_TOKEN` secret**. The workflow asks GitHub Actions for an `id-token` scoped to
`registry.npmjs.org` and trades it for a short-lived publish token. That requires:

| Requirement | Where |
|-------------|-------|
| `id-token: write` permission | declared in `release.yml` |
| A trusted publisher registered on npmjs | for this repository **and** for the workflow filename `release.yml` |
| npm >= 11.5.1 | supplied by the Node 24 that `setup-node` pins — the workflow pins the Node major, not npm itself |

Provenance comes with trusted publishing by default — hence no `--provenance` flag and no
`NPM_CONFIG_PROVENANCE` anywhere in the workflow.

### Dry run

Trigger the workflow manually (**Actions** → **Release** → **Run workflow**) with **Dry run**
checked: `semantic-release --dry-run` reports the version it would cut and the release notes,
and publishes nothing.

---

## Reporting a problem

Wrong, missing, or misleading result? File it against this repository — never in the tracker of
the project you were analyzing.

**[github.com/Septeo-Immobilier/spaghetti-compass/issues](https://github.com/Septeo-Immobilier/spaghetti-compass/issues)**

### Before filing — the reproducibility bar

A report that sends maintainers chasing the wrong cause is worse than no report.

1. **Re-run the exact command** and keep the verbatim output, stdout *and* stderr.
2. **Test the obvious hypothesis — where it applies.** For an `explore` defect, a missing LSP is
   the usual suspect: run `spaghetti-compass doctor`, install the LSP, re-run. If the output is
   byte-identical, say so — that control run is the most valuable line in the report. For an
   `impact` defect it is not a hypothesis at all: `impact` starts no language server, in any
   language, so installing one cannot change its answer.
3. **On Go, know which zero you are looking at** (see [Go Support](#go-support)). A zero shared by
   every file of a package means nothing in the scanned context imports it — expected. Two files of
   the *same* package disagreeing is the defect shape. Check the `granularity` field either way.
4. **Bring the ground truth**, not an impression: a `grep -rn` count, a call-site list, or a second
   file of the same package that answers differently.

### From the web

Open a new issue and pick **Bug report**. The form
([`.github/ISSUE_TEMPLATE/bug_report.yml`](.github/ISSUE_TEMPLATE/bug_report.yml)) asks for the
version, the command, the **target language and whether its LSP was available**, the
**framework / routing convention**, how the tool was run, the actual output, and the expected one
with its ground truth.

### From the CLI (`gh`)

Same fields, non-interactive — this is the form an agent should use. The example below is a
**specimen**, not an open bug: its `Actual output` is a verbatim paste from
the current binary, so
copying its shape teaches an output the tool can really produce. Only the `Expected` section is
invented. Replace every field.

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

Swap `--label` for the finding's nature: `bug`, `enhancement`, `documentation`, `question`.
Check for a duplicate first and cite it instead of opening a second one:

```bash
gh issue list --repo Septeo-Immobilier/spaghetti-compass --search "go package impact" --state all
```

---

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Lint
npm run lint
```

### Testing with fixtures (Docker)

```bash
# Build first
docker run --rm -v "$(pwd)":/app -w /app node:20 npm run build

# TypeScript - file exploration
docker run --rm -v "$(pwd)":/app -w /app node:20 node bin/spaghetti-compass.js explore fixtures/typescript/main.ts

# TypeScript - function exploration
docker run --rm -v "$(pwd)":/app -w /app node:20 node bin/spaghetti-compass.js explore fixtures/typescript/services/auth-service.ts:authenticate

# Python - file exploration (with circular dependency detection)
docker run --rm -v "$(pwd)":/app -w /app node:20 node bin/spaghetti-compass.js explore fixtures/python/app/main.py

# PHP - function exploration (resolves method calls across files)
docker run --rm -v "$(pwd)":/app -w /app node:20 node bin/spaghetti-compass.js explore fixtures/php/src/Services/AuthService.php:login

# Go - file exploration (resolves module-qualified internal imports via go.mod)
docker run --rm -v "$(pwd)":/app -w /app node:20 node bin/spaghetti-compass.js explore fixtures/go/cmd/service/main.go -c fixtures/go

# Go - method exploration (Type.Method call graph)
docker run --rm -v "$(pwd)":/app -w /app node:20 node bin/spaghetti-compass.js explore fixtures/go/internal/application/usecases/receive_invoice.go:ReceiveInvoice.Execute -c fixtures/go

# JSON output
docker run --rm -v "$(pwd)":/app -w /app node:20 node bin/spaghetti-compass.js explore fixtures/typescript/main.ts --json

# Direct dependencies only
docker run --rm -v "$(pwd)":/app -w /app node:20 node bin/spaghetti-compass.js explore fixtures/typescript/main.ts --no-transitive
```

## License

MIT
