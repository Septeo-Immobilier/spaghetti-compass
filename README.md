# Spaghetti Compass 🍝🧭

CLI tool to explore and visualize code dependency relations in JavaScript/TypeScript projects.

## Features

- **Explore file dependencies**: Analyze imports/exports from any entry point
- **Context-aware classification**: Define a "context" folder to distinguish internal vs external dependencies
- **Transitive analysis**: See the complete dependency graph, not just direct imports
- **Function-level exploration**: Drill down to specific functions and their call graphs
- **Multiple output formats**: Human-readable tree or JSON for tooling integration
- **Circular dependency detection**: Automatically identifies and reports cycles

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
# Explore a file's dependencies
spaghetti-compass explore src/main.ts

# Explore with a specific context directory
spaghetti-compass explore src/main.ts --context src/

# Output as JSON
spaghetti-compass explore src/main.ts --json

# Show help
spaghetti-compass --help
spaghetti-compass explore --help
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
 📍 Entry Point: main.ts
 📁 Context: /project/src
 📊 Stats: 12 internal, 3 external, 5 third-party, 0 unresolved
═════════════════════════════════════════════════════════════════

main.ts
├── 📥 IMPORTS (internal)
│   ├── services/user-service.ts
│   │   ├── models/user.ts
│   │   └── utils/validation.ts
│   └── utils/helpers.ts
├── 📦 IMPORTS (third-party)
│   ├── lodash
│   └── express
└── ⚠️  DYNAMIC IMPORTS (unresolved)
    └── ./plugins/* (line 42)
```

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

## Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--context <dir>` | `-c` | Context directory for classification | `.` |
| `--json` | `-j` | Output as JSON | `false` |
| `--include <glob...>` | `-i` | Include patterns | `**/*.ts, **/*.js` |
| `--exclude <glob...>` | `-e` | Exclude patterns | `**/node_modules/**` |
| `--no-transitive` | | Direct dependencies only | `false` |
| `--help` | `-h` | Show help | |
| `--version` | `-v` | Show version | |

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Entry file not found |
| `2` | Context directory not found |
| `3` | Parse error (invalid syntax) |
| `4` | Function not found |

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

# Basic exploration
docker run --rm -v "$(pwd)":/app -w /app node:20 node dist/cli/index.js explore fixtures/ts-app/main.ts -c fixtures/ts-app/

# JSON output
docker run --rm -v "$(pwd)":/app -w /app node:20 node dist/cli/index.js explore fixtures/ts-app/main.ts -c fixtures/ts-app/ --json

# Function exploration
docker run --rm -v "$(pwd)":/app -w /app node:20 node dist/cli/index.js explore "fixtures/ts-app/main.ts:main" -c fixtures/ts-app/

# Direct dependencies only
docker run --rm -v "$(pwd)":/app -w /app node:20 node dist/cli/index.js explore fixtures/ts-app/main.ts -c fixtures/ts-app/ --no-transitive
```

## License

MIT
