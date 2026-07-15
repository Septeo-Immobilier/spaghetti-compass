/**
 * Analyseur de dépendances - orchestration de l'analyse
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import type {
  ContextInfo,
  DependencyGraph,
  GraphNode,
  GraphEdge,
  ImportInfo,
  ExportInfo,
  CallType,
} from '../types/index.js';
import { DependencyGraphBuilder } from './graph.js';
import { PathResolver } from './resolver.js';
import { ParserFactory } from '../parser/index.js';
import { TsConfigResolver } from './tsconfig.js';
import { LspProviderFactory, type LspProvider, type LspProviderStatus } from './lsp/index.js';
import { ComposerResolver } from './composer.js';
import { findPhpConstructorLine } from './lsp/php-constructor.js';
import type { ParseResult } from '../types/index.js';

/**
 * Options d'analyse
 */
export interface AnalyzerOptions {
  /** Inclure les relations transitives */
  transitive?: boolean;
  /** Nom de fonction à analyser (optionnel) */
  functionName?: string;
  /** Profondeur maximale d'exploration récursive (défaut: 5) */
  maxDepth?: number;
  /** Limiter l'exploration au fichier d'entrée uniquement */
  sameFileOnly?: boolean;
}

/**
 * Analyseur de dépendances
 */
export class Analyzer {
  private resolver: PathResolver;
  private parserFactory: ParserFactory;
  private graphBuilder: DependencyGraphBuilder;
  private visited: Set<string> = new Set();
  /** Cache des exports par fichier pour éviter de re-parser */
  private exportsCache: Map<string, ExportInfo[]> = new Map();
  /** Factory pour créer les providers LSP */
  private lspFactory: LspProviderFactory;
  /** Provider LSP courant (initialisé lors de l'analyse) */
  private lspProvider: LspProvider | null = null;
  /** Contexte d'analyse enrichi */
  private enhancedContext: ContextInfo;
  /** Set des fonctions déjà visitées (pour éviter les boucles dans l'exploration récursive) */
  private visitedFunctions: Set<string> = new Set();
  /** Options d'analyse courantes */
  private currentOptions: AnalyzerOptions = {};
  /** ComposerResolver pour résolution PHP PSR-4 sans LSP */
  private composerResolver: ComposerResolver = new ComposerResolver();

  constructor(context: ContextInfo) {
    // Découvrir automatiquement tsconfig et package.json si non fournis
    const enhancedContext = { ...context };

    if (!enhancedContext.tsConfigPath && !enhancedContext.projectRoot) {
      // Essayer de trouver depuis le rootPath
      const tsConfigPath = TsConfigResolver.findTsConfig(context.rootPath);
      const packageJsonPath = TsConfigResolver.findPackageJson(context.rootPath);

      if (tsConfigPath) {
        enhancedContext.tsConfigPath = tsConfigPath;
      }

      if (packageJsonPath) {
        enhancedContext.projectRoot = path.dirname(packageJsonPath);
      } else if (tsConfigPath) {
        // Fallback sur le dossier du tsconfig
        enhancedContext.projectRoot = path.dirname(tsConfigPath);
      }
    }

    this.enhancedContext = enhancedContext;
    this.resolver = new PathResolver(enhancedContext);
    this.parserFactory = new ParserFactory();
    this.graphBuilder = new DependencyGraphBuilder(enhancedContext);
    this.lspFactory = new LspProviderFactory();
  }

  /**
   * Analyse un fichier et construit le graphe de dépendances
   */
  async analyze(entryPath: string, options: AnalyzerOptions = {}): Promise<DependencyGraph> {
    const absoluteEntry = path.resolve(entryPath);
    this.graphBuilder.setEntryPoint(absoluteEntry);

    // Sauvegarder les options et réinitialiser les sets
    this.currentOptions = {
      ...options,
      maxDepth: options.maxDepth ?? 5,
      sameFileOnly: options.sameFileOnly ?? false,
    };
    this.visitedFunctions.clear();

    // Obtenir le provider LSP approprié pour ce fichier
    this.lspProvider = await this.lspFactory.getProvider(
      absoluteEntry,
      this.enhancedContext.projectRoot || this.enhancedContext.rootPath,
      this.enhancedContext.tsConfigPath
    );

    // Analyser le fichier d'entrée
    await this.analyzeFile(absoluteEntry, options);

    return this.graphBuilder.build();
  }

  /**
   * Parse un fichier avec le parser approprié selon son extension
   */
  private parseFile(filePath: string, options: { extractFunctions?: boolean } = {}): ParseResult | null {
    const parser = this.parserFactory.getParser(filePath);
    if (!parser.isSupported(filePath)) {
      return null;
    }
    return parser.parse(filePath, options);
  }

  /**
   * Vérifie si un fichier est supporté par un des parsers
   */
  isSupported(filePath: string): boolean {
    return this.parserFactory.isSupported(filePath);
  }

  /**
   * Analyse un fichier et ses dépendances
   */
  private async analyzeFile(filePath: string, options: AnalyzerOptions): Promise<void> {
    // Éviter les boucles infinies
    if (this.visited.has(filePath)) {
      return;
    }
    this.visited.add(filePath);

    // Parser le fichier
    const parseResult = this.parseFile(filePath, {
      extractFunctions: !!options.functionName,
    });

    if (!parseResult) {
      return; // Fichier non supporté
    }

    // Créer le noeud pour ce fichier
    const location = this.resolver.classifyLocation(filePath, filePath);
    const node: GraphNode = {
      id: filePath,
      type: 'file',
      name: path.basename(filePath),
      path: this.resolver.getRelativePath(filePath),
      location,
    };
    this.graphBuilder.addNode(node);

    // Si on analyse une fonction spécifique
    if (options.functionName) {
      await this.analyzeFunctionDependencies(filePath, options.functionName, parseResult, 0);
      return;
    }

    // Traiter les imports
    for (const importInfo of parseResult.imports) {
      await this.processImport(filePath, importInfo, options);
    }

    // Traiter les exports (pour les re-exports)
    for (const exportInfo of parseResult.exports) {
      if (exportInfo.kind === 're-export' && exportInfo.fromModule) {
        await this.processReExport(filePath, exportInfo, options);
      }
    }
  }

  /**
   * Trouve la ligne de définition d'un symbole exporté dans un fichier
   */
  private async findExportDefinitionLine(
    filePath: string,
    symbolName: string
  ): Promise<number | undefined> {
    // Vérifier le cache
    let exports = this.exportsCache.get(filePath);

    if (!exports) {
      // Parser le fichier pour obtenir les exports
      if (!this.isSupported(filePath)) {
        return undefined;
      }

      try {
        const parseResult = this.parseFile(filePath);
        if (!parseResult) {
          return undefined;
        }
        exports = parseResult.exports;
        this.exportsCache.set(filePath, exports);
      } catch {
        return undefined;
      }
    }

    // Chercher l'export correspondant
    const exportInfo = exports.find(e => e.name === symbolName);
    return exportInfo?.line;
  }

  /**
   * Traite un import et crée les noeuds/arêtes correspondants
   */
  private async processImport(
    fromFile: string,
    importInfo: ImportInfo,
    options: AnalyzerOptions
  ): Promise<void> {
    const { moduleSpecifier, type, line, importedNames } = importInfo;

    // Résoudre le chemin du module
    const resolvedPath = this.resolver.resolve(moduleSpecifier, fromFile);
    const location = this.resolver.classifyLocation(resolvedPath, moduleSpecifier, fromFile);

    // Vérifier si c'est un alias TypeScript résolu
    let aliasInfo: { original: string; pattern: string; resolvedVia: string } | undefined;
    const tsConfigResolver = (this.resolver as any).tsConfigResolver;
    if (tsConfigResolver) {
      const aliasResult = tsConfigResolver.resolveAlias(moduleSpecifier, fromFile);
      if (aliasResult.matchedPattern) {
        aliasInfo = {
          original: aliasResult.original,
          pattern: aliasResult.matchedPattern,
          resolvedVia: 'tsconfig.json',
        };
      }
    }

    // Créer le noeud cible
    const targetId = resolvedPath || moduleSpecifier;
    const targetNode: GraphNode = {
      id: targetId,
      type: this.resolver.isNpmPackage(moduleSpecifier, fromFile) ? 'external-module' : 'file',
      name: this.resolver.isNpmPackage(moduleSpecifier, fromFile)
        ? this.resolver.getPackageName(moduleSpecifier)
        : path.basename(targetId),
      path: resolvedPath ? this.resolver.getRelativePath(resolvedPath) : undefined,
      location,
    };
    this.graphBuilder.addNode(targetNode);

    // Trouver la ligne de définition du premier symbole importé dans le fichier cible
    let targetLine: number | undefined;
    if (resolvedPath && importedNames.length > 0 && location === 'internal') {
      // Prendre le premier nom importé (ex: pour "import { A, B }", on prend A)
      const firstImportedName = importedNames[0].replace(/^type /, ''); // Enlever "type " si présent
      targetLine = await this.findExportDefinitionLine(resolvedPath, firstImportedName);
    }

    // Créer l'arête
    // L'import est considéré comme résolu si on a trouvé le fichier cible
    const edge: GraphEdge = {
      from: fromFile,
      to: targetId,
      type,
      resolved: !!resolvedPath,
      line,
      targetLine,
      importedNames: importedNames.length > 0 ? importedNames : undefined,
      aliasInfo,
    };
    this.graphBuilder.addEdge(edge);

    // Analyser récursivement si transitive et fichier interne résolu
    if (
      options.transitive !== false &&
      resolvedPath &&
      location === 'internal' &&
      this.isSupported(resolvedPath)
    ) {
      await this.analyzeFile(resolvedPath, options);
    }
  }

  /**
   * Traite un re-export
   */
  private async processReExport(
    fromFile: string,
    exportInfo: ExportInfo,
    options: AnalyzerOptions
  ): Promise<void> {
    if (!exportInfo.fromModule) return;

    const resolvedPath = this.resolver.resolve(exportInfo.fromModule, fromFile);
    const location = this.resolver.classifyLocation(resolvedPath, exportInfo.fromModule, fromFile);

    const targetId = resolvedPath || exportInfo.fromModule;
    const targetNode: GraphNode = {
      id: targetId,
      type: this.resolver.isNpmPackage(exportInfo.fromModule, fromFile) ? 'external-module' : 'file',
      name: this.resolver.isNpmPackage(exportInfo.fromModule, fromFile)
        ? this.resolver.getPackageName(exportInfo.fromModule)
        : path.basename(targetId),
      path: resolvedPath ? this.resolver.getRelativePath(resolvedPath) : undefined,
      location,
    };
    this.graphBuilder.addNode(targetNode);

    const edge: GraphEdge = {
      from: fromFile,
      to: targetId,
      type: 're-export',
      resolved: !!resolvedPath,
      line: exportInfo.line,
      importedNames: exportInfo.name !== '*' ? [exportInfo.name] : undefined,
    };
    this.graphBuilder.addEdge(edge);

    // Analyser récursivement
    if (
      options.transitive !== false &&
      resolvedPath &&
      location === 'internal' &&
      this.isSupported(resolvedPath)
    ) {
      await this.analyzeFile(resolvedPath, options);
    }
  }

  /**
   * Vérifie si un chemin de fichier pointe vers une bibliothèque native/runtime
   * (fichiers TypeScript lib.*.d.ts, node_modules, etc.)
   */
  private isNativeLibraryPath(filePath: string): boolean {
    // Fichiers de définition TypeScript natifs (lib.es*.d.ts, lib.dom.d.ts, etc.)
    if (/[\\/]lib\.[^/\\]+\.d\.ts$/.test(filePath)) {
      return true;
    }

    // Fichiers dans node_modules (sauf si c'est notre propre code)
    if (filePath.includes('node_modules')) {
      return true;
    }

    // Fichiers de définition de types (@types/*)
    if (filePath.includes('@types')) {
      return true;
    }

    return false;
  }

  /**
   * Vérifie si un appel de fonction est une méthode native sur une variable locale
   * (ex: array.find, string.split, etc.) ou une classe/fonction native du langage
   */
  private isNativeMethodCall(callName: string, fromModule: string | undefined): boolean {
    // Classes natives PHP courantes
    const phpNativeClasses = new Set([
      'DateTime', 'DateTimeImmutable', 'DateInterval', 'DatePeriod', 'DateTimeZone',
      'Exception', 'Error', 'TypeError', 'ValueError', 'ArgumentCountError',
      'stdClass', 'ArrayObject', 'ArrayIterator', 'Iterator', 'Generator',
      'Closure', 'ReflectionClass', 'ReflectionMethod', 'ReflectionProperty',
      'PDO', 'PDOStatement', 'PDOException',
      'SplFileInfo', 'SplFileObject', 'DirectoryIterator', 'RecursiveDirectoryIterator',
      'JsonException', 'RuntimeException', 'InvalidArgumentException', 'LogicException',
    ]);

    // Vérifier si c'est une classe native PHP
    if (phpNativeClasses.has(callName)) {
      return true;
    }

    // Si c'est importé d'un module, ce n'est pas une méthode native locale
    if (fromModule) {
      return false;
    }

    // Méthodes natives communes sur les types de base (JavaScript/TypeScript)
    const nativeMethods = new Set([
      // Array methods
      'find', 'filter', 'map', 'reduce', 'forEach', 'some', 'every', 'includes',
      'indexOf', 'lastIndexOf', 'push', 'pop', 'shift', 'unshift', 'slice', 'splice',
      'concat', 'join', 'reverse', 'sort', 'flat', 'flatMap', 'fill', 'copyWithin',
      'entries', 'keys', 'values', 'at', 'findIndex', 'findLast', 'findLastIndex',
      'toReversed', 'toSorted', 'toSpliced', 'with',
      // String methods
      'split', 'trim', 'trimStart', 'trimEnd', 'toLowerCase', 'toUpperCase',
      'substring', 'substr', 'slice', 'replace', 'replaceAll', 'match', 'matchAll',
      'search', 'charAt', 'charCodeAt', 'codePointAt', 'startsWith', 'endsWith',
      'padStart', 'padEnd', 'repeat', 'normalize', 'localeCompare',
      // Object methods
      'hasOwnProperty', 'toString', 'valueOf', 'toLocaleString',
      // Promise methods
      'then', 'catch', 'finally',
      // Map/Set methods
      'get', 'set', 'has', 'delete', 'clear', 'size',
    ]);

    // Vérifier si c'est un appel de méthode (obj.method)
    if (callName.includes('.')) {
      const methodName = callName.split('.').pop();
      if (methodName && nativeMethods.has(methodName)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Trouve la ligne de définition d'un symbole PHP dans un fichier.
   * Cherche d'abord une méthode, puis une classe/interface/trait/enum.
   */
  private findPhpDefinitionLine(filePath: string, symbolName: string): number | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const escapedName = symbolName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // 1. Chercher une méthode (function methodName)
      const methodPattern = new RegExp(
        `^\\s*(?:public|private|protected)\\s+(?:static\\s+)?function\\s+${escapedName}\\s*\\(`
      );
      for (let i = 0; i < lines.length; i++) {
        if (methodPattern.test(lines[i])) {
          return i + 1;
        }
      }

      // 2. Chercher une classe/interface/trait/enum
      const classOnlyPattern = new RegExp(
        `^\\s*(?:abstract\\s+)?(?:final\\s+)?(?:readonly\\s+)?class\\s+${escapedName}\\b`
      );
      const otherKindPatterns = [
        new RegExp(`^\\s*interface\\s+${escapedName}\\b`),
        new RegExp(`^\\s*trait\\s+${escapedName}\\b`),
        new RegExp(`^\\s*enum\\s+${escapedName}\\b`),
      ];
      for (let i = 0; i < lines.length; i++) {
        if (classOnlyPattern.test(lines[i])) {
          const constructorLine = findPhpConstructorLine(content, symbolName);
          return constructorLine ?? i + 1;
        }
        for (const pattern of otherKindPatterns) {
          if (pattern.test(lines[i])) {
            return i + 1;
          }
        }
      }
    } catch {
      // Fichier illisible
    }
    return null;
  }

  /**
   * Trouve une méthode interne dans le même fichier (pour résolution sans LSP)
   * Cherche les méthodes de la même classe (ex: AuthService.findUserByEmail pour AuthService.login)
   */
  private findInternalMethod(
    methodName: string,
    currentFunctionName: string,
    parseResult: ParseResult
  ): { name: string; line: number } | null {
    // Extraire le nom de la classe de la fonction courante (ex: "AuthService" de "AuthService.login")
    const classParts = currentFunctionName.split('.');
    const className = classParts.length > 1 ? classParts[0] : null;

    if (className) {
      // Chercher une méthode de la même classe
      const fullMethodName = `${className}.${methodName}`;
      const method = parseResult.functions.find((f) => f.name === fullMethodName);
      if (method) {
        return { name: method.name, line: method.line };
      }
    }

    // Chercher une fonction au niveau module (sans classe)
    const func = parseResult.functions.find((f) => f.name === methodName);
    if (func) {
      return { name: func.name, line: func.line };
    }

    return null;
  }

  /**
   * Cache des fichiers parsés pour éviter de re-parser
   */
  private parsedFilesCache: Map<string, ParseResult> = new Map();

  /**
   * Trouve une méthode dans les fichiers importés (pour PHP sans LSP)
   * Cherche dans les fichiers require/include
   */
  private findMethodInImportedFiles(
    methodName: string,
    sourceFilePath: string,
    parseResult: ParseResult
  ): { filePath: string; name: string; line: number } | null {
    // Parcourir les imports de type require
    for (const imp of parseResult.imports) {
      if (imp.type !== 'require') continue;

      // Résoudre le chemin du fichier importé
      const resolvedPath = this.resolver.resolve(imp.moduleSpecifier, sourceFilePath);
      if (!resolvedPath || !this.isSupported(resolvedPath)) continue;

      // Parser le fichier importé (avec cache)
      let importedParseResult = this.parsedFilesCache.get(resolvedPath);
      if (!importedParseResult) {
        const parsed = this.parseFile(resolvedPath, { extractFunctions: true });
        if (parsed) {
          importedParseResult = parsed;
          this.parsedFilesCache.set(resolvedPath, parsed);
        }
      }

      if (!importedParseResult) continue;

      // Chercher la méthode dans ce fichier
      // Format: ClassName.methodName
      const method = importedParseResult.functions.find((f) => {
        const parts = f.name.split('.');
        const funcMethodName = parts.length > 1 ? parts[1] : parts[0];
        return funcMethodName === methodName;
      });

      if (method) {
        return {
          filePath: resolvedPath,
          name: method.name,
          line: method.line,
        };
      }
    }

    return null;
  }

  /**
   * Classifie un appel de fonction
   */
  private classifyCall(
    sourceFilePath: string,
    targetFilePath: string | undefined,
    fromModule: string | undefined
  ): CallType {
    if (!targetFilePath) {
      // Si pas de fichier cible résolu, c'est probablement externe
      return fromModule ? 'external' : 'internal-same-file';
    }

    // Vérifier si c'est le même fichier
    if (targetFilePath === sourceFilePath) {
      return 'internal-same-file';
    }

    // Vérifier si c'est un fichier externe (node_modules, etc.)
    const location = this.resolver.classifyLocation(targetFilePath, targetFilePath);
    if (location === 'external' || location === 'third-party') {
      return 'external';
    }

    return 'internal-other-file';
  }

  /**
   * Analyse les dépendances d'une fonction spécifique de manière récursive
   * Utilise le LSP pour résoudre les définitions des appels de fonction
   */
  private async analyzeFunctionDependencies(
    filePath: string,
    functionName: string,
    parseResult: ParseResult,
    currentDepth: number = 0
  ): Promise<void> {
    const maxDepth = this.currentOptions.maxDepth ?? 5;
    const sameFileOnly = this.currentOptions.sameFileOnly ?? false;

    // Vérifier la profondeur maximale
    if (currentDepth > maxDepth) {
      return;
    }

    // Trouver la fonction - chercher d'abord le nom exact, puis avec le format Class.methodName
    let func = parseResult.functions.find((f) => f.name === functionName);

    // Si pas trouvé, chercher avec le format Class.methodName (pour les méthodes de classe)
    if (!func) {
      func = parseResult.functions.find((f) => f.name.endsWith(`.${functionName}`));
    }

    if (!func) {
      return;
    }

    // Utiliser le nom complet de la fonction (avec classe si applicable)
    const fullFunctionName = func.name;

    // Créer un ID unique pour cette fonction
    const funcId = `${filePath}:${fullFunctionName}`;

    // Vérifier si on a déjà visité cette fonction (éviter les boucles)
    if (this.visitedFunctions.has(funcId)) {
      return;
    }
    this.visitedFunctions.add(funcId);

    // S'assurer que le fichier source est chargé dans le provider LSP
    if (this.lspProvider) {
      this.lspProvider.addFile(filePath);
    }

    // Créer le noeud fonction
    const funcNode: GraphNode = {
      id: funcId,
      type: 'function',
      name: fullFunctionName,
      path: this.resolver.getRelativePath(filePath),
      location: this.resolver.classifyLocation(filePath, filePath),
      line: func.line,
      depth: currentDepth,
    };
    this.graphBuilder.addNode(funcNode);

    // Si c'est le point d'entrée (depth 0), définir comme entry point
    if (currentDepth === 0) {
      this.graphBuilder.setEntryPoint(funcId);
    }

    // Traiter les appels de fonction avec résolution LSP
    for (const call of func.calls) {
      // Ignorer les méthodes natives sur les variables locales (array.find, etc.)
      if (this.isNativeMethodCall(call.name, call.fromModule)) {
        continue;
      }

      // Ignorer les appels récursifs directs (même fonction)
      if (call.name === fullFunctionName ||
        call.name === functionName ||
        (call.isThisCall && fullFunctionName.endsWith(`.${call.name}`))) {
        continue;
      }

      let definition: { filePath: string; line: number; column?: number } | null = null;

      // Stratégie de résolution selon le type d'appel
      // Déterminer si c'est un appel sur une propriété (this.property.method vs this.method)
      const isPropertyCall = call.isThisCall && call.name.includes('.');
      const simpleMethodName = call.name.includes('.') ? call.name.split('.').pop()! : call.name;

      if (call.isThisCall && !isPropertyCall) {
        // Pour this.method() direct, chercher dans la même classe via le parser
        const internalMethod = this.findInternalMethod(call.name, fullFunctionName, parseResult);
        if (internalMethod) {
          definition = {
            filePath: filePath,
            line: internalMethod.line,
            column: 1,
          };
        } else if (this.lspProvider) {
          // Fallback: utiliser le LSP pour this.method()
          definition = await this.lspProvider.getDefinitionByName(filePath, call.name);
        }
      } else if (isPropertyCall && this.lspProvider) {
        // Pour this.property.method(), utiliser le LSP pour résoudre le type
        // On cherche la position de l'appel dans le fichier pour obtenir la définition
        definition = await this.lspProvider.getDefinitionByName(filePath, simpleMethodName);

        // Si pas trouvé, essayer avec le nom complet (property.method)
        if (!definition) {
          definition = await this.lspProvider.getDefinitionByName(filePath, call.name);
        }
      } else if (call.objectName) {
        // Pour $obj->method, chercher dans les fichiers importés
        const importedMethod = this.findMethodInImportedFiles(call.name, filePath, parseResult);
        if (importedMethod) {
          definition = {
            filePath: importedMethod.filePath,
            line: importedMethod.line,
            column: 1,
          };
        } else if (this.lspProvider) {
          // Fallback: utiliser le LSP
          definition = await this.lspProvider.getDefinitionByName(filePath, call.name);
        }
      } else if (this.lspProvider) {
        // Pour les autres appels, utiliser le LSP
        definition = await this.lspProvider.getDefinitionFromImport(
          filePath,
          call.name,
          call.fromModule || ''
        );
      }

      // Fallback sans LSP ou si LSP n'a rien trouvé
      if (!definition) {
        // Si fromModule est un namespace PHP, résoudre via Composer PSR-4
        if (call.fromModule && ComposerResolver.isPhpNamespace(call.fromModule)) {
          const resolution = this.composerResolver.resolve(call.fromModule, filePath);
          if (resolution.filePath) {
            // Chercher la méthode dans le fichier, sinon la classe
            const defLine = this.findPhpDefinitionLine(resolution.filePath, call.name);
            if (defLine) {
              definition = {
                filePath: resolution.filePath,
                line: defLine,
                column: 1,
              };
            }
          }
        }

        // Pour les imports Go avec fromModule (appels sélecteur: pkg.Func),
        // résoudre le fichier cible via PathResolver et y chercher la fonction.
        if (!definition && call.fromModule && path.extname(filePath).toLowerCase() === '.go') {
          const resolvedModFile = this.resolver.resolve(call.fromModule, filePath);
          if (resolvedModFile) {
            // Le nom de fonction dans le call peut être "pkg.FuncName" — extraire la partie après le point
            const funcName = call.name.includes('.')
              ? call.name.split('.').pop()!
              : call.name;
            let targetParseResult = this.parsedFilesCache.get(resolvedModFile);
            if (!targetParseResult) {
              const parsed = this.parseFile(resolvedModFile, { extractFunctions: true });
              if (parsed) {
                targetParseResult = parsed;
                this.parsedFilesCache.set(resolvedModFile, parsed);
              }
            }
            if (targetParseResult) {
              const func = targetParseResult.functions.find(
                (f) => f.name === funcName || f.name.endsWith(`.${funcName}`)
              );
              if (func) {
                definition = {
                  filePath: resolvedModFile,
                  line: func.line,
                  column: 1,
                };
              }
            }
          }
        }

        // Sinon, essayer de résoudre via le parser (méthodes internes)
        if (!definition) {
          const internalMethod = this.findInternalMethod(call.name, fullFunctionName, parseResult);
          if (internalMethod) {
            definition = {
              filePath: filePath,
              line: internalMethod.line,
              column: 1,
            };
          }
        }
      }

      // Ignorer les définitions qui pointent vers des bibliothèques natives
      if (definition && this.isNativeLibraryPath(definition.filePath)) {
        continue;
      }

      // Classifier l'appel
      const callType = this.classifyCall(filePath, definition?.filePath, call.fromModule);

      let targetPath: string | undefined;
      let targetLine: number | undefined;
      let targetColumn: number | undefined;
      let nodeId: string;
      let nodePath: string | undefined;
      let location: 'internal' | 'external' | 'third-party';

      // Déterminer le nom de la fonction cible pour l'ID du noeud
      let targetFunctionName = call.name;

      if (definition) {
        // Définition trouvée via parser ou LSP
        targetPath = definition.filePath;
        targetLine = definition.line;
        targetColumn = definition.column;
        nodePath = this.resolver.getRelativePath(definition.filePath);
        location = this.resolver.classifyLocation(definition.filePath, definition.filePath);

        // Chercher le vrai nom de la fonction dans le fichier cible pour avoir un ID cohérent
        let targetParseResult = parseResult;
        if (definition.filePath !== filePath) {
          const cached = this.parsedFilesCache.get(definition.filePath);
          if (cached) {
            targetParseResult = cached;
          } else {
            const parsed = this.parseFile(definition.filePath, { extractFunctions: true });
            if (parsed) {
              targetParseResult = parsed;
              this.parsedFilesCache.set(definition.filePath, parsed);
            }
          }
        }

        // Trouver la fonction par sa ligne de définition ou par son nom
        if (targetParseResult) {
          const methodName = call.name.includes('.') ? call.name.split('.').pop()! : call.name;
          const funcByLine = targetParseResult.functions.find(f => f.line === definition.line);
          const funcByName = targetParseResult.functions.find(
            f => f.name === methodName || f.name.endsWith(`.${methodName}`)
          );
          const targetFunc = funcByLine || funcByName;
          if (targetFunc) {
            targetFunctionName = targetFunc.name;
          }
        }

        nodeId = `${definition.filePath}:${targetFunctionName}`;
      } else {
        // Fallback: utiliser les informations d'origine
        nodeId = call.fromModule ? `${call.fromModule}:${call.name}` : `${filePath}:${call.name}`;
        location = call.fromModule ? 'external' : 'internal';
      }

      const callNode: GraphNode = {
        id: nodeId,
        type: 'function',
        name: targetFunctionName,
        path: nodePath,
        location,
        line: targetLine,
        depth: currentDepth + 1,
      };
      this.graphBuilder.addNode(callNode);

      const edge: GraphEdge = {
        from: funcId,
        to: nodeId,
        type: 'call',
        resolved: !!definition,
        line: call.line, // Ligne de l'appel dans le fichier source
        targetPath, // Chemin du fichier où la fonction est définie
        targetLine, // Ligne de définition
        targetColumn, // Colonne de définition
        callType, // Classification de l'appel
      };
      this.graphBuilder.addEdge(edge);

      // Explorer récursivement les fonctions internes (si pas externe et pas sameFileOnly ou même fichier)
      if (
        definition &&
        callType !== 'external' &&
        (!sameFileOnly || callType === 'internal-same-file')
      ) {
        // Parser le fichier cible si différent du fichier courant
        let targetParseResult = parseResult;
        if (definition.filePath !== filePath) {
          const parsed = this.parseFile(definition.filePath, { extractFunctions: true });
          if (parsed) {
            targetParseResult = parsed;
            // Mettre en cache
            this.parsedFilesCache.set(definition.filePath, parsed);
          } else {
            continue; // Impossible de parser le fichier cible
          }
        }

        // Déterminer le nom de la fonction à chercher dans le fichier cible
        // Le call.name peut être "propertyName.methodName" mais la fonction dans le fichier
        // cible sera "ClassName.methodName"
        let targetFunctionName = call.name;

        // Si c'est un appel via propriété (ex: userService.getAll), extraire juste le nom de méthode
        if (call.name.includes('.')) {
          const methodName = call.name.split('.').pop()!;
          // Chercher d'abord avec le nom de méthode simple
          const funcByMethod = targetParseResult.functions.find(
            f => f.name === methodName || f.name.endsWith(`.${methodName}`)
          );
          if (funcByMethod) {
            targetFunctionName = funcByMethod.name;
          }
        }

        // Explorer récursivement cette fonction
        await this.analyzeFunctionDependencies(
          definition.filePath,
          targetFunctionName,
          targetParseResult,
          currentDepth + 1
        );
      }
    }
  }

  /**
   * Libère les ressources
   */
  async dispose(): Promise<void> {
    await this.lspFactory.disposeAll();
  }

  /**
   * Returns collected LSP provider statuses for degraded-mode warnings.
   * Called by the CLI after analyze() to emit warnings to stderr (FR-001/008).
   *
   * @returns Array of LspProviderStatus (one per resolved provider type)
   * @see {@link LspProviderStatus}
   */
  getLspStatuses(): LspProviderStatus[] {
    return this.lspFactory.getStatuses();
  }
}
