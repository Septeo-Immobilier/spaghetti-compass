<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\User;

/**
 * Service for managing users - tests PSR-4 use statement resolution
 */
class UserService
{
    /** @var array<string, User> */
    private array $users = [];

    public function __construct()
    {
        // Initialize with test data
        $this->users['user-001'] = new User(
            'user-001',
            'john@example.com',
            'John Doe'
        );
    }

    /**
     * Get all users
     * @return User[]
     */
    public function getAllUsers(): array
    {
        return array_values($this->users);
    }

    /**
     * Get user by ID
     */
    public function getUserById(string $id): ?User
    {
        return $this->users[$id] ?? null;
    }

    /**
     * Create a new user
     */
    public function createUser(string $id, string $email, string $name): User
    {
        $user = new User($id, $email, $name);
        $this->users[$id] = $user;
        return $user;
    }
}
