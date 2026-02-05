# Spaghetti Compass 🍝🧭

CLI tool to explore and visualize code dependency relations in **TypeScript**, **Python**, and **PHP** projects.

## Features

- **Multi-language support**: TypeScript/JavaScript, Python, and PHP
- **Explore file dependencies**: Analyze imports/exports from any entry point
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
# Explore file dependencies (resolves require_once __DIR__ paths)
spaghetti-compass explore fixtures/php/src/Services/AuthService.php

# Explore a specific method - resolves $this->method and $obj->method calls
spaghetti-compass explore fixtures/php/src/Services/AuthService.php:login
```

Output:
```
═════════════════════════════════════════════════════════════════
 📍 Entry Point: fixtures/php/src/Services/AuthService.php:1:1
 📁 Context: /home/user/project
 📊 Stats: 7 internal, 0 external, 0 third-party, 0 unresolved
═════════════════════════════════════════════════════════════════

fixtures/php/src/Services/AuthService.php:1:1
├── 📥 IMPORTS (internal)
│   ├── fixtures/php/src/Services/AuthService.php:112:1 (findUserByEmail)
│   ├── fixtures/php/src/Models/User.php:68:1 (verifyPassword)
│   ├── fixtures/php/src/Services/AuthService.php:122:1 (generateToken)
│   ├── fixtures/php/src/Models/User.php:38:1 (getId)
│   └── fixtures/php/src/Models/User.php:63:1 (setLastLogin)
```

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

## Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--context <dir>` | `-c` | Context directory for classification | `.` |
| `--json` | `-j` | Output as JSON | `false` |
| `--include <glob...>` | `-i` | Include patterns | `**/*.ts, **/*.js, **/*.py, **/*.php` |
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
| PHP | `.php` | ✅ `require_once __DIR__` | ✅ Method calls |

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

- *"Use spaghetti-compass to analyze the dependencies of `src/api/routes.ts` and tell me which files would be affected if I modify it"*
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

# JSON output
docker run --rm -v "$(pwd)":/app -w /app node:20 node bin/spaghetti-compass.js explore fixtures/typescript/main.ts --json

# Direct dependencies only
docker run --rm -v "$(pwd)":/app -w /app node:20 node bin/spaghetti-compass.js explore fixtures/typescript/main.ts --no-transitive
```

## License

MIT
