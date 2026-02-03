"""
Client API externe.
Ce module est HORS du contexte app/ et sert à tester
la détection des dépendances externes au contexte.
"""

from typing import Optional
from urllib.parse import urljoin


class ApiClient:
    """
    Client HTTP simple pour communiquer avec une API externe.
    
    Relations:
    - Utilise urllib.parse (stdlib)
    - Pourrait utiliser requests si installé
    """
    
    def __init__(self, base_url: str, timeout: int = 30):
        """
        Initialise le client API.
        
        Args:
            base_url: URL de base de l'API
            timeout: Timeout en secondes
        """
        self.base_url = base_url.rstrip('/')
        self.timeout = timeout
        self._session_token: Optional[str] = None
    
    def _build_url(self, endpoint: str) -> str:
        """Construit l'URL complète."""
        return urljoin(self.base_url + '/', endpoint.lstrip('/'))
    
    def _get_headers(self) -> dict:
        """Retourne les headers par défaut."""
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        if self._session_token:
            headers["Authorization"] = f"Bearer {self._session_token}"
        return headers
    
    def set_token(self, token: str) -> None:
        """Définit le token d'authentification."""
        self._session_token = token
    
    def get(self, endpoint: str) -> Optional[str]:
        """
        Effectue une requête GET.
        
        Simulation - retourne des données mockées.
        """
        url = self._build_url(endpoint)
        
        # Simulation de réponse
        if "/users/1" in endpoint:
            return '{"id": 1, "name": "John Doe", "email": "john@example.com", "role": "user"}'
        elif "/users" in endpoint:
            return '[{"id": 1, "name": "John Doe", "email": "john@example.com"}]'
        
        return None
    
    def post(self, endpoint: str, data: str) -> Optional[str]:
        """
        Effectue une requête POST.
        
        Simulation - retourne des données mockées.
        """
        url = self._build_url(endpoint)
        
        # Simulation de création réussie
        if "/users" in endpoint:
            return '{"id": 2, "status": "created"}'
        
        return None
    
    def put(self, endpoint: str, data: str) -> Optional[str]:
        """Effectue une requête PUT."""
        return '{"status": "updated"}'
    
    def delete(self, endpoint: str) -> bool:
        """Effectue une requête DELETE."""
        return True
