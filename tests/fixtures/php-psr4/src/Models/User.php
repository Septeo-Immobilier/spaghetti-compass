<?php

declare(strict_types=1);

namespace App\Models;

/**
 * User entity for testing PSR-4 resolution
 */
class User
{
    private string $id;
    private string $email;
    private string $name;

    public function __construct(string $id, string $email, string $name)
    {
        $this->id = $id;
        $this->email = $email;
        $this->name = $name;
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
}
