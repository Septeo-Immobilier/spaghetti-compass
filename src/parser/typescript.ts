/**
 * Parser TypeScript utilisant le TypeScript Compiler API
 */

import ts from 'typescript';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ParseResult, FunctionInfo, FunctionCallInfo } from '../types/index';
import { extractImports, extractExports, extractFunctionCalls } from './imports';

/**
 * Options du parser
 */
export interface ParserOptions {
  /** Extraire les informations de fonctions */
  extractFunctions?: boolean;
}

/**
 * Parser pour fichiers TypeScript et JavaScript
 */
export class TypeScriptParser {
  private compilerOptions: ts.CompilerOptions;

  constructor() {
    this.compilerOptions = {
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
   * Parse un fichier et extrait ses imports, exports et fonctions
   */
  parse(filePath: string, options: ParserOptions = {}): ParseResult {
    const absolutePath = path.resolve(filePath);
    const result: ParseResult = {
      filePath: absolutePath,
      imports: [],
      exports: [],
      functions: [],
      errors: [],
    };

    // Vérifier que le fichier existe
    if (!fs.existsSync(absolutePath)) {
      result.errors.push(`File not found: ${absolutePath}`);
      return result;
    }

    // Lire le contenu du fichier
    const content = fs.readFileSync(absolutePath, 'utf-8');

    // Créer le source file
    const sourceFile = ts.createSourceFile(
      absolutePath,
      content,
      ts.ScriptTarget.ESNext,
      true,
      this.getScriptKind(absolutePath)
    );

    // Vérifier les erreurs de syntaxe
    const syntaxErrors = this.getSyntaxErrors(sourceFile);
    if (syntaxErrors.length > 0) {
      result.errors.push(...syntaxErrors);
      // On continue quand même pour extraire ce qu'on peut
    }

    // Extraire imports et exports
    try {
      result.imports = extractImports(sourceFile);
      result.exports = extractExports(sourceFile);

      // Extraire les fonctions si demandé
      if (options.extractFunctions) {
        result.functions = this.extractFunctions(sourceFile);
      }
    } catch (error) {
      result.errors.push(`Parse error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  /**
   * Détermine le type de script basé sur l'extension
   */
  private getScriptKind(filePath: string): ts.ScriptKind {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.ts':
        return ts.ScriptKind.TS;
      case '.tsx':
        return ts.ScriptKind.TSX;
      case '.js':
        return ts.ScriptKind.JS;
      case '.jsx':
        return ts.ScriptKind.JSX;
      case '.mjs':
      case '.cjs':
        return ts.ScriptKind.JS;
      default:
        return ts.ScriptKind.Unknown;
    }
  }

  /**
   * Récupère les erreurs de syntaxe du fichier
   */
  private getSyntaxErrors(sourceFile: ts.SourceFile): string[] {
    const errors: string[] = [];

    // Créer un programme minimal pour obtenir les diagnostics
    const host: ts.CompilerHost = {
      getSourceFile: (fileName) =>
        fileName === sourceFile.fileName ? sourceFile : undefined,
      getDefaultLibFileName: () => 'lib.d.ts',
      writeFile: () => {},
      getCurrentDirectory: () => process.cwd(),
      getCanonicalFileName: (f) => f,
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => '\n',
      fileExists: (f) => f === sourceFile.fileName,
      readFile: () => '',
    };

    const program = ts.createProgram([sourceFile.fileName], this.compilerOptions, host);
    const diagnostics = program.getSyntacticDiagnostics(sourceFile);

    for (const diagnostic of diagnostics) {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      if (diagnostic.file && diagnostic.start !== undefined) {
        const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(
          diagnostic.start
        );
        errors.push(`Syntax error at line ${line + 1}, col ${character + 1}: ${message}`);
      } else {
        errors.push(`Syntax error: ${message}`);
      }
    }

    return errors;
  }

  /**
   * Extrait les fonctions déclarées dans le fichier
   */
  private extractFunctions(sourceFile: ts.SourceFile): FunctionInfo[] {
    const functions: FunctionInfo[] = [];

    // Construire la map des imports pour les appels de fonction
    const importedNames = new Map<string, string>();
    const imports = extractImports(sourceFile);
    for (const imp of imports) {
      for (const name of imp.importedNames) {
        // Gérer "* as ns"
        if (name.startsWith('* as ')) {
          importedNames.set(name.substring(5), imp.moduleSpecifier);
        } else {
          importedNames.set(name, imp.moduleSpecifier);
        }
      }
    }

    const visit = (node: ts.Node): void => {
      // Function declarations
      if (ts.isFunctionDeclaration(node) && node.name) {
        const funcInfo = this.createFunctionInfo(node, sourceFile, importedNames);
        if (funcInfo) {
          functions.push(funcInfo);
        }
      }

      // Arrow functions assigned to variables
      if (ts.isVariableStatement(node)) {
        for (const declaration of node.declarationList.declarations) {
          if (
            ts.isIdentifier(declaration.name) &&
            declaration.initializer &&
            (ts.isArrowFunction(declaration.initializer) ||
              ts.isFunctionExpression(declaration.initializer))
          ) {
            const funcInfo = this.createFunctionInfoFromVariable(
              declaration,
              node,
              sourceFile,
              importedNames
            );
            if (funcInfo) {
              functions.push(funcInfo);
            }
          }
        }
      }

      // Methods in classes
      if (ts.isClassDeclaration(node)) {
        for (const member of node.members) {
          if (ts.isMethodDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
            const className = node.name?.text || 'anonymous';
            const funcInfo = this.createMethodInfo(
              member,
              className,
              sourceFile,
              importedNames
            );
            if (funcInfo) {
              functions.push(funcInfo);
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return functions;
  }

  /**
   * Crée un FunctionInfo depuis une déclaration de fonction
   */
  private createFunctionInfo(
    node: ts.FunctionDeclaration,
    sourceFile: ts.SourceFile,
    importedNames: Map<string, string>
  ): FunctionInfo | null {
    if (!node.name) return null;

    const calls: FunctionCallInfo[] = node.body
      ? extractFunctionCalls(node.body, sourceFile, importedNames)
      : [];

    return {
      name: node.name.text,
      line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      exported: this.hasExportModifier(node),
      calls,
    };
  }

  /**
   * Crée un FunctionInfo depuis une variable avec arrow function
   */
  private createFunctionInfoFromVariable(
    declaration: ts.VariableDeclaration,
    statement: ts.VariableStatement,
    sourceFile: ts.SourceFile,
    importedNames: Map<string, string>
  ): FunctionInfo | null {
    if (!ts.isIdentifier(declaration.name) || !declaration.initializer) return null;

    const func = declaration.initializer as ts.ArrowFunction | ts.FunctionExpression;
    const calls: FunctionCallInfo[] = func.body
      ? extractFunctionCalls(func.body, sourceFile, importedNames)
      : [];

    return {
      name: declaration.name.text,
      line: sourceFile.getLineAndCharacterOfPosition(declaration.getStart()).line + 1,
      exported: this.hasExportModifier(statement),
      calls,
    };
  }

  /**
   * Crée un FunctionInfo depuis une méthode de classe
   */
  private createMethodInfo(
    node: ts.MethodDeclaration,
    className: string,
    sourceFile: ts.SourceFile,
    importedNames: Map<string, string>
  ): FunctionInfo | null {
    if (!node.name || !ts.isIdentifier(node.name)) return null;

    const calls: FunctionCallInfo[] = node.body
      ? extractFunctionCalls(node.body, sourceFile, importedNames)
      : [];

    return {
      name: `${className}.${node.name.text}`,
      line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      exported: false, // Les méthodes ne sont pas directement exportées
      calls,
    };
  }

  /**
   * Vérifie si un noeud a le modifier export
   */
  private hasExportModifier(node: ts.Node): boolean {
    const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    return modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
  }

  /**
   * Vérifie si un fichier est un fichier TypeScript/JavaScript supporté
   */
  static isSupported(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext);
  }
}
