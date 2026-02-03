# PHP Test Fixture

Mini PHP project for testing spaghetti-compass with Intelephense LSP.

## Requirements

- PHP 8.0+
- Intelephense: `npm install -g intelephense`

## Structure

```
php/
├── composer.json
├── src/
│   ├── main.php           # Entry point
│   ├── Models/
│   │   └── User.php       # User model
│   ├── Services/
│   │   ├── AuthService.php    # Authentication
│   │   └── UserService.php    # User CRUD
│   └── Utils/
│       └── helpers.php    # Utility functions
```

## Test Commands

```bash
# Analyze entry point
spaghetti-compass explore fixtures/php/src/main.php

# Analyze main function
spaghetti-compass explore fixtures/php/src/main.php:main

# Analyze AuthService login
spaghetti-compass explore fixtures/php/src/Services/AuthService.php:login
```

## Expected Results

When analyzing `main.php:main`, you should see dependencies to:
- `User::__construct` (from Models/User.php)
- `AuthService::login` (from Services/AuthService.php)
- `UserService::getAllUsers` (from Services/UserService.php)
- `generateId`, `formatDate` (from Utils/helpers.php)
