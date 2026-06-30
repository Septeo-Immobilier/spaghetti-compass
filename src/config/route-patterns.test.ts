/**
 * Tests pour le chargement des patterns de routes par défaut.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import {
  parseRoutePatterns,
  loadDefaultRoutePatterns,
  ROUTE_PATTERNS_FILE,
} from './route-patterns.js';

describe('parseRoutePatterns', () => {
  it('ignore les lignes vides et les commentaires (pleine ligne et fin de ligne)', () => {
    const content = [
      '# commentaire',
      '',
      '   ',
      '**/*.controller.ts',
      '**/*.routes.ts   # routes Hono/Fastify',
      '   **/*.handler.ts',
    ].join('\n');

    expect(parseRoutePatterns(content)).toEqual([
      '**/*.controller.ts',
      '**/*.routes.ts',
      '**/*.handler.ts',
    ]);
  });

  it('retourne une liste vide pour un contenu uniquement commenté', () => {
    expect(parseRoutePatterns('# rien que des commentaires\n#encore')).toEqual([]);
  });
});

describe('loadDefaultRoutePatterns', () => {
  it('lit le fichier de config livré avec le package', () => {
    expect(fs.existsSync(ROUTE_PATTERNS_FILE)).toBe(true);
    const patterns = loadDefaultRoutePatterns();
    // Conventions clés attendues dans le fichier livré.
    expect(patterns).toContain('**/*.controller.ts'); // NestJS
    expect(patterns).toContain('**/*.routes.ts'); // Hono / Fastify / Express
    expect(patterns).toContain('**/*.handler.ts'); // handlers Hono / Lambda
  });

  it('retombe sur le fallback si le fichier est introuvable', () => {
    const patterns = loadDefaultRoutePatterns('/chemin/inexistant/route-patterns.txt');
    expect(patterns).toEqual(['**/*.controller.ts', '**/*.controller.js']);
  });
});
