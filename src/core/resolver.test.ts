/**
 * Tests de régression pour PathResolver.
 *
 * Régression principale: les imports relatifs TS/JS (`./x`, `../x`, `./x.js`, extensionless)
 * étaient interceptés par la résolution PHP (isPhpRelativePath teste startsWith('./')/'../')
 * qui ne tente jamais les extensions .ts/.tsx, renvoyant donc `null` à tort.
 * La résolution PHP/Python ne doit s'appliquer qu'aux fichiers source du langage concerné.
 */

import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PathResolver } from './resolver.js';
import type { ContextInfo } from '../types/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

function tsContext(): ContextInfo {
  const root = path.join(repoRoot, 'fixtures/typescript');
  return {
    rootPath: root,
    projectRoot: root,
    includePatterns: ['**/*.ts', '**/*.js'],
    excludePatterns: ['**/node_modules/**'],
  };
}

describe('PathResolver - imports relatifs TS/JS', () => {
  const from = path.join(repoRoot, 'fixtures/typescript/main.ts');

  it('résout un import ESM `.js` vers le fichier source `.ts`', () => {
    const r = new PathResolver(tsContext());
    const resolved = r.resolve('./services/user-service.js', from);
    expect(resolved).toBe(
      path.join(repoRoot, 'fixtures/typescript/services/user-service.ts')
    );
  });

  it('résout un import extensionless vers le fichier `.ts`', () => {
    const r = new PathResolver(tsContext());
    const resolved = r.resolve('./services/user-service', from);
    expect(resolved).toBe(
      path.join(repoRoot, 'fixtures/typescript/services/user-service.ts')
    );
  });

  it('résout un import remontant (`../`) sans extension', () => {
    const r = new PathResolver(tsContext());
    const deepFrom = path.join(repoRoot, 'fixtures/typescript/services/auth-service.ts');
    const resolved = r.resolve('../models/user', deepFrom);
    expect(resolved).toBe(path.join(repoRoot, 'fixtures/typescript/models/user.ts'));
  });

  it('classe un fichier résolu dans le contexte comme `internal`', () => {
    const r = new PathResolver(tsContext());
    const resolved = r.resolve('./services/user-service.js', from);
    expect(r.classifyLocation(resolved, './services/user-service.js')).toBe('internal');
  });
});

describe('PathResolver - PHP non régressé', () => {
  it('résout encore un require relatif PHP (`./x.php`)', () => {
    const root = path.join(repoRoot, 'fixtures/php');
    const ctx: ContextInfo = {
      rootPath: root,
      projectRoot: root,
      includePatterns: ['**/*.php'],
      excludePatterns: ['**/vendor/**'],
    };
    const r = new PathResolver(ctx);
    const from = path.join(repoRoot, 'fixtures/php/src/Services/AuthService.php');
    // helpers.php est inclus via `require_once __DIR__ . '/../Utils/helpers.php'`
    const resolved = r.resolve('/../Utils/helpers.php', from);
    expect(resolved).toBe(path.join(repoRoot, 'fixtures/php/src/Utils/helpers.php'));
  });
});

describe('PathResolver - Go module resolution', () => {
  const goFixtureRoot = path.join(repoRoot, 'fixtures/go');

  function goContext(): ContextInfo {
    return {
      rootPath: goFixtureRoot,
      projectRoot: goFixtureRoot,
      includePatterns: ['**/*.go'],
      excludePatterns: [],
    };
  }

  const fromMain = path.join(goFixtureRoot, 'cmd/service/main.go');
  const fromUsecase = path.join(goFixtureRoot, 'internal/application/usecases/receive_invoice.go');

  it('résout un import interne Go vers un fichier .go représentatif', () => {
    const r = new PathResolver(goContext());
    const resolved = r.resolve('github.com/example/app/internal/domain/invoice', fromUsecase);
    expect(resolved).not.toBeNull();
    expect(resolved).toMatch(/\.go$/);
    expect(resolved).toContain('internal/domain/invoice');
  });

  it('classifie un import interne Go résolu comme `internal`', () => {
    const r = new PathResolver(goContext());
    const resolved = r.resolve('github.com/example/app/internal/domain/invoice', fromUsecase);
    const location = r.classifyLocation(resolved, 'github.com/example/app/internal/domain/invoice', fromUsecase);
    expect(location).toBe('internal');
  });

  it('retourne null pour un import stdlib Go (`context`)', () => {
    const r = new PathResolver(goContext());
    const resolved = r.resolve('context', fromMain);
    expect(resolved).toBeNull();
  });

  it('classifie un import stdlib Go comme `third-party`', () => {
    const r = new PathResolver(goContext());
    const resolved = r.resolve('context', fromMain);
    const location = r.classifyLocation(resolved, 'context', fromMain);
    expect(location).toBe('third-party');
  });

  it('retourne null pour un module tiers Go (`github.com/google/uuid`)', () => {
    const r = new PathResolver(goContext());
    // uuid n'est pas dans fixtures/go, donc resolveImport retourne null
    const resolved = r.resolve('github.com/google/uuid', fromUsecase);
    expect(resolved).toBeNull();
  });

  it('classifie un module tiers Go comme `third-party`', () => {
    const r = new PathResolver(goContext());
    const resolved = r.resolve('github.com/google/uuid', fromUsecase);
    const location = r.classifyLocation(resolved, 'github.com/google/uuid', fromUsecase);
    expect(location).toBe('third-party');
  });

  it('ne classe pas un import Go comme npm package', () => {
    const r = new PathResolver(goContext());
    // Un import Go bare (même avec des points) n'est jamais un package npm
    expect(r.isNpmPackage('github.com/example/app/internal/domain/invoice', fromMain)).toBe(false);
    expect(r.isNpmPackage('context', fromMain)).toBe(false);
  });
});
