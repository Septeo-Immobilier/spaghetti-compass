/**
 * ParserFactory - Factory pour créer les parsers appropriés selon le langage
 */

import * as path from 'node:path';
import type { Parser } from './types.js';
import { TypeScriptParser } from './typescript.js';
import { PhpParser } from './php.js';
import { PythonParser } from './python.js';
import { GoParser } from './go.js';

/**
 * Parser null pour les fichiers non supportés
 */
class NullParser implements Parser {
  readonly name = 'null';
  readonly supportedExtensions: string[] = [];

  isSupported(_filePath: string): boolean {
    return false;
  }

  parse(filePath: string) {
    return {
      filePath: path.resolve(filePath),
      imports: [],
      exports: [],
      functions: [],
      errors: [`Unsupported file type: ${path.extname(filePath)}`],
    };
  }
}

/**
 * Factory pour créer et gérer les parsers
 */
export class ParserFactory {
  private tsParser: TypeScriptParser;
  private phpParser: PhpParser;
  private pythonParser: PythonParser;
  private goParser: GoParser;
  private nullParser: NullParser;

  /** Liste ordonnée des parsers pour la détection */
  private parsers: Parser[];

  constructor() {
    this.tsParser = new TypeScriptParser();
    this.phpParser = new PhpParser();
    this.pythonParser = new PythonParser();
    this.goParser = new GoParser();
    this.nullParser = new NullParser();

    this.parsers = [this.tsParser, this.phpParser, this.pythonParser, this.goParser];
  }

  /**
   * Retourne le parser approprié pour un fichier
   * @param filePath Chemin du fichier
   */
  getParser(filePath: string): Parser {
    for (const parser of this.parsers) {
      if (parser.isSupported(filePath)) {
        return parser;
      }
    }
    return this.nullParser;
  }

  /**
   * Vérifie si un fichier est supporté par un des parsers
   */
  isSupported(filePath: string): boolean {
    return this.parsers.some((p) => p.isSupported(filePath));
  }

  /**
   * Retourne toutes les extensions supportées
   */
  getSupportedExtensions(): string[] {
    return this.parsers.flatMap((p) => p.supportedExtensions);
  }
}
