/**
 * Types et interfaces pour les parsers multi-langages
 */

import type { ParseResult } from '../types/index.js';

/**
 * Options de parsing communes à tous les langages
 */
export interface ParserOptions {
  /** Extraire les informations de fonctions et leurs appels */
  extractFunctions?: boolean;
}

/**
 * Interface abstraite pour tous les parsers de code
 * Chaque langage implémente cette interface pour extraire imports/exports/fonctions
 */
export interface Parser {
  /** Nom du parser pour les logs/debug */
  readonly name: string;

  /** Extensions de fichiers supportées (ex: ['.php']) */
  readonly supportedExtensions: string[];

  /**
   * Vérifie si le parser supporte ce fichier
   * @param filePath Chemin du fichier
   */
  isSupported(filePath: string): boolean;

  /**
   * Parse un fichier et extrait ses imports, exports et fonctions
   * @param filePath Chemin du fichier à parser
   * @param options Options de parsing
   * @returns Résultat du parsing avec imports, exports, fonctions et erreurs
   */
  parse(filePath: string, options?: ParserOptions): ParseResult;
}
