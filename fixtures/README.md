# Fixtures pour Code Relations Explorer

Ce dossier contient du code de test pour valider la fonctionnalité d'exploration des relations de code.

## Structure

```
fixtures/
├── app/                    # Module principal (contexte suggéré)
│   ├── __init__.py
│   ├── main.py            # Point d'entrée, importe services et utils
│   ├── services/
│   │   ├── __init__.py
│   │   ├── user_service.py    # Utilise models et external libs
│   │   └── auth_service.py    # Relation circulaire avec user_service
│   ├── models/
│   │   ├── __init__.py
│   │   └── user.py            # Modèle de données
│   └── utils/
│       ├── __init__.py
│       └── helpers.py         # Fonctions utilitaires
├── external_module/        # Module externe (hors du contexte app/)
│   ├── __init__.py
│   └── api_client.py      # Référencé depuis app/
└── README.md
```

## Relations à détecter

### Relations Internes (dans app/)
- `main.py` → `services/user_service.py`
- `main.py` → `utils/helpers.py`
- `services/user_service.py` → `models/user.py`
- `services/user_service.py` ↔ `services/auth_service.py` (circulaire)
- `services/auth_service.py` → `utils/helpers.py`

### Relations Externes (hors app/)
- `services/user_service.py` → `external_module/api_client.py`
- `services/user_service.py` → `json` (stdlib)
- `services/auth_service.py` → `hashlib` (stdlib)
- `models/user.py` → `dataclasses` (stdlib)

### Dépendances Tierces (simulées)
- `requests` (dans user_service.py)
- `pydantic` (dans models/user.py)

## Cas de test

1. **Fichier `app/main.py` avec contexte `app/`** → devrait montrer relations internes vers services et utils
2. **Fichier `app/services/user_service.py` avec contexte `app/`** → devrait montrer external_module comme externe
3. **Fonction `get_user()` dans user_service.py** → devrait montrer appels vers auth_service et models
4. **Contexte changé de `app/` à `app/services/`** → models/ devient externe
