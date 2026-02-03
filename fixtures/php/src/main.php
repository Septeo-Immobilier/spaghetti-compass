<?php
/**
 * Point d'entrée de l'application PHP
 */

declare(strict_types=1);

namespace App;

require_once __DIR__ . '/Models/User.php';
require_once __DIR__ . '/Services/AuthService.php';
require_once __DIR__ . '/Services/UserService.php';
require_once __DIR__ . '/Utils/helpers.php';

use App\Models\User;
use App\Services\AuthService;
use App\Services\UserService;
use function App\Utils\formatDate;
use function App\Utils\generateId;

/**
 * Fonction principale de l'application
 */
function main(): void
{
    $authService = new AuthService();
    $userService = new UserService();

    // Créer un utilisateur
    $user = new User(
        id: generateId(),
        email: 'test@example.com',
        name: 'Test User'
    );

    // Authentifier
    $token = $authService->login($user->getEmail(), 'password123');

    if ($token) {
        echo "User authenticated: " . $user->getName() . "\n";
        echo "Token: " . $token . "\n";
        echo "Created at: " . formatDate($user->getCreatedAt()) . "\n";
    }

    // Récupérer les utilisateurs
    $users = $userService->getAllUsers();
    echo "Total users: " . count($users) . "\n";
}

// Exécuter si appelé directement
if (php_sapi_name() === 'cli') {
    main();
}
