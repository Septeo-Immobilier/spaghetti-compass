/**
 * Parser Python simple basé sur des regex
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ParseResult, ImportInfo, ExportInfo, FunctionInfo, FunctionCallInfo } from '../types/index.js';
import type { Parser, ParserOptions } from './types.js';

/**
 * Parser pour fichiers Python
 */
export class PythonParser implements Parser {
  readonly name = 'python';
  readonly supportedExtensions = ['.py', '.pyi'];
  /**
   * Vérifie si un fichier est supporté par ce parser
   */
  isSupported(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.supportedExtensions.includes(ext);
  }

  /**
   * Parse un fichier Python et extrait ses imports et fonctions
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
   * Détecte aussi les callbacks (map, filter, etc.)
   */
  private extractFunctionCalls(content: string, importMap: Map<string, string>): FunctionCallInfo[] {
    const calls: FunctionCallInfo[] = [];
    const seen = new Set<string>();
    const lines = content.split('\n');

    // Fonctions/mots-clés Python à ignorer
    const pythonKeywords = new Set([
      'if', 'elif', 'while', 'for', 'def', 'class', 'with', 'except', 'try',
      'return', 'yield', 'raise', 'import', 'from', 'as', 'pass', 'break',
      'continue', 'lambda', 'and', 'or', 'not', 'in', 'is', 'None', 'True', 'False',
      'async', 'await', 'assert', 'del', 'global', 'nonlocal', 'finally',
    ]);

    const pythonBuiltins = new Set([
      'print', 'len', 'range', 'str', 'int', 'float', 'list', 'dict', 'set',
      'tuple', 'type', 'isinstance', 'hasattr', 'getattr', 'setattr', 'delattr',
      'open', 'input', 'repr', 'abs', 'all', 'any', 'bin', 'bool', 'bytes',
      'callable', 'chr', 'classmethod', 'compile', 'complex', 'dir', 'divmod',
      'enumerate', 'eval', 'exec', 'filter', 'format', 'frozenset', 'globals',
      'hash', 'help', 'hex', 'id', 'iter', 'locals', 'map', 'max', 'min',
      'next', 'object', 'oct', 'ord', 'pow', 'property', 'reversed', 'round',
      'slice', 'sorted', 'staticmethod', 'sum', 'super', 'vars', 'zip',
      '__init__', '__new__', '__str__', '__repr__', '__call__',
    ]);

    // Fonctions qui acceptent des callbacks
    const callbackFunctions = new Set([
      'map', 'filter', 'reduce', 'sorted', 'min', 'max', 'any', 'all',
    ]);

    // Map des variables qui contiennent des références à des méthodes
    const methodVariables = new Map<string, { name: string; isThisCall?: boolean; fromModule?: string }>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Ignorer les lignes vides et les commentaires
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) continue;

      // Détecter les assignations de méthodes: handler = self.process_data
      const selfAssignMatches = line.matchAll(/(\w+)\s*=\s*self\.(\w+)(?!\s*\()/g);
      for (const match of selfAssignMatches) {
        const varName = match[1];
        const methodName = match[2];
        methodVariables.set(varName, { name: methodName, isThisCall: true });
      }

      // Détecter les assignations de fonctions importées: fn = imported_func
      const funcAssignMatches = line.matchAll(/(\w+)\s*=\s*(\w+)(?!\s*\()/g);
      for (const match of funcAssignMatches) {
        const varName = match[1];
        const funcName = match[2];
        if (importMap.has(funcName) && !pythonKeywords.has(funcName)) {
          methodVariables.set(varName, { name: funcName, fromModule: importMap.get(funcName) });
        }
      }

      // Détecter les callbacks dans map(), filter(), etc.
      // Ex: map(self.process, items) ou map(process_func, items)
      for (const callbackFunc of callbackFunctions) {
        // Pattern: callback_func(self.method, ...)
        const selfCallbackRegex = new RegExp(`${callbackFunc}\\s*\\(\\s*self\\.(\\w+)`, 'g');
        const selfCallbackMatches = line.matchAll(selfCallbackRegex);
        for (const match of selfCallbackMatches) {
          const methodName = match[1];
          const callKey = `self.${methodName}`;
          if (!seen.has(callKey)) {
            seen.add(callKey);
            calls.push({
              name: methodName,
              line: i + 1,
              isThisCall: true,
            });
          }
        }

        // Pattern: callback_func(func_name, ...)
        const funcCallbackRegex = new RegExp(`${callbackFunc}\\s*\\(\\s*(\\w+)(?:\\s*,|\\))`, 'g');
        const funcCallbackMatches = line.matchAll(funcCallbackRegex);
        for (const match of funcCallbackMatches) {
          const funcName = match[1];
          if (pythonKeywords.has(funcName) || pythonBuiltins.has(funcName)) continue;

          // Vérifier si c'est une variable qui contient une référence
          if (methodVariables.has(funcName)) {
            const info = methodVariables.get(funcName)!;
            const callKey = info.isThisCall ? `self.${info.name}` : info.name;
            if (!seen.has(callKey)) {
              seen.add(callKey);
              calls.push({
                name: info.name,
                line: i + 1,
                isThisCall: info.isThisCall,
                fromModule: info.fromModule,
              });
            }
          } else if (importMap.has(funcName)) {
            if (!seen.has(funcName)) {
              seen.add(funcName);
              calls.push({
                name: funcName,
                line: i + 1,
                fromModule: importMap.get(funcName),
              });
            }
          }
        }
      }

      // Appels de méthode sur self: self.method(
      const selfMethodMatches = line.matchAll(/self\.(\w+)\s*\(/g);
      for (const match of selfMethodMatches) {
        const methodName = match[1];
        if (methodName.startsWith('_')) continue; // Méthodes privées/spéciales

        const callKey = `self.${methodName}`;
        if (!seen.has(callKey)) {
          seen.add(callKey);
          calls.push({
            name: methodName,
            line: i + 1,
            isThisCall: true,
          });
        }
      }

      // Appels de fonction: function_name(
      const funcCallMatches = line.matchAll(/\b(\w+)\s*\(/g);
      for (const match of funcCallMatches) {
        const name = match[1];
        // Ignorer les mots-clés Python, builtins et self
        if (pythonKeywords.has(name) || pythonBuiltins.has(name) || name === 'self') {
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

        // Ignorer self (déjà traité) et les méthodes sur des builtins
        if (objName === 'self' || pythonBuiltins.has(objName)) continue;

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
        // Ignorer les exceptions Python natives
        if (['Exception', 'Error', 'TypeError', 'ValueError', 'KeyError', 'IndexError', 'AttributeError', 'RuntimeError', 'StopIteration'].includes(className)) {
          continue;
        }
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
   * Vérifie si un fichier est un fichier Python (statique)
   * @deprecated Utiliser l'instance method isSupported() ou ParserFactory
   */
  static isSupported(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.py' || ext === '.pyi';
  }
}
