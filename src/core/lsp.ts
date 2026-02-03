/**
 * Service LSP utilisant TypeScript Language Service pour "Go to Definition"
 */

import ts from 'typescript';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Résultat de la recherche de définition
 */
export interface DefinitionResult {
  /** Chemin absolu du fichier contenant la définition */
  filePath: string;
  /** Numéro de ligne (1-indexed) */
  line: number;
  /** Numéro de colonne (1-indexed) */
  column: number;
  /** Nom du symbole défini */
  name?: string;
}

/**
 * Service wrapper autour du TypeScript Language Service
 * Permet de résoudre "Go to Definition" comme le fait l'IDE
 */
export class LspService {
  private languageService: ts.LanguageService;
  private files: Map<string, { version: number; content: string }> = new Map();
  private projectRoot: string;
  private compilerOptions: ts.CompilerOptions;

  constructor(projectRoot: string, tsConfigPath?: string) {
    this.projectRoot = projectRoot;
    this.compilerOptions = this.loadCompilerOptions(tsConfigPath);

    const servicesHost: ts.LanguageServiceHost = {
      getScriptFileNames: () => Array.from(this.files.keys()),
      getScriptVersion: (fileName) => {
        const file = this.files.get(fileName);
        return file ? file.version.toString() : '0';
      },
      getScriptSnapshot: (fileName) => {
        // Essayer le cache d'abord
        let file = this.files.get(fileName);
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

  /**
   * Enregistre un fichier dans le service
   */
  addFile(filePath: string, content?: string): void {
    const absolutePath = path.resolve(filePath);
    if (content !== undefined) {
      this.files.set(absolutePath, { version: 0, content });
    } else if (fs.existsSync(absolutePath)) {
      const fileContent = fs.readFileSync(absolutePath, 'utf-8');
      this.files.set(absolutePath, { version: 0, content: fileContent });
    }
  }

  /**
   * Trouve la définition d'un symbole à une position donnée
   */
  getDefinition(filePath: string, position: number): DefinitionResult | null {
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

  /**
   * Trouve la définition d'un symbole par son nom dans un fichier
   * Recherche la première occurrence du symbole et retourne sa définition
   */
  getDefinitionByName(
    filePath: string,
    symbolName: string
  ): DefinitionResult | null {
    const absolutePath = path.resolve(filePath);

    // S'assurer que le fichier est chargé
    if (!this.files.has(absolutePath)) {
      this.addFile(absolutePath);
    }

    const file = this.files.get(absolutePath);
    if (!file) {
      return null;
    }

    // Trouver la position du symbole dans le fichier
    // On cherche des patterns comme:
    // - import { symbolName } from '...'
    // - symbolName(
    // - symbolName.
    // - this.symbolName
    const patterns = [
      new RegExp(`\\b${this.escapeRegex(symbolName)}\\s*\\(`), // function call
      new RegExp(`\\b${this.escapeRegex(symbolName)}\\s*\\.`), // property access
      new RegExp(`\\{[^}]*\\b${this.escapeRegex(symbolName)}\\b[^}]*\\}\\s*from`), // named import
      new RegExp(`this\\.${this.escapeRegex(symbolName)}`), // this.method
      new RegExp(`\\b${this.escapeRegex(symbolName)}\\b`), // any occurrence
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(file.content);
      if (match) {
        // Trouver la position exacte du symbole dans le match
        const matchStart = match.index;
        const symbolIndex = file.content.indexOf(symbolName, matchStart);
        if (symbolIndex !== -1) {
          const result = this.getDefinition(absolutePath, symbolIndex);
          if (result) {
            return result;
          }
        }
      }
    }

    return null;
  }

  /**
   * Trouve la définition d'un symbole importé depuis un module donné
   */
  getDefinitionFromImport(
    sourceFilePath: string,
    symbolName: string,
    _moduleSpecifier: string
  ): DefinitionResult | null {
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

    // Pattern pour trouver l'import avec le nom du symbole
    // import { symbolName } from '...'
    // import { other, symbolName } from '...'
    // import { symbolName as alias } from '...'
    const importPattern = new RegExp(
      `import\\s*\\{[^}]*\\b${this.escapeRegex(symbolName)}\\b[^}]*\\}\\s*from`,
      'g'
    );

    const match = importPattern.exec(content);
    if (match) {
      // Trouver la position exacte du symbole dans l'import
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

  /**
   * Libère les ressources du service
   */
  dispose(): void {
    this.languageService.dispose();
    this.files.clear();
  }
}
