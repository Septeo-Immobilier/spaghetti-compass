<?php
/**
 * Service de gestion des utilisateurs
 */

declare(strict_types=1);

namespace App\Services;

require_once __DIR__ . '/../Models/User.php';
require_once __DIR__ . '/../Utils/helpers.php';

use App\Models\User;
use function App\Utils\generateId;
use function App\Utils\formatDate;

/**
 * Gère les opérations CRUD sur les utilisateurs
 */
class UserService
{
    /** @var array<string, User> */
    private array $users = [];

    public function __construct()
    {
        // Données initiales
        $this->users['user-001'] = new User(
            id: 'user-001',
            email: 'john@example.com',
            name: 'John Doe'
        );
        $this->users['user-002'] = new User(
            id: 'user-002',
            email: 'jane@example.com',
            name: 'Jane Smith'
        );
    }

    /**
     * Récupère tous les utilisateurs
     * @return User[]
     */
    public function getAllUsers(): array
    {
        return array_values($this->users);
    }

    /**
     * Récupère un utilisateur par ID
     */
    public function getUserById(string $id): ?User
    {
        return $this->users[$id] ?? null;
    }

    /**
     * Crée un nouvel utilisateur
     */
    public function createUser(string $email, string $name): User
    {
        $id = generateId();
        $user = new User(
            id: $id,
            email: $email,
            name: $name
        );

        $this->users[$id] = $user;
        return $user;
    }

    /**
     * Met à jour un utilisateur
     */
    public function updateUser(string $id, array $data): ?User
    {
        $user = $this->users[$id] ?? null;
        if ($user === null) {
            return null;
        }

        // Note: Dans un vrai projet, on aurait des setters
        // Ici c'est simplifié pour la démo
        return $user;
    }

    /**
     * Supprime un utilisateur
     */
    public function deleteUser(string $id): bool
    {
        if (!isset($this->users[$id])) {
            return false;
        }

        unset($this->users[$id]);
        return true;
    }

    /**
     * Recherche des utilisateurs par nom
     * @return User[]
     */
    public function searchByName(string $query): array
    {
        $results = [];
        $query = strtolower($query);

        foreach ($this->users as $user) {
            if (str_contains(strtolower($user->getName()), $query)) {
                $results[] = $user;
            }
        }

        return $results;
    }

    /**
     * Formate les informations d'un utilisateur pour l'affichage
     */
    public function formatUserInfo(User $user): string
    {
        return sprintf(
            "%s (%s) - Created: %s",
            $user->getName(),
            $user->getEmail(),
            formatDate($user->getCreatedAt())
        );
    }
}
