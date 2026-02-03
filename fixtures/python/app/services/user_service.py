"""
Service de gestion des utilisateurs.
Démontre:
- Relations internes vers models et auth_service
- Relations externes vers external_module
- Dépendances tierces (requests, json)
"""

import json
from typing import Optional

# Dépendance tierce (simulée comme installée)
try:
    import requests
except ImportError:
    requests = None  # Pour permettre l'analyse même sans la lib

# Relation EXTERNE - hors du contexte app/
from external_module.api_client import ApiClient

# Relations INTERNES - dans le contexte app/
from ..models.user import User, UserRole
from .auth_service import hash_password, verify_token


# Singleton du client API externe
_api_client: Optional[ApiClient] = None


def get_api_client() -> ApiClient:
    """Récupère ou crée le client API externe."""
    global _api_client
    if _api_client is None:
        _api_client = ApiClient(base_url="https://api.example.com")
    return _api_client


def get_user(user_id: int) -> Optional[User]:
    """
    Récupère un utilisateur par son ID.
    
    Relations:
    - Utilise ApiClient (externe)
    - Retourne User (models)
    - Utilise json (stdlib)
    """
    client = get_api_client()
    
    try:
        response = client.get(f"/users/{user_id}")
        if response:
            data = json.loads(response)
            return User(
                id=data["id"],
                name=data["name"],
                email=data["email"],
                role=UserRole(data.get("role", "user"))
            )
    except Exception:
        pass
    
    return None


def create_user(name: str, email: str, password: str) -> Optional[User]:
    """
    Crée un nouvel utilisateur.
    
    Relations:
    - Utilise hash_password (auth_service) - relation circulaire potentielle
    - Utilise ApiClient (externe)
    - Crée User (models)
    """
    hashed = hash_password(password)
    client = get_api_client()
    
    payload = json.dumps({
        "name": name,
        "email": email,
        "password_hash": hashed
    })
    
    response = client.post("/users", payload)
    if response:
        data = json.loads(response)
        return User(
            id=data["id"],
            name=name,
            email=email,
            role=UserRole.USER
        )
    
    return None


def list_users(token: str) -> list[User]:
    """
    Liste tous les utilisateurs (nécessite authentification).
    
    Relations:
    - Utilise verify_token (auth_service)
    - Utilise ApiClient (externe)
    """
    if not verify_token(token):
        return []
    
    client = get_api_client()
    response = client.get("/users")
    
    if response:
        data = json.loads(response)
        return [
            User(
                id=u["id"],
                name=u["name"],
                email=u["email"],
                role=UserRole(u.get("role", "user"))
            )
            for u in data
        ]
    
    return []
