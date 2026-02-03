# TypeScript Test Fixture

Mini TypeScript project for testing spaghetti-compass with TypeScript LSP.

## Requirements

- Node.js 20+
- TypeScript (included in project dependencies)

## Structure

```
typescript/
├── main.ts                # Entry point
├── models/
│   └── user.ts            # User model
├── services/
│   ├── auth-service.ts    # Authentication
│   └── user-service.ts    # User CRUD
└── utils/
    └── helpers.ts         # Utility functions
```

## Test Commands

```bash
# Analyze entry point
spaghetti-compass explore fixtures/typescript/main.ts

# Analyze main function
spaghetti-compass explore fixtures/typescript/main.ts:main

# Analyze authenticate function
spaghetti-compass explore fixtures/typescript/services/auth-service.ts:authenticate
```

## Expected Results

When analyzing `main.ts:main`, you should see dependencies to:
- `User` class (from models/user.ts)
- `authenticate` function (from services/auth-service.ts)
- `getUserById` function (from services/user-service.ts)
- `formatDate` function (from utils/helpers.ts)
