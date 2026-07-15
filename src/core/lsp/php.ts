/**
 * PhpLspProvider - Provider LSP pour PHP utilisant Intelephense
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { LspProvider, DefinitionResult } from './types.js';
import { LspProcessManager } from './process-manager.js';
import { uriToPath, type LspLocation } from './json-rpc.js';
import { ComposerResolver } from '../composer.js';
import { findPhpConstructorLine } from './php-constructor.js';
import { checkLspForLanguage } from './availability.js';

/**
 * Provider LSP pour PHP utilisant Intelephense
 */
export class PhpLspProvider implements LspProvider {
  readonly name = 'php-intelephense';
  readonly supportedExtensions = ['.php'];

  private processManager: LspProcessManager;
  private projectRoot: string = '';
  private processKey: string = '';
  private files: Map<string, string> = new Map();
  private debug: boolean;
  private composerResolver: ComposerResolver;

  constructor(debug: boolean = false) {
    this.debug = debug;
    this.processManager = new LspProcessManager({ debug });
    this.composerResolver = new ComposerResolver();
  }

  async isAvailable(): Promise<boolean> {
    const availability = checkLspForLanguage('php');
    if (!availability.available && this.debug) {
      console.warn(`[LSP] ${availability.command} not found. Install with: ${availability.installHint}`);
    }
    return availability.available;
  }

  async initialize(projectRoot: string, _configPath?: string): Promise<void> {
    this.projectRoot = projectRoot;
    this.processKey = `php:${projectRoot}`;

    // Le processus sera démarré à la première requête
  }

  private async ensureProcess(): Promise<boolean> {
    const process = await this.processManager.getOrCreateProcess(
      this.processKey,
      'intelephense',
      ['--stdio'],
      this.projectRoot
    );
    return process !== null;
  }

  addFile(filePath: string, content?: string): void {
    const absolutePath = path.resolve(filePath);
    if (content !== undefined) {
      this.files.set(absolutePath, content);
    } else if (fs.existsSync(absolutePath)) {
      const fileContent = fs.readFileSync(absolutePath, 'utf-8');
      this.files.set(absolutePath, fileContent);
    }
  }

  async getDefinition(
    filePath: string,
    position: number
  ): Promise<DefinitionResult | null> {
    const absolutePath = path.resolve(filePath);

    // S'assurer que le fichier est chargé
    if (!this.files.has(absolutePath)) {
      this.addFile(absolutePath);
    }

    const content = this.files.get(absolutePath);
    if (!content) {
      return null;
    }

    // Démarrer le processus si nécessaire
    const hasProcess = await this.ensureProcess();
    if (!hasProcess) {
      return null;
    }

    const process = this.processManager.getExistingProcess(this.processKey);
    if (!process) {
      return null;
    }

    // Ouvrir le document
    this.processManager.didOpen(process, absolutePath, content, 'php');

    // Convertir la position (offset) en ligne/colonne
    const { line, character } = this.offsetToLineColumn(content, position);

    // Obtenir la définition
    const result = await this.processManager.getDefinition(
      process,
      absolutePath,
      line,
      character
    );

    return this.locationToDefinitionResult(result);
  }

  async getDefinitionByName(
    filePath: string,
    symbolName: string
  ): Promise<DefinitionResult | null> {
    const absolutePath = path.resolve(filePath);

    // S'assurer que le fichier est chargé
    if (!this.files.has(absolutePath)) {
      this.addFile(absolutePath);
    }

    const content = this.files.get(absolutePath);
    if (!content) {
      return null;
    }

    // Trouver la position du symbole dans le fichier
    const patterns = [
      new RegExp(`\\b${this.escapeRegex(symbolName)}\\s*\\(`), // function call
      new RegExp(`\\b${this.escapeRegex(symbolName)}\\s*::`), // static method
      new RegExp(`->\\s*${this.escapeRegex(symbolName)}\\s*\\(`), // method call
      new RegExp(`new\\s+${this.escapeRegex(symbolName)}`), // new instance
      new RegExp(`use\\s+[^;]*\\b${this.escapeRegex(symbolName)}\\b`), // use statement
      new RegExp(`\\b${this.escapeRegex(symbolName)}\\b`), // any occurrence
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(content);
      if (match) {
        const matchStart = match.index;
        const symbolIndex = content.indexOf(symbolName, matchStart);
        if (symbolIndex !== -1) {
          const result = await this.getDefinition(absolutePath, symbolIndex);
          if (result) {
            return result;
          }
        }
      }
    }

    return null;
  }

  async getDefinitionFromImport(
    sourceFilePath: string,
    symbolName: string,
    moduleSpecifier: string
  ): Promise<DefinitionResult | null> {
    // Pour les namespaces PHP, on résout d'abord via Composer PSR-4
    // puis on cherche la définition dans le fichier cible (pas le fichier source!)
    
    // Essayer de résoudre le namespace via Composer
    if (ComposerResolver.isPhpNamespace(moduleSpecifier)) {
      const resolution = this.composerResolver.resolve(moduleSpecifier, sourceFilePath);
      
      if (resolution.filePath && fs.existsSync(resolution.filePath)) {
        // Charger le fichier cible
        this.addFile(resolution.filePath);
        
        // Chercher la définition de la classe/interface dans le fichier cible
        const targetContent = this.files.get(resolution.filePath);
        if (targetContent) {
          const classDefLine = this.findClassDefinitionLine(targetContent, symbolName);
          if (classDefLine !== null) {
            const constructorLine = findPhpConstructorLine(targetContent, symbolName);
            const line = constructorLine ?? classDefLine;
            return {
              filePath: resolution.filePath,
              line,
              column: 1,
            };
          }
        }
        
        // Fallback: utiliser le LSP sur le fichier cible
        const lspResult = await this.getDefinitionByName(resolution.filePath, symbolName);
        if (lspResult) {
          return lspResult;
        }
      }
    }
    
    // Fallback: chercher dans le fichier source (comportement original)
    return this.getDefinitionByName(sourceFilePath, symbolName);
  }

  /**
   * Trouve la ligne de définition d'une classe/interface/trait dans le contenu d'un fichier
   */
  private findClassDefinitionLine(content: string, className: string): number | null {
    const lines = content.split('\n');

    // Patterns pour trouver la définition de classe/interface/trait
    const patterns = [
      new RegExp(`^\\s*(?:abstract\\s+)?(?:final\\s+)?class\\s+${this.escapeRegex(className)}\\b`),
      new RegExp(`^\\s*interface\\s+${this.escapeRegex(className)}\\b`),
      new RegExp(`^\\s*trait\\s+${this.escapeRegex(className)}\\b`),
      new RegExp(`^\\s*enum\\s+${this.escapeRegex(className)}\\b`),
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of patterns) {
        if (pattern.test(line)) {
          return i + 1; // 1-indexed
        }
      }
    }

    return null;
  }

  async dispose(): Promise<void> {
    await this.processManager.shutdown(this.processKey);
    this.files.clear();
  }

  /**
   * Convertit un offset en position ligne/colonne
   */
  private offsetToLineColumn(
    content: string,
    offset: number
  ): { line: number; character: number } {
    let line = 0;
    let character = 0;

    for (let i = 0; i < offset && i < content.length; i++) {
      if (content[i] === '\n') {
        line++;
        character = 0;
      } else {
        character++;
      }
    }

    return { line, character };
  }

  /**
   * Convertit une LspLocation en DefinitionResult
   */
  private locationToDefinitionResult(
    location: LspLocation | LspLocation[] | null
  ): DefinitionResult | null {
    if (!location) {
      return null;
    }

    const loc = Array.isArray(location) ? location[0] : location;
    if (!loc) {
      return null;
    }

    return {
      filePath: uriToPath(loc.uri),
      line: loc.range.start.line + 1, // 1-indexed
      column: loc.range.start.character + 1, // 1-indexed
    };
  }

  /**
   * Échappe les caractères spéciaux pour une regex
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
