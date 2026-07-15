/**
 * GoLspProvider - Provider LSP pour Go utilisant gopls
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { LspProvider, DefinitionResult } from './types.js';
import { LspProcessManager } from './process-manager.js';
import { uriToPath, type LspLocation } from './json-rpc.js';
import { checkLspForLanguage } from './availability.js';

/**
 * Provider LSP pour Go utilisant gopls
 */
export class GoLspProvider implements LspProvider {
  readonly name = 'go-gopls';
  readonly supportedExtensions = ['.go'];

  private processManager: LspProcessManager;
  private projectRoot: string = '';
  private processKey: string = '';
  private files: Map<string, string> = new Map();
  private debug: boolean;
  private goplsPath: string;

  constructor(goplsPath?: string, debug: boolean = false) {
    this.goplsPath = goplsPath ?? 'gopls';
    this.debug = debug;
    this.processManager = new LspProcessManager({ debug });
  }

  async isAvailable(): Promise<boolean> {
    const availability = checkLspForLanguage('go');
    if (!availability.available && this.debug) {
      console.warn(`[LSP] ${availability.command} not found. Install with: ${availability.installHint}`);
    }
    return availability.available;
  }

  async initialize(projectRoot: string, _configPath?: string): Promise<void> {
    this.projectRoot = projectRoot;
    this.processKey = `go:${projectRoot}`;

    // Le processus sera démarré à la première requête
  }

  private async ensureProcess(): Promise<boolean> {
    const process = await this.processManager.getOrCreateProcess(
      this.processKey,
      this.goplsPath,
      [],
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

    const process = await this.processManager.getOrCreateProcess(
      this.processKey,
      this.goplsPath,
      [],
      this.projectRoot
    );
    if (!process) {
      return null;
    }

    // Ouvrir le document
    this.processManager.didOpen(process, absolutePath, content, 'go');

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
      new RegExp(`\\b${this.escapeRegex(symbolName)}\\s*\\(`), // function/method call
      new RegExp(`\\b${this.escapeRegex(symbolName)}\\s*\\.`), // field/method access
      new RegExp(`"${this.escapeRegex(symbolName)}"`),          // string literal
      new RegExp(`\\b${this.escapeRegex(symbolName)}\\b`),      // any occurrence
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
    _moduleSpecifier: string
  ): Promise<DefinitionResult | null> {
    // Pour Go, on délègue à getDefinitionByName qui gère déjà les imports
    return this.getDefinitionByName(sourceFilePath, symbolName);
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
      line: loc.range.start.line + 1,      // 1-indexed
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
