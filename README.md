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

### From npm (when published)

```bash
# Global installation
npm install -g spaghetti-compass

# Or use via npx
npx spaghetti-compass explore <file>
```

### From source (local development)

```bash
# Clone the repository
git clone https://github.com/your-username/spaghetti-compass.git
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
> symbol positions in multi-file packages. Without it, analysis stays file/package-level and
> never fails. Multi-module repos use the `go.mod` nearest the source file.

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
# OK   spaghetti-compass     /usr/local/bin/spaghetti-compass
# OK   node                  /usr/local/bin/node
# OK   TypeScript            bundled
# MISS intelephense          install with: npm install -g intelephense
# OK   pyright-langserver    /usr/local/bin/pyright-langserver
# OK   gopls                 /Users/me/go/bin/gopls
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

# Customize what counts as a "route" (default: **/*.controller.ts, **/*.controller.js)
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
| `--json` | `-j` | Output as JSON | `false` |
| `--include <glob...>` | `-i` | Files to scan | all supported languages |
| `--exclude <glob...>` | `-e` | Files to skip | `**/node_modules/**`, `**/dist/**`, tests |
| `--tsconfig <path>` | `-t` | tsconfig for alias resolution | auto-discover |
| `--root <path>` | `-r` | Project root | auto-discover |
| `--absolute-paths` | | Absolute instead of relative paths | `false` |
| `--no-links` | | Disable `path:line:column` format | |

The JSON output exposes `target`, `scannedFiles`, `directDependents`, `dependents`, and `routes`
(each with a `chain` array from route to target).

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

**[`docs/skills/spaghetti-compass/SKILL.md`](docs/skills/spaghetti-compass/SKILL.md)**

It covers three use cases — reverse impact analysis during review, efficient dependency
exploration, and narrating a data flow in natural language with clickable symbol links.

To install it, copy the file into your agent's skill directory, e.g.:

```bash
mkdir -p .cursor/skills-cursor/spaghetti-compass-exploration
cp docs/skills/spaghetti-compass/SKILL.md .cursor/skills-cursor/spaghetti-compass-exploration/
# or .claude/skills/… , .agents/skills/… depending on your tool
```

## Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--context <dir>` | `-c` | Context directory for classification | `.` |
| `--json` | `-j` | Output as JSON | `false` |
| `--include <glob...>` | `-i` | Include patterns | `**/*.ts, **/*.js, **/*.py, **/*.php, **/*.go` |
| `--exclude <glob...>` | `-e` | Exclude patterns | `**/node_modules/**` |
| `--no-transitive` | | Direct dependencies only | `false` |
| `--absolute-paths` | | Use absolute paths instead of relative | `false` |
| `--no-links` | | Disable `path:line:column` format | `false` |
| `--hyperlinks` | | Enable OSC 8 hyperlinks (advanced) | `false` |
| `--help` | `-h` | Show help | |
| `--version` | `-v` | Show version | |

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

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Entry file not found |
| `2` | Context directory not found |
| `3` | Parse error (invalid syntax) |
| `4` | Function not found |

## Usage by AI Agents

Spaghetti Compass is designed to be easily used by AI agents like **Cursor**, **GitHub Copilot**, and **Claude** for code analysis tasks.

### Quick Commands for Agents

```bash
# Explore file dependencies (JSON output for parsing)
npx spaghetti-compass explore src/main.ts --json

# Explore a specific function's call graph
npx spaghetti-compass explore src/services/auth.ts:login --json

# Check for circular dependencies
npx spaghetti-compass explore src/index.ts --json | jq '.stats.circularDependencies'

# Count impacted files
npx spaghetti-compass explore src/utils/helper.ts --json | jq '.nodes | length'

# Reverse: which routes depend on a file (impact analysis)
npx spaghetti-compass impact src/shared/domain/project.model.ts -c src --json | jq '.routes[].path'
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
npx spaghetti-compass explore src/main.ts --json > deps.json

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
    npx spaghetti-compass explore src/index.ts -c src/ --json > deps.json
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
    npx spaghetti-compass explore src/index.ts --json > deps.json
    echo "📊 Dependency Stats:"
    jq '.stats' deps.json
    
    # Fail if circular dependencies exist
    if [ "$(jq '.stats.circularDependencies | length' deps.json)" -gt "0" ]; then
      echo "❌ Circular dependencies detected!"
      exit 1
    fi
```

## Publishing

### Manual Publishing (npm)

Use GitHub Actions to publish to npm:

1. Go to **Actions** → **Publish to npm**
2. Click **Run workflow**
3. Optionally specify a version (`patch`, `minor`, `major`, or `1.2.3`)
4. **Dry run** is enabled by default - this tests the package without publishing
5. Uncheck **Dry run** to actually publish to npm
6. Click **Run workflow**

The workflow will:
- Build the project
- Run tests
- Create and test the package locally
- Publish to npm (or dry-run)

### Required GitHub Secret

| Secret | Description | How to generate |
|--------|-------------|-----------------|
| `NPM_TOKEN` | npm automation token | `npm token create --type=automation` or [npmjs.com/settings/tokens](https://www.npmjs.com/settings/~/tokens) |

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
