<?php
/**
 * Modèle User
 */

declare(strict_types=1);

namespace App\Models;

use DateTime;

/**
 * Représente un utilisateur du système
 */
class User
{
    private string $id;
    private string $email;
    private string $name;
    private ?string $passwordHash;
    private DateTime $createdAt;
    private ?DateTime $lastLogin;

    public function __construct(
        string $id,
        string $email,
        string $name,
        ?string $passwordHash = null
    ) {
        $this->id = $id;
        $this->email = $email;
        $this->name = $name;
        $this->passwordHash = $passwordHash;
        $this->createdAt = new DateTime();
        $this->lastLogin = null;
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function getEmail(): string
    {
        return $this->email;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getCreatedAt(): DateTime
    {
        return $this->createdAt;
    }

    public function getLastLogin(): ?DateTime
    {
        return $this->lastLogin;
    }

    public function setLastLogin(DateTime $lastLogin): void
    {
        $this->lastLogin = $lastLogin;
    }

    public function verifyPassword(string $password): bool
    {
        if ($this->passwordHash === null) {
            return false;
        }
        return password_verify($password, $this->passwordHash);
    }

    public function setPassword(string $password): void
    {
        $this->passwordHash = password_hash($password, PASSWORD_DEFAULT);
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'email' => $this->email,
            'name' => $this->name,
            'createdAt' => $this->createdAt->format('c'),
            'lastLogin' => $this->lastLogin?->format('c'),
        ];
    }
}
