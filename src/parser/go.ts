/**
 * Parser Go simple basé sur des regex
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ParseResult, ImportInfo, ExportInfo, FunctionInfo, FunctionCallInfo } from '../types/index.js';
import type { Parser, ParserOptions } from './types.js';

/**
 * Parser pour fichiers Go
 */
export class GoParser implements Parser {
  readonly name = 'go';
  readonly supportedExtensions = ['.go'];

  /**
   * Vérifie si un fichier est supporté par ce parser
   */
  isSupported(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.supportedExtensions.includes(ext);
  }

  /**
   * Parse un fichier Go et extrait ses imports, exports et fonctions
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
   * Extrait les imports Go (simple et groupés)
   */
  private extractImports(content: string): ImportInfo[] {
    const imports: ImportInfo[] = [];
    const lines = content.split('\n');

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const lineNum = i + 1;

      // Import simple: import "fmt"  ou  import foo "github.com/x/y"  ou  import _ "pkg"  ou  import . "pkg"
      const singleImportMatch = line.match(/^\s*import\s+(?:(\w+|_|\.)\s+)?"([^"]+)"/);
      if (singleImportMatch) {
        const alias = singleImportMatch[1];
        const moduleSpecifier = singleImportMatch[2];
        const importedNames = this.resolveImportedNames(alias, moduleSpecifier);
        imports.push({
          moduleSpecifier,
          type: 'import-static',
          line: lineNum,
          resolved: false,
          importedNames,
        });
        i++;
        continue;
      }

      // Début d'un bloc import groupé: import (
      const groupStart = line.match(/^\s*import\s*\(/);
      if (groupStart) {
        i++;
        // Parcourir les lignes jusqu'à la parenthèse fermante
        while (i < lines.length) {
          const innerLine = lines[i];
          const innerLineNum = i + 1;

          // Fin du bloc
          if (innerLine.match(/^\s*\)/)) {
            i++;
            break;
          }

          // Ligne vide ou commentaire
          if (innerLine.match(/^\s*$/) || innerLine.match(/^\s*\/\//)) {
            i++;
            continue;
          }

          // Import dans le groupe: "path"  ou  alias "path"  ou  _ "path"  ou  . "path"
          const groupImportMatch = innerLine.match(/^\s*(?:(\w+|_|\.)\s+)?"([^"]+)"/);
          if (groupImportMatch) {
            const alias = groupImportMatch[1];
            const moduleSpecifier = groupImportMatch[2];
            const importedNames = this.resolveImportedNames(alias, moduleSpecifier);
            imports.push({
              moduleSpecifier,
              type: 'import-static',
              line: innerLineNum,
              resolved: false,
              importedNames,
            });
          }

          i++;
        }
        continue;
      }

      i++;
    }

    return imports;
  }

  /**
   * Détermine les importedNames pour un import Go
   * - alias nommé (ex: foo "path") -> [foo]
   * - blank import _ -> []
   * - dot import . -> []
   * - pas d'alias -> []
   */
  private resolveImportedNames(alias: string | undefined, _moduleSpecifier: string): string[] {
    if (!alias) return [];
    if (alias === '_' || alias === '.') return [];
    // Alias nommé
    return [alias];
  }

  /**
   * Extrait les exports Go (fonctions top-level, méthodes, types, const/var)
   */
  private extractExports(content: string): ExportInfo[] {
    const exports: ExportInfo[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Méthode avec receiver: func (r Receiver) Method(  ou  func (r *Receiver) Method(
      const methodMatch = line.match(/^\s*func\s+\(\s*\w+\s+\*?(\w+)\s*\)\s+([A-Za-z_]\w*)\s*[(<[]/);
      if (methodMatch) {
        const receiverType = methodMatch[1];
        const methodName = methodMatch[2];
        exports.push({
          name: `${receiverType}.${methodName}`,
          kind: 'function',
          line: lineNum,
        });
        continue;
      }

      // Fonction top-level: func Name(
      const funcMatch = line.match(/^func\s+([A-Za-z_]\w*)\s*[(<[]/);
      if (funcMatch) {
        exports.push({
          name: funcMatch[1],
          kind: 'function',
          line: lineNum,
        });
        continue;
      }

      // Type: type Name struct|interface|...
      const typeMatch = line.match(/^\s*type\s+([A-Za-z_]\w*)\s+/);
      if (typeMatch) {
        exports.push({
          name: typeMatch[1],
          kind: 'class',
          line: lineNum,
        });
        continue;
      }

      // Const/var top-level simples (ligne unique, non groupés)
      const constVarMatch = line.match(/^(?:const|var)\s+([A-Za-z_]\w*)\s+/);
      if (constVarMatch) {
        exports.push({
          name: constVarMatch[1],
          kind: 'variable',
          line: lineNum,
        });
        continue;
      }
    }

    return exports;
  }

  /**
   * Extrait les fonctions et leurs appels
   */
  private extractFunctions(content: string): FunctionInfo[] {
    const functions: FunctionInfo[] = [];
    const lines = content.split('\n');

    // Construire la carte d'imports pour résoudre les fromModule
    const imports = this.extractImports(content);
    const importMap = new Map<string, string>();
    for (const imp of imports) {
      // Ajouter l'alias s'il existe
      if (imp.importedNames.length > 0) {
        for (const name of imp.importedNames) {
          importMap.set(name, imp.moduleSpecifier);
        }
      }
      // Toujours ajouter le dernier segment du path comme nom par défaut
      const parts = imp.moduleSpecifier.split('/');
      const lastSegment = parts[parts.length - 1];
      if (lastSegment && !importMap.has(lastSegment)) {
        importMap.set(lastSegment, imp.moduleSpecifier);
      }
    }

    let braceDepth = 0;
    let functionStart = -1;
    let functionName = '';
    let functionBraceStart = 0;
    let pendingFunction: { name: string; line: number } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;

      // Détecter la déclaration de méthode avec receiver
      const methodMatch = line.match(/^\s*func\s+\(\s*\w+\s+\*?(\w+)\s*\)\s+([A-Za-z_]\w*)\s*[(<[]/);
      if (methodMatch && functionStart === -1 && pendingFunction === null) {
        const receiverType = methodMatch[1];
        const methodName = methodMatch[2];
        const fullName = `${receiverType}.${methodName}`;

        if (openBraces > 0) {
          functionStart = i;
          functionName = fullName;
          functionBraceStart = braceDepth + 1;
        } else {
          pendingFunction = { name: fullName, line: i };
        }
      } else {
        // Détecter une fonction top-level
        const funcMatch = line.match(/^func\s+([A-Za-z_]\w*)\s*[(<[]/);
        if (funcMatch && functionStart === -1 && pendingFunction === null) {
          const rawName = funcMatch[1];

          if (openBraces > 0) {
            functionStart = i;
            functionName = rawName;
            functionBraceStart = braceDepth + 1;
          } else {
            pendingFunction = { name: rawName, line: i };
          }
        }
      }

      // Si une fonction est en attente et on trouve une accolade ouvrante
      if (pendingFunction && openBraces > 0) {
        functionStart = pendingFunction.line;
        functionName = pendingFunction.name;
        functionBraceStart = braceDepth + 1;
        pendingFunction = null;
      }

      // Mettre à jour la profondeur des accolades
      braceDepth += openBraces - closeBraces;

      // Fin de la fonction courante
      if (functionStart !== -1 && braceDepth < functionBraceStart) {
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
        functionBraceStart = 0;
      }
    }

    return functions;
  }

  /**
   * Extrait les appels de fonction dans un corps de fonction Go
   */
  private extractFunctionCalls(content: string, importMap: Map<string, string>): FunctionCallInfo[] {
    const calls: FunctionCallInfo[] = [];
    const seen = new Set<string>();
    const lines = content.split('\n');

    // Mots-clés Go à ignorer
    const goKeywords = new Set([
      'if', 'for', 'switch', 'select', 'return', 'go', 'defer', 'func',
      'range', 'case', 'type', 'var', 'const', 'map', 'chan', 'struct',
      'interface', 'package', 'import', 'else', 'break', 'continue',
      'goto', 'fallthrough', 'default',
    ]);

    // Builtins Go à ignorer
    const goBuiltins = new Set([
      'make', 'new', 'len', 'cap', 'append', 'copy', 'delete', 'close',
      'panic', 'recover', 'print', 'println', 'complex', 'real', 'imag',
    ]);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Ignorer la première ligne (déclaration de la fonction)
      if (i === 0) continue;

      // Ignorer les commentaires
      if (line.match(/^\s*\/\//)) continue;

      // Appels sélecteurs: pkg.Func(  ou  receiver.Method(
      // Doit capturer avant les appels simples pour éviter que "Func" soit capté sans son préfixe
      const selectorMatches = line.matchAll(/\b([A-Za-z_]\w*)\.([A-Za-z_]\w*)\s*\(/g);
      for (const match of selectorMatches) {
        const prefix = match[1];
        const methodName = match[2];
        const fullName = `${prefix}.${methodName}`;

        if (!seen.has(fullName)) {
          seen.add(fullName);
          calls.push({
            name: fullName,
            line: i + 1,
            fromModule: importMap.get(prefix),
          });
        }
      }

      // Appels de fonction simples: foo(  (pas précédés par un point)
      const funcCallMatches = line.matchAll(/(?<![.\w])([A-Za-z_]\w*)\s*\(/g);
      for (const match of funcCallMatches) {
        const name = match[1];

        // Ignorer les mots-clés et builtins
        if (goKeywords.has(name) || goBuiltins.has(name)) continue;

        // Vérifier que ce n'est pas un appel sélecteur (précédé par un point)
        const matchIndex = match.index ?? 0;
        const charBefore = line[matchIndex - 1];
        if (charBefore === '.') continue;

        if (!seen.has(name)) {
          seen.add(name);
          calls.push({
            name,
            line: i + 1,
            fromModule: importMap.get(name),
          });
        }
      }
    }

    return calls;
  }

  /**
   * Vérifie si un fichier est un fichier Go (statique)
   * @deprecated Utiliser l'instance method isSupported() ou ParserFactory
   */
  static isSupported(filePath: string): boolean {
    return path.extname(filePath).toLowerCase() === '.go';
  }
}
