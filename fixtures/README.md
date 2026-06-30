# Test Fixtures

This directory contains sample projects for testing spaghetti-compass across different languages.

## Structure

```
fixtures/
├── typescript/    # TypeScript/JavaScript project
├── python/        # Python project
├── php/           # PHP project
└── go/            # Go module
```

## TypeScript Fixture

```bash
# Analyze the main entry point
spaghetti-compass explore fixtures/typescript/main.ts

# Analyze a specific function
spaghetti-compass explore fixtures/typescript/services/auth-service.ts:authenticate
```

## Python Fixture

Requires: **Pyright** (`npm install -g pyright`)

```bash
# Analyze the main entry point
spaghetti-compass explore fixtures/python/app/main.py

# Analyze a specific function
spaghetti-compass explore fixtures/python/app/services/auth_service.py:authenticate
```

## PHP Fixture

Requires: **Intelephense** (`npm install -g intelephense`)

```bash
# Analyze the main entry point
spaghetti-compass explore fixtures/php/src/main.php

# Analyze a specific function
spaghetti-compass explore fixtures/php/src/Services/AuthService.php:login
```

## Go Fixture

Requires: **gopls** (`go install golang.org/x/tools/gopls@latest`) — optional for parse-only mode.

```bash
# Analyze the main entry point
spaghetti-compass explore fixtures/go/cmd/service/main.go -c fixtures/go

# Analyze the Execute method on the ReceiveInvoice use case
spaghetti-compass explore fixtures/go/internal/application/usecases/receive_invoice.go:ReceiveInvoice.Execute -c fixtures/go --json

# Impact analysis from the domain entity
spaghetti-compass impact fixtures/go/internal/domain/invoice/entity.go -c fixtures/go --json
```

## Testing LSP Navigation

Each fixture is designed to test:
1. **Internal dependencies** - imports within the project
2. **Function calls** - method/function invocations
3. **Class instantiation** - object creation
4. **Utility functions** - helper functions imports

The output should include clickable links in the format `path:line:column (symbol)` that navigate to the definition, not the import.
