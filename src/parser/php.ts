/**
 * Parser PHP simple basé sur des regex
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ParseResult, ImportInfo, ExportInfo, FunctionInfo, FunctionCallInfo } from '../types/index.js';
import type { Parser, ParserOptions } from './types.js';

/**
 * Parser pour fichiers PHP
 */
export class PhpParser implements Parser {
  readonly name = 'php';
  readonly supportedExtensions = ['.php'];
  /**
   * Vérifie si un fichier est supporté par ce parser
   */
  isSupported(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.supportedExtensions.includes(ext);
  }

  /**
   * Parse un fichier PHP et extrait ses imports et fonctions
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
    let pendingClass: string | null = null; // Classe détectée mais pas encore d'accolade
    let classBraceDepth = 0;
    let braceDepth = 0;
    let functionStart = -1;
    let functionName = '';
    let pendingFunction: { name: string; line: number } | null = null; // Fonction détectée mais pas encore d'accolade
    let functionBraceStart = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Compter les accolades
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;

      // Tracker les classes - détecter la déclaration
      const classMatch = line.match(/^\s*(?:abstract\s+)?(?:final\s+)?class\s+(\w+)/);
      if (classMatch && currentClass === null && pendingClass === null) {
        if (openBraces > 0) {
          // L'accolade est sur la même ligne
          currentClass = classMatch[1];
          classBraceDepth = braceDepth + 1; // Après l'accolade ouvrante
        } else {
          // L'accolade sera sur une ligne suivante
          pendingClass = classMatch[1];
        }
      }

      // Si on a une classe en attente et qu'on trouve une accolade
      if (pendingClass && openBraces > 0) {
        currentClass = pendingClass;
        classBraceDepth = braceDepth + 1;
        pendingClass = null;
      }

      // Fonctions/méthodes - détecter la déclaration
      const funcMatch = line.match(/^\s*(?:public\s+|private\s+|protected\s+|static\s+)*function\s+(\w+)\s*\(/);
      if (funcMatch && functionStart === -1 && pendingFunction === null) {
        const rawFuncName = funcMatch[1];
        const fullFuncName = currentClass ? `${currentClass}.${rawFuncName}` : rawFuncName;

        if (openBraces > 0) {
          // L'accolade est sur la même ligne
          functionStart = i;
          functionName = fullFuncName;
          functionBraceStart = braceDepth + 1;
        } else {
          // L'accolade sera sur une ligne suivante
          pendingFunction = { name: fullFuncName, line: i };
        }
      }

      // Si on a une fonction en attente et qu'on trouve une accolade
      if (pendingFunction && openBraces > 0) {
        functionStart = pendingFunction.line;
        functionName = pendingFunction.name;
        functionBraceStart = braceDepth + 1;
        pendingFunction = null;
      }

      // Mettre à jour la profondeur des accolades
      braceDepth += openBraces - closeBraces;

      // Fin de fonction - quand on revient au niveau avant l'accolade ouvrante
      if (functionStart !== -1 && braceDepth < functionBraceStart) {
        const functionContent = lines.slice(functionStart, i + 1).join('\n');
        const calls = this.extractFunctionCalls(functionContent, importMap, functionName);

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

      // Reset class quand on sort de la classe
      if (currentClass && braceDepth < classBraceDepth) {
        currentClass = null;
        classBraceDepth = 0;
      }
    }

    return functions;
  }

  /**
   * Extrait les appels de fonction dans un bloc de code
   * Détecte aussi les callbacks (array_map, array_filter, usort, etc.)
   */
  private extractFunctionCalls(content: string, importMap: Map<string, string>, currentFunctionName?: string): FunctionCallInfo[] {
    const calls: FunctionCallInfo[] = [];
    const seen = new Set<string>();
    const lines = content.split('\n');

    // Mots-clés et fonctions natives PHP à ignorer
    const phpKeywords = new Set([
      'if', 'else', 'elseif', 'while', 'for', 'foreach', 'switch', 'case',
      'function', 'class', 'interface', 'trait', 'abstract', 'final',
      'public', 'private', 'protected', 'static', 'const', 'new', 'return',
      'try', 'catch', 'finally', 'throw', 'use', 'namespace', 'extends', 'implements',
    ]);

    const phpNativeFunctions = new Set([
      // Array functions
      'array', 'array_merge', 'array_map', 'array_filter', 'array_reduce',
      'array_keys', 'array_values', 'array_push', 'array_pop', 'array_shift',
      'array_unshift', 'array_slice', 'array_splice', 'in_array', 'count',
      'sizeof', 'sort', 'usort', 'ksort', 'asort', 'array_search', 'array_key_exists',
      // String functions
      'strlen', 'strpos', 'substr', 'str_replace', 'strtolower', 'strtoupper',
      'trim', 'ltrim', 'rtrim', 'explode', 'implode', 'sprintf', 'printf',
      'preg_match', 'preg_replace', 'preg_split',
      // Type functions
      'isset', 'empty', 'unset', 'is_array', 'is_string', 'is_int', 'is_null',
      'is_bool', 'is_object', 'is_numeric', 'gettype', 'settype', 'intval',
      'floatval', 'strval', 'boolval',
      // Output functions
      'echo', 'print', 'print_r', 'var_dump', 'var_export',
      // File functions
      'file_get_contents', 'file_put_contents', 'fopen', 'fclose', 'fread', 'fwrite',
      'file_exists', 'is_file', 'is_dir', 'mkdir', 'rmdir', 'unlink',
      // JSON functions
      'json_encode', 'json_decode',
      // Date functions
      'date', 'time', 'strtotime', 'mktime',
      // Math functions
      'abs', 'ceil', 'floor', 'round', 'max', 'min', 'rand', 'mt_rand',
      // Other common functions
      'defined', 'define', 'constant', 'class_exists', 'method_exists',
      'property_exists', 'get_class', 'get_parent_class', 'call_user_func',
      'call_user_func_array', 'func_get_args', 'func_num_args',
      'header', 'exit', 'die', 'sleep', 'usleep',
      'bin2hex', 'hex2bin', 'base64_encode', 'base64_decode',
      'random_bytes', 'random_int', 'password_hash', 'password_verify',
    ]);

    // Fonctions PHP qui acceptent des callbacks
    const callbackFunctions = new Set([
      'array_map', 'array_filter', 'array_reduce', 'array_walk', 'array_walk_recursive',
      'usort', 'uasort', 'uksort', 'preg_replace_callback', 'preg_replace_callback_array',
      'call_user_func', 'call_user_func_array', 'register_shutdown_function',
      'set_error_handler', 'set_exception_handler', 'spl_autoload_register',
    ]);

    // Extraire le nom simple de la fonction courante (sans préfixe de classe)
    const currentSimpleName = currentFunctionName?.includes('.')
      ? currentFunctionName.split('.').pop()
      : currentFunctionName;

    // Map des variables qui contiennent des références à des méthodes
    const methodVariables = new Map<string, { name: string; isThisCall?: boolean; fromModule?: string }>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Ignorer la première ligne (déclaration de la fonction)
      if (i === 0) continue;

      // Détecter les assignations de callbacks: $callback = [$this, 'methodName'];
      const callbackAssignMatches = line.matchAll(/\$(\w+)\s*=\s*\[\s*\$this\s*,\s*['"](\w+)['"]\s*\]/g);
      for (const match of callbackAssignMatches) {
        const varName = match[1];
        const methodName = match[2];
        methodVariables.set(varName, { name: methodName, isThisCall: true });
      }

      // Détecter les assignations: $callback = [$obj, 'methodName'];
      const objCallbackAssignMatches = line.matchAll(/\$(\w+)\s*=\s*\[\s*\$(\w+)\s*,\s*['"](\w+)['"]\s*\]/g);
      for (const match of objCallbackAssignMatches) {
        const varName = match[1];
        const objName = match[2];
        const methodName = match[3];
        if (objName !== 'this') {
          methodVariables.set(varName, {
            name: `${objName}.${methodName}`,
            fromModule: importMap.get(objName)
          });
        }
      }

      // Détecter les callbacks inline: array_map([$this, 'methodName'], ...)
      const inlineCallbackMatches = line.matchAll(/(\w+)\s*\(\s*\[\s*\$this\s*,\s*['"](\w+)['"]\s*\]/g);
      for (const match of inlineCallbackMatches) {
        const funcName = match[1];
        const methodName = match[2];

        // Ignorer si c'est la fonction courante (récursif)
        if (methodName === currentSimpleName) continue;

        if (callbackFunctions.has(funcName)) {
          const callKey = `this.${methodName}`;
          if (!seen.has(callKey)) {
            seen.add(callKey);
            calls.push({
              name: methodName,
              line: i + 1,
              isThisCall: true,
            });
          }
        }
      }

      // Détecter les callbacks avec Closure::fromCallable([$this, 'method'])
      const closureCallableMatches = line.matchAll(/Closure::fromCallable\s*\(\s*\[\s*\$this\s*,\s*['"](\w+)['"]\s*\]\s*\)/g);
      for (const match of closureCallableMatches) {
        const methodName = match[1];
        if (methodName === currentSimpleName) continue;

        const callKey = `this.${methodName}`;
        if (!seen.has(callKey)) {
          seen.add(callKey);
          calls.push({
            name: methodName,
            line: i + 1,
            isThisCall: true,
          });
        }
      }

      // Détecter l'utilisation de $callback comme argument si c'est une variable connue
      for (const [varName, info] of methodVariables) {
        const varUsageRegex = new RegExp(`\\$${varName}(?![\\w])`, 'g');
        if (varUsageRegex.test(line)) {
          const callKey = info.isThisCall ? `this.${info.name}` : info.name;
          if (!seen.has(callKey)) {
            seen.add(callKey);
            calls.push({
              name: info.name,
              line: i + 1,
              isThisCall: info.isThisCall,
              fromModule: info.fromModule,
            });
          }
        }
      }

      // Appels de fonction: functionName( mais PAS $obj->functionName( ni ClassName::functionName(
      // On utilise un lookbehind négatif pour exclure les appels de méthode
      const funcCallMatches = line.matchAll(/(?<![>\w:])(\b\w+)\s*\(/g);
      for (const match of funcCallMatches) {
        const name = match[1];
        // Ignorer les mots-clés PHP, fonctions natives, et la fonction courante
        if (phpKeywords.has(name) || phpNativeFunctions.has(name)) {
          continue;
        }
        if (name === currentSimpleName) {
          continue; // Ignorer les appels récursifs
        }
        // Vérifier que ce n'est pas précédé par -> ou :: (appel de méthode)
        const matchIndex = match.index || 0;
        const prefix = line.substring(Math.max(0, matchIndex - 2), matchIndex);
        if (prefix.includes('->') || prefix.includes('::')) {
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

      // Appels de méthode: $obj->method( ou $this->method(
      const methodMatches = line.matchAll(/\$(\w+)->(\w+)\s*\(/g);
      for (const match of methodMatches) {
        const objName = match[1];
        const methodName = match[2];

        // Ignorer $this->currentMethod (appel récursif)
        if (objName === 'this' && methodName === currentSimpleName) {
          continue;
        }

        // Pour $this->method, on veut tracker les appels internes à la classe
        const isThisCall = objName === 'this';
        const callKey = isThisCall ? `this.${methodName}` : `${objName}.${methodName}`;
        if (!seen.has(callKey)) {
          seen.add(callKey);
          calls.push({
            name: methodName,
            line: i + 1,
            // Si c'est $this->, c'est un appel interne, sinon on cherche dans les imports
            fromModule: isThisCall ? undefined : importMap.get(objName),
            isThisCall,
            objectName: isThisCall ? undefined : objName,
          });
        }
      }

      // Appels statiques: ClassName::method(
      const staticMatches = line.matchAll(/(\w+)::(\w+)\s*\(/g);
      for (const match of staticMatches) {
        const className = match[1];
        const methodName = match[2];
        // Ignorer self:: et static:: pour les appels récursifs
        if ((className === 'self' || className === 'static') && methodName === currentSimpleName) {
          continue;
        }
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
   * Vérifie si un fichier est un fichier PHP (statique)
   * @deprecated Utiliser l'instance method isSupported() ou ParserFactory
   */
  static isSupported(filePath: string): boolean {
    return path.extname(filePath).toLowerCase() === '.php';
  }
}
