"""
Point d'entrée principal de l'application.
Démontre les relations vers services et utils.
"""

from .services.user_service import get_user, create_user
from .services.auth_service import authenticate
from .utils.helpers import format_response, log_action


def run_app():
    """
    Fonction principale qui orchestre l'application.
    Relations:
    - Appelle get_user (user_service)
    - Appelle authenticate (auth_service)
    - Appelle format_response, log_action (helpers)
    """
    log_action("Application started")
    
    # Exemple de workflow
    user = get_user(user_id=1)
    if user:
        auth_result = authenticate(user.email, "password123")
        response = format_response({"user": user, "authenticated": auth_result})
        log_action(f"User {user.name} processed")
        return response
    
    return format_response({"error": "User not found"})


def health_check():
    """Simple health check sans dépendances."""
    return {"status": "ok"}


if __name__ == "__main__":
    result = run_app()
    print(result)
