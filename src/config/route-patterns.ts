/**
 * Chargement des patterns de routes par défaut.
 *
 * La source de vérité est le fichier texte `config/route-patterns.txt` à la racine
 * du package. Il est lu À L'EXÉCUTION (pas embarqué à la compilation), pour qu'on
 * puisse l'éditer à la main sans recompiler. Le flag CLI `--routes` reste prioritaire.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Chemin du fichier de configuration des routes.
 * Compilé, ce module vit dans `dist/config/`, donc la racine du package est `../../`.
 */
export const ROUTE_PATTERNS_FILE = path.resolve(__dirname, '../../config/route-patterns.txt');

/**
 * Filet de sécurité si le fichier de config est introuvable (package corrompu, etc.).
 * Volontairement minimal : la vraie liste vit dans config/route-patterns.txt.
 */
const FALLBACK_ROUTE_PATTERNS = ['**/*.controller.ts', '**/*.controller.js'];

/**
 * Parse le contenu du fichier de patterns.
 * - une ligne = un glob
 * - lignes vides ignorées
 * - tout ce qui suit un `#` est un commentaire (les globs ne contiennent jamais de `#`)
 */
export function parseRoutePatterns(content: string): string[] {
  return content
    .split('\n')
    .map((line) => {
      const hashIndex = line.indexOf('#');
      const withoutComment = hashIndex === -1 ? line : line.slice(0, hashIndex);
      return withoutComment.trim();
    })
    .filter((line) => line.length > 0);
}

/**
 * Lit et parse les patterns de routes par défaut depuis le fichier de config.
 * Retombe sur FALLBACK_ROUTE_PATTERNS si le fichier est absent, illisible ou vide.
 */
export function loadDefaultRoutePatterns(filePath: string = ROUTE_PATTERNS_FILE): string[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const patterns = parseRoutePatterns(content);
    return patterns.length > 0 ? patterns : FALLBACK_ROUTE_PATTERNS;
  } catch {
    return FALLBACK_ROUTE_PATTERNS;
  }
}
