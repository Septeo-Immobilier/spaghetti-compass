/**
 * TypeScriptLspProvider - Provider utilisant TypeScript Language Service
 */

import ts from 'typescript';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { LspProvider, DefinitionResult } from './types.js';

/**
 * Provider LSP pour TypeScript/JavaScript
 * Utilise directement l'API TypeScript (pas de processus externe)
 */
export class TypeScriptLspProvider implements LspProvider {
  readonly name = 'typescript';
  readonly supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

  private languageService: ts.LanguageService | null = null;
  private files: Map<string, { version: number; content: string }> = new Map();
  private projectRoot: string = '';
  private compilerOptions: ts.CompilerOptions = {};

  async isAvailable(): Promise<boolean> {
    // TypeScript est toujours disponible car c'est une dépendance du projet
    return true;
  }

  async initialize(projectRoot: string, configPath?: string): Promise<void> {
    this.projectRoot = projectRoot;
    this.compilerOptions = this.loadCompilerOptions(configPath);

    const servicesHost: ts.LanguageServiceHost = {
      getScriptFileNames: () => Array.from(this.files.keys()),
      getScriptVersion: (fileName) => {
        const file = this.files.get(fileName);
        return file ? file.version.toString() : '0';
      },
      getScriptSnapshot: (fileName) => {
        // Essayer le cache d'abord
        const file = this.files.get(fileName);
        if (file) {
          return ts.ScriptSnapshot.fromString(file.content);
        }

        // Charger le fichier s'il existe
        if (fs.existsSync(fileName)) {
          const content = fs.readFileSync(fileName, 'utf-8');
          this.files.set(fileName, { version: 0, content });
          return ts.ScriptSnapshot.fromString(content);
        }

        return undefined;
      },
      getCurrentDirectory: () => this.projectRoot,
      getCompilationSettings: () => this.compilerOptions,
      getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
      fileExists: ts.sys.fileExists,
      readFile: ts.sys.readFile,
      readDirectory: ts.sys.readDirectory,
      directoryExists: ts.sys.directoryExists,
      getDirectories: ts.sys.getDirectories,
    };

    this.languageService = ts.createLanguageService(
      servicesHost,
      ts.createDocumentRegistry()
    );
  }

  /**
   * Charge les options du compilateur depuis tsconfig ou utilise les valeurs par défaut
   */
  private loadCompilerOptions(tsConfigPath?: string): ts.CompilerOptions {
    if (tsConfigPath && fs.existsSync(tsConfigPath)) {
      const configFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
      if (!configFile.error) {
        const parsed = ts.parseJsonConfigFileContent(
          configFile.config,
          ts.sys,
          path.dirname(tsConfigPath)
        );
        return parsed.options;
      }
    }

    // Options par défaut
    return {
      allowJs: true,
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      esModuleInterop: true,
      skipLibCheck: true,
      noEmit: true,
    };
  }

  addFile(filePath: string, content?: string): void {
    const absolutePath = path.resolve(filePath);
    if (content !== undefined) {
      this.files.set(absolutePath, { version: 0, content });
    } else if (fs.existsSync(absolutePath)) {
      const fileContent = fs.readFileSync(absolutePath, 'utf-8');
      this.files.set(absolutePath, { version: 0, content: fileContent });
    }
  }

  async getDefinition(
    filePath: string,
    position: number
  ): Promise<DefinitionResult | null> {
    if (!this.languageService) {
      return null;
    }

    const absolutePath = path.resolve(filePath);

    // S'assurer que le fichier est chargé
    if (!this.files.has(absolutePath)) {
      this.addFile(absolutePath);
    }

    try {
      const definitions = this.languageService.getDefinitionAtPosition(
        absolutePath,
        position
      );

      if (!definitions || definitions.length === 0) {
        return null;
      }

      const def = definitions[0];
      const sourceFile = this.languageService
        .getProgram()
        ?.getSourceFile(def.fileName);

      if (!sourceFile) {
        return null;
      }

      const { line, character } =
        sourceFile.getLineAndCharacterOfPosition(def.textSpan.start);

      return {
        filePath: def.fileName,
        line: line + 1, // 1-indexed
        column: character + 1, // 1-indexed
        name: def.name,
      };
    } catch {
      return null;
    }
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

    const file = this.files.get(absolutePath);
    if (!file) {
      return null;
    }

    // Si le symbolName contient un point (ex: "userService.getAll"), extraire la méthode
    const parts = symbolName.split('.');
    const methodName = parts.length > 1 ? parts[parts.length - 1] : symbolName;
    const propertyName = parts.length > 1 ? parts[0] : null;

    // Trouver la position du symbole dans le fichier
    const patterns: RegExp[] = [];

    if (propertyName) {
      // Pour les appels comme this.userService.getAll() ou userService.getAll()
      patterns.push(
        new RegExp(`this\\.${this.escapeRegex(propertyName)}\\.${this.escapeRegex(methodName)}\\s*\\(`),
        new RegExp(`${this.escapeRegex(propertyName)}\\.${this.escapeRegex(methodName)}\\s*\\(`),
      );
    }

    // Patterns génériques
    patterns.push(
      new RegExp(`\\.${this.escapeRegex(methodName)}\\s*\\(`), // .method() call
      new RegExp(`\\b${this.escapeRegex(symbolName)}\\s*\\(`), // function call
      new RegExp(`\\b${this.escapeRegex(symbolName)}\\s*\\.`), // property access
      new RegExp(`\\{[^}]*\\b${this.escapeRegex(symbolName)}\\b[^}]*\\}\\s*from`), // named import
      new RegExp(`this\\.${this.escapeRegex(symbolName)}`), // this.method
      new RegExp(`\\b${this.escapeRegex(symbolName)}\\b`), // any occurrence
    );

    for (const pattern of patterns) {
      const match = pattern.exec(file.content);
      if (match) {
        const matchStart = match.index;
        // Pour les appels de méthode, on veut la position du nom de la méthode
        const targetSymbol = propertyName ? methodName : symbolName;
        const symbolIndex = file.content.indexOf(targetSymbol, matchStart);
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
    const absolutePath = path.resolve(sourceFilePath);

    // S'assurer que le fichier est chargé
    if (!this.files.has(absolutePath)) {
      this.addFile(absolutePath);
    }

    const file = this.files.get(absolutePath);
    if (!file) {
      return null;
    }

    // Chercher l'import statement qui contient ce symbole
    const content = file.content;
    const importPattern = new RegExp(
      `import\\s*\\{[^}]*\\b${this.escapeRegex(symbolName)}\\b[^}]*\\}\\s*from`,
      'g'
    );

    const match = importPattern.exec(content);
    if (match) {
      const matchText = match[0];
      const symbolIndexInMatch = matchText.indexOf(symbolName);
      const position = match.index + symbolIndexInMatch;

      return this.getDefinition(absolutePath, position);
    }

    // Essayer aussi les imports default ou namespace
    return this.getDefinitionByName(sourceFilePath, symbolName);
  }

  /**
   * Échappe les caractères spéciaux pour une regex
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async dispose(): Promise<void> {
    if (this.languageService) {
      this.languageService.dispose();
      this.languageService = null;
    }
    this.files.clear();
  }
}
