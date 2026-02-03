"""
Modèle utilisateur.
Démontre:
- Dépendances stdlib (dataclasses, enum)
- Dépendances tierces optionnelles (pydantic)
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

# Dépendance tierce optionnelle
try:
    from pydantic import BaseModel, EmailStr
    PYDANTIC_AVAILABLE = True
except ImportError:
    PYDANTIC_AVAILABLE = False


class UserRole(Enum):
    """Rôles possibles pour un utilisateur."""
    ADMIN = "admin"
    USER = "user"
    GUEST = "guest"


@dataclass
class User:
    """
    Représentation d'un utilisateur.
    
    Relations:
    - Utilise dataclasses (stdlib)
    - Utilise UserRole (même fichier)
    """
    id: int
    name: str
    email: str
    role: UserRole = field(default=UserRole.USER)
    is_active: bool = field(default=True)
    metadata: Optional[dict] = field(default=None)
    
    def __post_init__(self):
        """Validation après initialisation."""
        if not self.email or "@" not in self.email:
            raise ValueError("Invalid email format")
    
    def has_permission(self, permission: str) -> bool:
        """
        Vérifie si l'utilisateur a une permission donnée.
        
        Relations:
        - Utilise UserRole
        """
        admin_permissions = {"read", "write", "delete", "admin"}
        user_permissions = {"read", "write"}
        guest_permissions = {"read"}
        
        if self.role == UserRole.ADMIN:
            return permission in admin_permissions
        elif self.role == UserRole.USER:
            return permission in user_permissions
        else:
            return permission in guest_permissions
    
    def to_dict(self) -> dict:
        """Convertit l'utilisateur en dictionnaire."""
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role.value,
            "is_active": self.is_active
        }


# Version Pydantic si disponible
if PYDANTIC_AVAILABLE:
    class UserPydantic(BaseModel):
        """Version Pydantic du modèle User."""
        id: int
        name: str
        email: EmailStr
        role: str = "user"
        is_active: bool = True
