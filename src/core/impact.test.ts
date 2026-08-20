/**
 * Tests pour l'analyse d'impact inverse (ImpactAnalyzer).
 *
 * Graphe des fixtures TypeScript:
 *   main.ts          -> user-service, auth-service, helpers
 *   user-service.ts  -> models/user, helpers
 *   auth-service.ts  -> models/user, user-service
 */

import { describe, it, expect, vi } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
import { ImpactAnalyzer } from './impact.js';
import type { ContextInfo } from '../types/index.js';

// `node:fs`'s ESM namespace is not configurable, so `vi.spyOn(fs, ...)`
// cannot patch it directly; `vi.mock` with `importOriginal` replaces the
// module for the whole graph (including impact.ts's own `import * as fs`)
// while every other export keeps its real implementation.
const mockReaddirSyncHolder = vi.hoisted(() => {
  let original: typeof fs.readdirSync | undefined;
  return {
    set: (fn: typeof fs.readdirSync) => {
      original = fn;
    },
    get: (): typeof fs.readdirSync => original!,
  };
});
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  mockReaddirSyncHolder.set(actual.readdirSync);
  return { ...actual, readdirSync: vi.fn(actual.readdirSync) };
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const fixtures = path.join(repoRoot, 'fixtures/typescript');

function ctx(): ContextInfo {
  return {
    rootPath: fixtures,
    projectRoot: fixtures,
    includePatterns: ['**/*.ts', '**/*.js'],
    excludePatterns: ['**/node_modules/**'],
  };
}

describe('ImpactAnalyzer', () => {
  it('remonte tous les dépendants transitifs d\'un fichier cible', () => {
    const analyzer = new ImpactAnalyzer(ctx());
    const result = analyzer.analyze(path.join(fixtures, 'models/user.ts'), {
      routePatterns: ['**/main.ts'],
    });

    expect(result.dependents).toContain('services/user-service.ts');
    expect(result.dependents).toContain('services/auth-service.ts');
    expect(result.dependents).toContain('main.ts');
  });

  it('distingue les dépendants directs des transitifs', () => {
    const analyzer = new ImpactAnalyzer(ctx());
    const result = analyzer.analyze(path.join(fixtures, 'models/user.ts'), {
      routePatterns: ['**/main.ts'],
    });

    // user-service et auth-service importent user.ts directement, pas main.ts.
    expect(result.directDependents).toContain('services/user-service.ts');
    expect(result.directDependents).toContain('services/auth-service.ts');
    expect(result.directDependents).not.toContain('main.ts');
  });

  it('identifie les routes impactées et leur chaîne vers la cible', () => {
    const analyzer = new ImpactAnalyzer(ctx());
    const result = analyzer.analyze(path.join(fixtures, 'models/user.ts'), {
      routePatterns: ['**/main.ts'],
    });

    expect(result.routes).toHaveLength(1);
    const route = result.routes[0];
    expect(route.path).toBe('main.ts');
    // La chaîne va de la route (premier) à la cible (dernier).
    expect(route.chain[0]).toBe('main.ts');
    expect(route.chain[route.chain.length - 1]).toBe('models/user.ts');
  });

  it('retourne 0 dépendant pour un fichier feuille importé par personne', () => {
    const analyzer = new ImpactAnalyzer(ctx());
    // main.ts est un point d'entrée: rien ne l'importe.
    const result = analyzer.analyze(path.join(fixtures, 'main.ts'), {
      routePatterns: ['**/*.controller.ts'],
    });

    expect(result.dependents).toHaveLength(0);
    expect(result.routes).toHaveLength(0);
  });

  it('signale quand la cible elle-même est une route', () => {
    const analyzer = new ImpactAnalyzer(ctx());
    const result = analyzer.analyze(path.join(fixtures, 'main.ts'), {
      routePatterns: ['**/main.ts'],
    });
    expect(result.targetIsRoute).toBe(true);
  });

  it('carries granularity "file" and a null note for a TypeScript target', () => {
    const analyzer = new ImpactAnalyzer(ctx());
    const result = analyzer.analyze(path.join(fixtures, 'models/user.ts'), {
      routePatterns: ['**/main.ts'],
    });

    expect(result.granularity).toBe('file');
    expect(result.granularityNote).toBeNull();
  });

  it('carries granularity "file" for a Python target', () => {
    const pythonFixtures = path.join(repoRoot, 'fixtures/python');
    const analyzer = new ImpactAnalyzer({
      rootPath: pythonFixtures,
      projectRoot: pythonFixtures,
      includePatterns: ['**/*.py'],
      excludePatterns: [],
    });
    const result = analyzer.analyze(path.join(pythonFixtures, 'app/models/user.py'), {
      routePatterns: ['**/main.py'],
    });

    expect(result.granularity).toBe('file');
  });

  it('carries granularity "file" for a PHP target', () => {
    const phpFixtures = path.join(repoRoot, 'fixtures/php');
    const analyzer = new ImpactAnalyzer({
      rootPath: phpFixtures,
      projectRoot: phpFixtures,
      includePatterns: ['**/*.php'],
      excludePatterns: ['**/vendor/**'],
    });
    const result = analyzer.analyze(path.join(phpFixtures, 'src/Models/User.php'), {
      routePatterns: ['**/main.php'],
    });

    expect(result.granularity).toBe('file');
  });
});

describe('ImpactAnalyzer — routes[].chain determinism (H1)', () => {
  function writeGoFile(filePath: string, content: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  it('picks the same intermediate hop in routes[0].chain regardless of readdir order', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'impact-chain-'));
    try {
      // pkg/mid has two files that both import pkg/leaf directly; main.go
      // imports the package pkg/mid as a whole, so it depends on both via
      // Go's package-granularity resolution. This makes the BFS parent of
      // main.go ambiguous between aaa.go and zzz.go unless `collectFiles`
      // orders `files` deterministically before the reverse graph is built.
      writeGoFile(
        path.join(tmpRoot, 'go.mod'),
        'module github.com/example/chaintest\n\ngo 1.25\n',
      );
      writeGoFile(
        path.join(tmpRoot, 'pkg', 'leaf', 'leaf.go'),
        'package leaf\n\nfunc Leaf() {}\n',
      );
      writeGoFile(
        path.join(tmpRoot, 'pkg', 'mid', 'aaa.go'),
        'package mid\n\nimport "github.com/example/chaintest/pkg/leaf"\n\nfunc Aaa() { leaf.Leaf() }\n',
      );
      writeGoFile(
        path.join(tmpRoot, 'pkg', 'mid', 'zzz.go'),
        'package mid\n\nimport "github.com/example/chaintest/pkg/leaf"\n\nfunc Zzz() { leaf.Leaf() }\n',
      );
      writeGoFile(
        path.join(tmpRoot, 'cmd', 'app', 'main.go'),
        'package main\n\nimport "github.com/example/chaintest/pkg/mid"\n\nfunc main() { mid.Aaa() }\n',
      );

      const context: ContextInfo = {
        rootPath: tmpRoot,
        projectRoot: tmpRoot,
        includePatterns: ['**/*.go'],
        excludePatterns: [],
      };
      const leafGo = path.join(tmpRoot, 'pkg', 'leaf', 'leaf.go');
      const analyze = () =>
        new ImpactAnalyzer(context).analyze(leafGo, { routePatterns: ['**/main.go'] });

      const natural = analyze();

      // Force the opposite of whatever order the real filesystem happens to
      // return, so the assertion does not depend on a given OS/filesystem's
      // readdir order (ext4 returns hash order; this repo's CI and a
      // developer's machine are not guaranteed to agree).
      const originalReaddirSync = mockReaddirSyncHolder.get();
      const readdirMock = vi.mocked(fs.readdirSync);
      readdirMock.mockImplementation(
        ((dir: fs.PathLike, options: fs.ObjectEncodingOptions & { withFileTypes: true }) => {
          const entries = originalReaddirSync(dir, options) as fs.Dirent[];
          return [...entries].reverse();
        }) as typeof fs.readdirSync,
      );

      let reversed: ReturnType<typeof analyze>;
      try {
        reversed = analyze();
      } finally {
        readdirMock.mockImplementation(originalReaddirSync);
      }

      expect(natural.routes).toHaveLength(1);
      expect(reversed.routes).toHaveLength(1);
      expect(reversed.routes[0].chain).toEqual(natural.routes[0].chain);
      expect(natural.routes[0].chain).toEqual([
        'cmd/app/main.go',
        'pkg/mid/aaa.go',
        'pkg/leaf/leaf.go',
      ]);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
