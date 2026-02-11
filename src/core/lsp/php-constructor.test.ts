/**
 * Tests pour findPhpConstructorLine (spec 002 - ciblage constructeur)
 */

import { describe, it, expect } from 'vitest';
import { findPhpConstructorLine } from './php-constructor.js';

describe('findPhpConstructorLine', () => {
  it('retourne la ligne de __construct pour une classe PHP', () => {
    const content = `<?php
namespace App\\Services;

class AuthService
{
    private array $users = [];

    public function __construct()
    {
        $this->users = [];
    }

    public function login(): void {}
}
`;
    expect(findPhpConstructorLine(content, 'AuthService')).toBe(10);
  });

  it('retourne null pour une interface (pas de constructeur)', () => {
    const content = `<?php
interface AuthServiceInterface
{
    public function login(): void;
}
`;
    expect(findPhpConstructorLine(content, 'AuthServiceInterface')).toBeNull();
  });

  it('retourne la ligne du constructeur quand class et { sur la même ligne', () => {
    const content = `<?php
class Foo {
    public function __construct() {}
}
`;
    expect(findPhpConstructorLine(content, 'Foo')).toBe(3);
  });

  it('retourne null si la classe n a pas de constructeur explicite', () => {
    const content = `<?php
class Bar {
    public function doSomething(): void {}
}
`;
    expect(findPhpConstructorLine(content, 'Bar')).toBeNull();
  });
});
