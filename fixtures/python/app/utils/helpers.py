"""
Fonctions utilitaires diverses.
Démontre:
- Module sans dépendances internes (feuille du graphe)
- Dépendances stdlib uniquement (re, datetime, json)
"""

import re
import json
from datetime import datetime
from typing import Any


# Expression régulière pour validation email
EMAIL_PATTERN = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')


def validate_email(email: str) -> bool:
    """
    Valide le format d'une adresse email.
    
    Relations:
    - Utilise re (stdlib)
    """
    return bool(EMAIL_PATTERN.match(email))


def format_response(data: Any, success: bool = True) -> str:
    """
    Formate une réponse API standardisée.
    
    Relations:
    - Utilise json (stdlib)
    - Utilise datetime (stdlib)
    """
    response = {
        "success": success,
        "timestamp": datetime.now().isoformat(),
        "data": _serialize(data)
    }
    return json.dumps(response, indent=2, default=str)


def _serialize(obj: Any) -> Any:
    """
    Sérialise un objet pour JSON.
    Fonction interne, pas exportée.
    """
    if hasattr(obj, 'to_dict'):
        return obj.to_dict()
    elif hasattr(obj, '__dict__'):
        return obj.__dict__
    return obj


def log_action(message: str, level: str = "INFO") -> None:
    """
    Log une action avec timestamp.
    
    Relations:
    - Utilise datetime (stdlib)
    """
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] [{level}] {message}")


def chunk_list(items: list, chunk_size: int) -> list[list]:
    """
    Divise une liste en chunks de taille donnée.
    Fonction pure sans dépendances.
    """
    return [items[i:i + chunk_size] for i in range(0, len(items), chunk_size)]


def deep_merge(dict1: dict, dict2: dict) -> dict:
    """
    Fusionne deux dictionnaires récursivement.
    Fonction pure sans dépendances.
    """
    result = dict1.copy()
    for key, value in dict2.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    return result
