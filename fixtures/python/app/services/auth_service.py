"""
Service d'authentification.
Démontre:
- Relation circulaire avec user_service
- Dépendances stdlib (hashlib)
- Relations internes vers utils
"""

import hashlib
import secrets
from typing import Optional

# Relation INTERNE - vers utils
from ..utils.helpers import log_action

# RELATION CIRCULAIRE avec user_service
# Note: Import différé pour éviter l'erreur d'import circulaire
# Dans une vraie analyse, cette relation doit être détectée


# Stockage en mémoire des tokens (simulation)
_active_tokens: dict[str, int] = {}


def hash_password(password: str) -> str:
    """
    Hash un mot de passe de manière sécurisée.
    
    Relations:
    - Utilise hashlib (stdlib)
    """
    salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    )
    return f"{salt}${hashed.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    """
    Vérifie un mot de passe contre son hash stocké.
    
    Relations:
    - Utilise hashlib (stdlib)
    """
    try:
        salt, hash_value = stored_hash.split('$')
        new_hash = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            100000
        )
        return new_hash.hex() == hash_value
    except ValueError:
        return False


def authenticate(email: str, password: str) -> Optional[str]:
    """
    Authentifie un utilisateur et retourne un token.
    
    Relations:
    - Import différé de user_service (circulaire)
    - Utilise log_action (helpers)
    - Utilise secrets (stdlib)
    """
    # Import différé pour gérer la dépendance circulaire
    from .user_service import get_user
    
    log_action(f"Authentication attempt for {email}")
    
    # Simulation - en vrai on chercherait par email
    user = get_user(user_id=1)
    
    if user and user.email == email:
        # Générer un token
        token = secrets.token_urlsafe(32)
        _active_tokens[token] = user.id
        log_action(f"User {email} authenticated successfully")
        return token
    
    log_action(f"Authentication failed for {email}")
    return None


def verify_token(token: str) -> bool:
    """
    Vérifie si un token est valide.
    
    Relations:
    - Utilise log_action (helpers)
    """
    is_valid = token in _active_tokens
    log_action(f"Token verification: {'valid' if is_valid else 'invalid'}")
    return is_valid


def logout(token: str) -> bool:
    """
    Invalide un token.
    
    Relations:
    - Utilise log_action (helpers)
    """
    if token in _active_tokens:
        del _active_tokens[token]
        log_action("User logged out")
        return True
    return False
