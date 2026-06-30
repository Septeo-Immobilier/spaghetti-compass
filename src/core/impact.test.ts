/**
 * Tests pour l'analyse d'impact inverse (ImpactAnalyzer).
 *
 * Graphe des fixtures TypeScript:
 *   main.ts          -> user-service, auth-service, helpers
 *   user-service.ts  -> models/user, helpers
 *   auth-service.ts  -> models/user, user-service
 */

import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ImpactAnalyzer } from './impact.js';
import type { ContextInfo } from '../types/index.js';

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
});
