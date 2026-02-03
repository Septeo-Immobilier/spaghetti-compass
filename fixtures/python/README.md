# Python Test Fixture

Mini Python project for testing spaghetti-compass with Pyright LSP.

## Requirements

- Python 3.8+
- Pyright: `npm install -g pyright`

## Structure

```
python/
├── app/
│   ├── __init__.py
│   ├── main.py            # Entry point
│   ├── models/
│   │   ├── __init__.py
│   │   └── user.py        # User model
│   ├── services/
│   │   ├── __init__.py
│   │   ├── auth_service.py    # Authentication
│   │   └── user_service.py    # User CRUD
│   └── utils/
│       ├── __init__.py
│       └── helpers.py     # Utility functions
└── external_module/
    ├── __init__.py
    └── api_client.py      # External API client
```

## Test Commands

```bash
# Analyze entry point
spaghetti-compass explore fixtures/python/app/main.py

# Analyze main function
spaghetti-compass explore fixtures/python/app/main.py:main

# Analyze authenticate function
spaghetti-compass explore fixtures/python/app/services/auth_service.py:authenticate
```

## Expected Results

When analyzing `main.py:main`, you should see dependencies to:
- `User` class (from models/user.py)
- `authenticate` function (from services/auth_service.py)
- `get_user_by_id` function (from services/user_service.py)
- `format_date` function (from utils/helpers.py)
