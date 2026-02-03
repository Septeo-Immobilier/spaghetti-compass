/**
 * Parser Python simple basé sur des regex
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ParseResult, ImportInfo, ExportInfo, FunctionInfo, FunctionCallInfo } from '../types/index.js';

/**
 * Options du parser
 */
export interface PythonParserOptions {
  extractFunctions?: boolean;
}

/**
 * Parser pour fichiers Python
 */
export class PythonParser {
  /**
   * Parse un fichier Python et extrait ses imports et fonctions
   */
  parse(filePath: string, options: PythonParserOptions = {}): ParseResult {
    const absolutePath = path.resolve(filePath);
    const result: ParseResult = {
      filePath: absolutePath,
      imports: [],
      exports: [],
      functions: [],
      errors: [],
    };

    if (!fs.existsSync(absolutePath)) {
      result.errors.push(`File not found: ${absolutePath}`);
      return result;
    }

    // Normaliser les fins de ligne (CRLF -> LF)
    const content = fs.readFileSync(absolutePath, 'utf-8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    try {
      result.imports = this.extractImports(content);
      result.exports = this.extractExports(content);

      if (options.extractFunctions) {
        result.functions = this.extractFunctions(content);
      }
    } catch (error) {
      result.errors.push(`Parse error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  /**
   * Extrait les imports Python
   */
  private extractImports(content: string): ImportInfo[] {
    const imports: ImportInfo[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // from module import name1, name2 (includes relative imports like .module or ..module)
      const fromImportMatch = line.match(/^\s*from\s+(\.{0,3}[\w.]*)\s+import\s+(.+)$/);
      if (fromImportMatch) {
        const module = fromImportMatch[1];
        const namesStr = fromImportMatch[2];

        // Parser les noms importés
        const names: string[] = [];
        // Gérer les cas avec as et les virgules
        const parts = namesStr.split(',').map(p => p.trim());
        for (const part of parts) {
          const asMatch = part.match(/^(\w+)(?:\s+as\s+(\w+))?$/);
          if (asMatch) {
            names.push(asMatch[2] || asMatch[1]);
          }
        }

        if (names.length > 0) {
          imports.push({
            moduleSpecifier: module,
            type: 'import-static',
            line: lineNum,
            resolved: false,
            importedNames: names,
          });
        }
      }

      // import module
      const importMatch = line.match(/^\s*import\s+([\w.]+)(?:\s+as\s+(\w+))?$/);
      if (importMatch) {
        const module = importMatch[1];
        const alias = importMatch[2] || module.split('.').pop() || module;

        imports.push({
          moduleSpecifier: module,
          type: 'import-static',
          line: lineNum,
          resolved: false,
          importedNames: [alias],
        });
      }
    }

    return imports;
  }

  /**
   * Extrait les exports Python (fonctions et classes au niveau module)
   */
  private extractExports(content: string): ExportInfo[] {
    const exports: ExportInfo[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Fonctions au niveau module (sans indentation)
      const funcMatch = line.match(/^def\s+(\w+)\s*\(/);
      if (funcMatch) {
        exports.push({
          name: funcMatch[1],
          kind: 'function',
          line: lineNum,
        });
      }

      // Classes au niveau module
      const classMatch = line.match(/^class\s+(\w+)/);
      if (classMatch) {
        exports.push({
          name: classMatch[1],
          kind: 'class',
          line: lineNum,
        });
      }
    }

    return exports;
  }

  /**
   * Extrait les fonctions Python
   */
  private extractFunctions(content: string): FunctionInfo[] {
    const functions: FunctionInfo[] = [];
    const lines = content.split('\n');

    // Construire la map des imports
    const imports = this.extractImports(content);
    const importMap = new Map<string, string>();
    for (const imp of imports) {
      for (const name of imp.importedNames) {
        importMap.set(name, imp.moduleSpecifier);
      }
    }

    let currentClass: string | null = null;
    let currentClassIndent = 0;
    let functionStart = -1;
    let functionName = '';
    let functionIndent = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Calculer l'indentation
      const indentMatch = line.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1].length : 0;

      // Tracker les classes
      const classMatch = line.match(/^(\s*)class\s+(\w+)/);
      if (classMatch) {
        currentClass = classMatch[2];
        currentClassIndent = classMatch[1].length;
      }

      // Reset class si on revient à une indentation inférieure
      if (currentClass && indent <= currentClassIndent && line.trim() && !classMatch) {
        currentClass = null;
      }

      // Fonctions/méthodes
      const funcMatch = line.match(/^(\s*)def\s+(\w+)\s*\(/);
      if (funcMatch) {
        // Sauvegarder la fonction précédente si elle existe
        if (functionStart !== -1) {
          const functionContent = lines.slice(functionStart, i).join('\n');
          const calls = this.extractFunctionCalls(functionContent, importMap);

          functions.push({
            name: functionName,
            line: functionStart + 1,
            exported: true,
            calls,
          });
        }

        functionStart = i;
        functionIndent = funcMatch[1].length;
        const rawName = funcMatch[2];
        functionName = currentClass ? `${currentClass}.${rawName}` : rawName;
      }

      // Fin de fonction (nouvelle fonction ou fin de fichier ou dedent significatif)
      if (functionStart !== -1 && i > functionStart) {
        const nextLine = lines[i + 1];
        const isEndOfFunction =
          !nextLine || // Fin de fichier
          (line.trim() && indent <= functionIndent && !line.trim().startsWith('#')); // Dedent

        if (isEndOfFunction && i === lines.length - 1) {
          const functionContent = lines.slice(functionStart, i + 1).join('\n');
          const calls = this.extractFunctionCalls(functionContent, importMap);

          functions.push({
            name: functionName,
            line: functionStart + 1,
            exported: true,
            calls,
          });

          functionStart = -1;
        }
      }
    }

    // Sauvegarder la dernière fonction
    if (functionStart !== -1) {
      const functionContent = lines.slice(functionStart).join('\n');
      const calls = this.extractFunctionCalls(functionContent, importMap);

      functions.push({
        name: functionName,
        line: functionStart + 1,
        exported: true,
        calls,
      });
    }

    return functions;
  }

  /**
   * Extrait les appels de fonction dans un bloc de code
   */
  private extractFunctionCalls(content: string, importMap: Map<string, string>): FunctionCallInfo[] {
    const calls: FunctionCallInfo[] = [];
    const seen = new Set<string>();
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Appels de fonction: function_name(
      const funcCallMatches = line.matchAll(/\b(\w+)\s*\(/g);
      for (const match of funcCallMatches) {
        const name = match[1];
        // Ignorer les mots-clés Python et les méthodes spéciales
        if (['if', 'elif', 'while', 'for', 'def', 'class', 'with', 'except', 'print', 'len', 'range', 'str', 'int', 'float', 'list', 'dict', 'set', 'tuple', 'type', 'isinstance', 'hasattr', 'getattr', 'setattr'].includes(name)) {
          continue;
        }
        if (name.startsWith('_')) continue; // Méthodes privées/spéciales

        if (!seen.has(name)) {
          seen.add(name);
          calls.push({
            name,
            line: i + 1,
            fromModule: importMap.get(name),
          });
        }
      }

      // Appels de méthode: obj.method(
      const methodMatches = line.matchAll(/(\w+)\.(\w+)\s*\(/g);
      for (const match of methodMatches) {
        const objName = match[1];
        const methodName = match[2];

        // Si l'objet est importé, c'est un appel de module
        if (importMap.has(objName)) {
          const fullName = `${objName}.${methodName}`;
          if (!seen.has(fullName)) {
            seen.add(fullName);
            calls.push({
              name: methodName,
              line: i + 1,
              fromModule: importMap.get(objName),
            });
          }
        }
      }

      // Instanciation de classe: ClassName(
      const classCallMatches = line.matchAll(/\b([A-Z]\w*)\s*\(/g);
      for (const match of classCallMatches) {
        const className = match[1];
        if (!seen.has(className) && importMap.has(className)) {
          seen.add(className);
          calls.push({
            name: className,
            line: i + 1,
            fromModule: importMap.get(className),
          });
        }
      }
    }

    return calls;
  }

  /**
   * Vérifie si un fichier est un fichier Python
   */
  static isSupported(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.py' || ext === '.pyi';
  }
}
