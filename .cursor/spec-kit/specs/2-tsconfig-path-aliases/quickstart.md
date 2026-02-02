# Quickstart: TSConfig Path Aliases

**Feature**: 2-tsconfig-path-aliases  
**Date**: 2026-02-02

## Scénario 1: Projet NestJS Standard

### Setup

```
my-nestjs-app/
├── package.json
├── tsconfig.json
└── src/
    ├── main.ts
    └── modules/
        └── users/
            └── users.controller.ts
```

**tsconfig.json**:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

**users.controller.ts**:
```typescript
import { Logger } from '@/core/logger';
import { UserService } from '@/modules/users/user.service';
```

### Commande

```bash
spaghetti-compass explore src/modules/users/users.controller.ts
```

### Résultat attendu

```
═══════════════════════════════════════════════════════════════
 📍 Entry Point: src/modules/users/users.controller.ts
 📁 Context: /home/user/my-nestjs-app
 📊 Stats: 2 internal, 0 external, 0 third-party, 0 unresolved
═══════════════════════════════════════════════════════════════

src/modules/users/users.controller.ts
├── 📦 IMPORTS (internal)
│   ├── src/core/logger.ts (@/core/logger)
│   └── src/modules/users/user.service.ts (@/modules/users/user.service)
```

## Scénario 2: Monorepo avec Plusieurs Packages

### Setup

```
monorepo/
├── package.json
├── packages/
│   ├── backend/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── app.ts
│   └── shared/
│       ├── package.json
│       └── src/
│           └── utils.ts
```

**backend/tsconfig.json**:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@backend/*": ["src/*"],
      "@shared/*": ["../shared/src/*"]
    }
  }
}
```

### Commande

```bash
cd packages/backend
spaghetti-compass explore src/app.ts
```

### Résultat attendu

```
═══════════════════════════════════════════════════════════════
 📍 Entry Point: src/app.ts
 📁 Context: /home/user/monorepo/packages/backend
 📊 Stats: 1 internal, 1 external, 0 third-party, 0 unresolved
═══════════════════════════════════════════════════════════════

src/app.ts
├── 📦 IMPORTS (internal)
│   └── src/services/db.ts (@backend/services/db)
└── 📦 IMPORTS (external)
    └── ../shared/src/utils.ts (@shared/utils)
```

## Scénario 3: TSConfig Personnalisé

### Commande

```bash
spaghetti-compass explore src/app.ts --tsconfig ./tsconfig.app.json
```

## Scénario 4: Override de la Racine Projet

### Commande

```bash
spaghetti-compass explore src/app.ts --root /home/user/monorepo
```

## Scénario 5: Alias Non Résolu (Warning)

### Setup

**tsconfig.json**:
```json
{
  "compilerOptions": {
    "paths": {
      "@missing/*": ["nonexistent/*"]
    }
  }
}
```

**app.ts**:
```typescript
import { something } from '@missing/file';
```

### Résultat attendu

```
═══════════════════════════════════════════════════════════════
 📍 Entry Point: src/app.ts
 📁 Context: /home/user/project
 📊 Stats: 0 internal, 0 external, 0 third-party, 1 unresolved
═══════════════════════════════════════════════════════════════

src/app.ts
└── ⚠️  IMPORTS (unresolved)
    └── @missing/file (alias resolved to nonexistent/file, file not found)
```

## Scénario 6: Différenciation Alias vs Package npm

### Setup

**app.ts**:
```typescript
import { Injectable } from '@nestjs/common';  // npm package
import { Logger } from '@/core/logger';       // project alias
```

### Résultat attendu

```
src/app.ts
├── 📦 IMPORTS (internal)
│   └── src/core/logger.ts (@/core/logger)
└── 📦 IMPORTS (third-party)
    └── @nestjs/common
```

## Integration Tests

Ces scénarios doivent être couverts par des tests d'intégration :

```typescript
// tests/integration/tsconfig-paths.test.ts

describe('TSConfig Path Aliases', () => {
  it('should resolve @/ alias to src/', async () => { /* ... */ });
  it('should classify alias imports as internal', async () => { /* ... */ });
  it('should not confuse @scope/pkg with @alias/', async () => { /* ... */ });
  it('should handle extends in tsconfig', async () => { /* ... */ });
  it('should find nearest package.json in monorepo', async () => { /* ... */ });
  it('should warn on unresolved alias', async () => { /* ... */ });
  it('should respect --tsconfig option', async () => { /* ... */ });
  it('should respect --root option', async () => { /* ... */ });
});
```
