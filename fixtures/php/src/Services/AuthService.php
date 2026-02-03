<?php
/**
 * Service d'authentification
 */

declare(strict_types=1);

namespace App\Services;

require_once __DIR__ . '/../Models/User.php';
require_once __DIR__ . '/../Utils/helpers.php';

use App\Models\User;
use DateTime;
use function App\Utils\generateId;

/**
 * Gère l'authentification des utilisateurs
 */
class AuthService
{
    /** @var array<string, User> */
    private array $users = [];

    /** @var array<string, string> Token -> User ID */
    private array $sessions = [];

    public function __construct()
    {
        // Créer un utilisateur de test
        $testUser = new User(
            id: 'user-001',
            email: 'admin@example.com',
            name: 'Admin User'
        );
        $testUser->setPassword('admin123');
        $this->users[$testUser->getId()] = $testUser;
    }

    /**
     * Authentifie un utilisateur avec email et mot de passe
     */
    public function login(string $email, string $password): ?string
    {
        $user = $this->findUserByEmail($email);

        if ($user === null) {
            return null;
        }

        if (!$user->verifyPassword($password)) {
            return null;
        }

        // Créer une session
        $token = $this->generateToken();
        $this->sessions[$token] = $user->getId();

        // Mettre à jour le dernier login
        $user->setLastLogin(new DateTime());

        return $token;
    }

    /**
     * Déconnecte un utilisateur
     */
    public function logout(string $token): bool
    {
        if (!isset($this->sessions[$token])) {
            return false;
        }

        unset($this->sessions[$token]);
        return true;
    }

    /**
     * Vérifie si un token est valide
     */
    public function validateToken(string $token): ?User
    {
        if (!isset($this->sessions[$token])) {
            return null;
        }

        $userId = $this->sessions[$token];
        return $this->users[$userId] ?? null;
    }

    /**
     * Enregistre un nouvel utilisateur
     */
    public function register(string $email, string $password, string $name): ?User
    {
        // Vérifier si l'email existe déjà
        if ($this->findUserByEmail($email) !== null) {
            return null;
        }

        $user = new User(
            id: generateId(),
            email: $email,
            name: $name
        );
        $user->setPassword($password);

        $this->users[$user->getId()] = $user;
        return $user;
    }

    private function findUserByEmail(string $email): ?User
    {
        foreach ($this->users as $user) {
            if ($user->getEmail() === $email) {
                return $user;
            }
        }
        return null;
    }

    private function generateToken(): string
    {
        return bin2hex(random_bytes(32));
    }
}
