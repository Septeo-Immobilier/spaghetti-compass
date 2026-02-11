/**
 * PythonLspProvider - Provider LSP pour Python utilisant Pyright
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import type { LspProvider, DefinitionResult } from './types.js';
import { LspProcessManager } from './process-manager.js';
import { uriToPath, type LspLocation } from './json-rpc.js';

/**
 * Provider LSP pour Python utilisant Pyright
 */
export class PythonLspProvider implements LspProvider {
  readonly name = 'python-pyright';
  readonly supportedExtensions = ['.py', '.pyi'];

  private processManager: LspProcessManager;
  private projectRoot: string = '';
  private processKey: string = '';
  private files: Map<string, string> = new Map();
  private debug: boolean;

  constructor(debug: boolean = false) {
    this.debug = debug;
    this.processManager = new LspProcessManager({ debug });
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Essayer de trouver pyright-langserver
      execSync('npx pyright-langserver --version', { stdio: 'pipe' });
      return true;
    } catch {
      try {
        // Essayer avec which/where
        execSync(
          process.platform === 'win32' ? 'where pyright-langserver' : 'which pyright-langserver',
          { stdio: 'pipe' }
        );
        return true;
      } catch {
        if (this.debug) {
          console.warn('[LSP] Pyright not found. Install with: npm install -g pyright');
        }
        return false;
      }
    }
  }

  async initialize(projectRoot: string, _configPath?: string): Promise<void> {
    this.projectRoot = projectRoot;
    this.processKey = `python:${projectRoot}`;

    // Le processus sera démarré à la première requête
  }

  private async ensureProcess(): Promise<boolean> {
    const process = await this.processManager.getOrCreateProcess(
      this.processKey,
      'npx',
      ['pyright-langserver', '--stdio'],
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
      'npx',
      ['pyright-langserver', '--stdio'],
      this.projectRoot
    );
    if (!process) {
      return null;
    }

    // Ouvrir le document
    this.processManager.didOpen(process, absolutePath, content, 'python');

    // Convertir la position (offset) en ligne/colonne
    const { line, character } = this.offsetToLineColumn(content, position);

    // Obtenir la définition
    const result = await this.processManager.getDefinition(
      process,
      absolutePath,
      line,
      character
    );

    const defResult = this.locationToDefinitionResult(result);
    return defResult ? this.redirectClassToInit(defResult) ?? defResult : null;
  }

  /**
   * Si la définition pointe vers une ligne "class X", renvoie le résultat
   * avec line/column pointant vers "def __init__" si présent ; sinon null.
   */
  private redirectClassToInit(
    result: DefinitionResult
  ): DefinitionResult | null {
    const content = this.files.get(path.resolve(result.filePath));
    if (!content) return null;
    const initLine = this.findConstructorLineInClass(content, result.line);
    if (initLine === null) return null;
    const lines = content.split('\n');
    const lineContent = lines[initLine - 1];
    const column = (lineContent.match(/^\s*/)?.[0]?.length ?? 0) + 1;
    return { ...result, line: initLine, column };
  }

  /**
   * Trouve la ligne de "def __init__" dans la classe dont la déclaration est à classDeclarationLine.
   * @returns Ligne 1-indexed ou null
   */
  private findConstructorLineInClass(
    content: string,
    classDeclarationLine: number
  ): number | null {
    const lines = content.split('\n');
    const lineIndex = classDeclarationLine - 1;
    if (lineIndex < 0 || lineIndex >= lines.length) return null;
    const classLine = lines[lineIndex];
    const classMatch = classLine.match(/^(\s*)class\s+\w+/);
    if (!classMatch) return null;
    const classIndent = classMatch[1].length;
    const initPattern = /^(\s*)def\s+__init__\s*\(/;
    for (let i = lineIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      const indent = line.match(/^\s*/)?.[0]?.length ?? 0;
      if (indent <= classIndent && line.trim().length > 0) {
        break;
      }
      if (initPattern.test(line)) {
        return i + 1;
      }
    }
    return null;
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
      new RegExp(`\\b${this.escapeRegex(symbolName)}\\s*\\.`), // attribute access
      new RegExp(`from\\s+\\S+\\s+import\\s+[^\\n]*\\b${this.escapeRegex(symbolName)}\\b`), // from import
      new RegExp(`import\\s+[^\\n]*\\b${this.escapeRegex(symbolName)}\\b`), // import
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
    _moduleSpecifier: string
  ): Promise<DefinitionResult | null> {
    // En Python, on utilise getDefinitionByName qui gère déjà les imports
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
