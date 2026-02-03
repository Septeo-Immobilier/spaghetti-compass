/**
 * Parser PHP simple basé sur des regex
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ParseResult, ImportInfo, ExportInfo, FunctionInfo, FunctionCallInfo } from '../types/index.js';

/**
 * Options du parser
 */
export interface PhpParserOptions {
  extractFunctions?: boolean;
}

/**
 * Parser pour fichiers PHP
 */
export class PhpParser {
  /**
   * Parse un fichier PHP et extrait ses imports et fonctions
   */
  parse(filePath: string, options: PhpParserOptions = {}): ParseResult {
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
   * Extrait les imports PHP (use statements et require/include)
   */
  private extractImports(content: string): ImportInfo[] {
    const imports: ImportInfo[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // use statements: use App\Models\User;
      const useMatch = line.match(/^\s*use\s+([A-Za-z0-9_\\]+)(?:\s+as\s+(\w+))?;/);
      if (useMatch) {
        const fullPath = useMatch[1];
        const alias = useMatch[2];
        const parts = fullPath.split('\\');
        const className = alias || parts[parts.length - 1];

        imports.push({
          moduleSpecifier: fullPath,
          type: 'import-static',
          line: lineNum,
          resolved: false,
          importedNames: [className],
        });
      }

      // use function: use function App\Utils\formatDate;
      const useFunctionMatch = line.match(/^\s*use\s+function\s+([A-Za-z0-9_\\]+);/);
      if (useFunctionMatch) {
        const fullPath = useFunctionMatch[1];
        const parts = fullPath.split('\\');
        const funcName = parts[parts.length - 1];

        imports.push({
          moduleSpecifier: fullPath,
          type: 'import-static',
          line: lineNum,
          resolved: false,
          importedNames: [funcName],
        });
      }

      // require/include statements
      const requireMatch = line.match(/^\s*(require|require_once|include|include_once)\s+['"]([^'"]+)['"];/);
      if (requireMatch) {
        imports.push({
          moduleSpecifier: requireMatch[2],
          type: 'require',
          line: lineNum,
          resolved: false,
          importedNames: [],
        });
      }

      // require_once __DIR__ . '/path/to/file.php';
      const dirRequireMatch = line.match(/^\s*(require|require_once|include|include_once)\s+__DIR__\s*\.\s*['"]([^'"]+)['"];/);
      if (dirRequireMatch) {
        imports.push({
          moduleSpecifier: dirRequireMatch[2],
          type: 'require',
          line: lineNum,
          resolved: false,
          importedNames: [],
        });
      }
    }

    return imports;
  }

  /**
   * Extrait les exports PHP (classes, fonctions exportées)
   */
  private extractExports(content: string): ExportInfo[] {
    const exports: ExportInfo[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Classes
      const classMatch = line.match(/^\s*(?:abstract\s+)?(?:final\s+)?class\s+(\w+)/);
      if (classMatch) {
        exports.push({
          name: classMatch[1],
          kind: 'class',
          line: lineNum,
        });
      }

      // Interfaces (traités comme des classes)
      const interfaceMatch = line.match(/^\s*interface\s+(\w+)/);
      if (interfaceMatch) {
        exports.push({
          name: interfaceMatch[1],
          kind: 'class',
          line: lineNum,
        });
      }

      // Functions (hors classes)
      const funcMatch = line.match(/^function\s+(\w+)\s*\(/);
      if (funcMatch) {
        exports.push({
          name: funcMatch[1],
          kind: 'function',
          line: lineNum,
        });
      }
    }

    return exports;
  }

  /**
   * Extrait les fonctions PHP
   */
  private extractFunctions(content: string): FunctionInfo[] {
    const functions: FunctionInfo[] = [];
    const lines = content.split('\n');

    // Trouver les imports pour mapper les appels
    const imports = this.extractImports(content);
    const importMap = new Map<string, string>();
    for (const imp of imports) {
      for (const name of imp.importedNames) {
        importMap.set(name, imp.moduleSpecifier);
      }
    }

    let currentClass: string | null = null;
    let braceDepth = 0;
    let functionStart = -1;
    let functionName = '';
    let functionBraceStart = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Tracker les classes
      const classMatch = line.match(/^\s*(?:abstract\s+)?(?:final\s+)?class\s+(\w+)/);
      if (classMatch) {
        currentClass = classMatch[1];
      }

      // Fonctions/méthodes
      const funcMatch = line.match(/^\s*(?:public\s+|private\s+|protected\s+|static\s+)*function\s+(\w+)\s*\(/);
      if (funcMatch) {
        functionStart = i;
        functionName = currentClass ? `${currentClass}.${funcMatch[1]}` : funcMatch[1];
        functionBraceStart = braceDepth;
      }

      // Compter les accolades
      for (const char of line) {
        if (char === '{') braceDepth++;
        if (char === '}') braceDepth--;
      }

      // Fin de fonction
      if (functionStart !== -1 && braceDepth <= functionBraceStart) {
        const functionContent = lines.slice(functionStart, i + 1).join('\n');
        const calls = this.extractFunctionCalls(functionContent, importMap);

        functions.push({
          name: functionName,
          line: functionStart + 1,
          exported: true,
          calls,
        });

        functionStart = -1;
        functionName = '';
      }

      // Reset class à la fin
      if (currentClass && braceDepth === 0) {
        currentClass = null;
      }
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

      // Appels de fonction: functionName(
      const funcCallMatches = line.matchAll(/\b(\w+)\s*\(/g);
      for (const match of funcCallMatches) {
        const name = match[1];
        // Ignorer les mots-clés PHP
        if (['if', 'else', 'while', 'for', 'foreach', 'switch', 'function', 'class', 'array', 'isset', 'empty', 'unset'].includes(name)) {
          continue;
        }
        if (!seen.has(name)) {
          seen.add(name);
          calls.push({
            name,
            line: i + 1,
            fromModule: importMap.get(name),
          });
        }
      }

      // Appels de méthode: $obj->method(
      const methodMatches = line.matchAll(/\$(\w+)->(\w+)\s*\(/g);
      for (const match of methodMatches) {
        const methodName = match[2];
        if (!seen.has(methodName)) {
          seen.add(methodName);
          calls.push({
            name: methodName,
            line: i + 1,
          });
        }
      }

      // Appels statiques: ClassName::method(
      const staticMatches = line.matchAll(/(\w+)::(\w+)\s*\(/g);
      for (const match of staticMatches) {
        const className = match[1];
        const methodName = match[2];
        const fullName = `${className}.${methodName}`;
        if (!seen.has(fullName)) {
          seen.add(fullName);
          calls.push({
            name: fullName,
            line: i + 1,
            fromModule: importMap.get(className),
          });
        }
      }

      // new ClassName(
      const newMatches = line.matchAll(/new\s+(\w+)\s*\(/g);
      for (const match of newMatches) {
        const className = match[1];
        if (!seen.has(`new ${className}`)) {
          seen.add(`new ${className}`);
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
   * Vérifie si un fichier est un fichier PHP
   */
  static isSupported(filePath: string): boolean {
    return path.extname(filePath).toLowerCase() === '.php';
  }
}
