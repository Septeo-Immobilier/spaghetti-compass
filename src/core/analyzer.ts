/**
 * Analyseur de dépendances - orchestration de l'analyse
 */

import * as path from 'node:path';
import type {
  ContextInfo,
  DependencyGraph,
  GraphNode,
  GraphEdge,
  ImportInfo,
  ExportInfo,
} from '../types/index.js';
import { DependencyGraphBuilder } from './graph.js';
import { PathResolver } from './resolver.js';
import { TypeScriptParser } from '../parser/typescript.js';
import { PhpParser } from '../parser/php.js';
import { PythonParser } from '../parser/python.js';
import { TsConfigResolver } from './tsconfig.js';
import { LspProviderFactory, type LspProvider } from './lsp/index.js';
import type { ParseResult } from '../types/index.js';

/**
 * Options d'analyse
 */
export interface AnalyzerOptions {
  /** Inclure les relations transitives */
  transitive?: boolean;
  /** Nom de fonction à analyser (optionnel) */
  functionName?: string;
}

/**
 * Analyseur de dépendances
 */
export class Analyzer {
  private resolver: PathResolver;
  private tsParser: TypeScriptParser;
  private phpParser: PhpParser;
  private pythonParser: PythonParser;
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

  constructor(context: ContextInfo) {
    // Découvrir automatiquement tsconfig et package.json si non fournis
    let enhancedContext = { ...context };

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
    this.tsParser = new TypeScriptParser();
    this.phpParser = new PhpParser();
    this.pythonParser = new PythonParser();
    this.graphBuilder = new DependencyGraphBuilder(enhancedContext);
    this.lspFactory = new LspProviderFactory();
  }

  /**
   * Analyse un fichier et construit le graphe de dépendances
   */
  async analyze(entryPath: string, options: AnalyzerOptions = {}): Promise<DependencyGraph> {
    const absoluteEntry = path.resolve(entryPath);
    this.graphBuilder.setEntryPoint(absoluteEntry);

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
    if (TypeScriptParser.isSupported(filePath)) {
      return this.tsParser.parse(filePath, options);
    }
    if (PhpParser.isSupported(filePath)) {
      return this.phpParser.parse(filePath, options);
    }
    if (PythonParser.isSupported(filePath)) {
      return this.pythonParser.parse(filePath, options);
    }
    return null;
  }

  /**
   * Vérifie si un fichier est supporté par un des parsers
   */
  static isSupported(filePath: string): boolean {
    return (
      TypeScriptParser.isSupported(filePath) ||
      PhpParser.isSupported(filePath) ||
      PythonParser.isSupported(filePath)
    );
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
      await this.analyzeFunctionDependencies(filePath, options.functionName, parseResult);
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
      if (!Analyzer.isSupported(filePath)) {
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
    const { moduleSpecifier, type, line, resolved, importedNames } = importInfo;

    // Résoudre le chemin du module
    const resolvedPath = this.resolver.resolve(moduleSpecifier, fromFile);
    const location = this.resolver.classifyLocation(resolvedPath, moduleSpecifier);

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
      type: this.resolver.isNpmPackage(moduleSpecifier) ? 'external-module' : 'file',
      name: this.resolver.isNpmPackage(moduleSpecifier)
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
    const edge: GraphEdge = {
      from: fromFile,
      to: targetId,
      type,
      resolved: resolved && !!resolvedPath,
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
      Analyzer.isSupported(resolvedPath)
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
    const location = this.resolver.classifyLocation(resolvedPath, exportInfo.fromModule);

    const targetId = resolvedPath || exportInfo.fromModule;
    const targetNode: GraphNode = {
      id: targetId,
      type: this.resolver.isNpmPackage(exportInfo.fromModule) ? 'external-module' : 'file',
      name: this.resolver.isNpmPackage(exportInfo.fromModule)
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
      Analyzer.isSupported(resolvedPath)
    ) {
      await this.analyzeFile(resolvedPath, options);
    }
  }

  /**
   * Analyse les dépendances d'une fonction spécifique
   * Utilise le LSP pour résoudre les définitions des appels de fonction
   */
  private async analyzeFunctionDependencies(
    filePath: string,
    functionName: string,
    parseResult: ParseResult
  ): Promise<void> {
    // Trouver la fonction - chercher d'abord le nom exact, puis avec le format Class.methodName
    let func = parseResult.functions.find((f) => f.name === functionName);

    // Si pas trouvé, chercher avec le format Class.methodName (pour les méthodes de classe)
    if (!func) {
      func = parseResult.functions.find((f) => f.name.endsWith(`.${functionName}`));
    }

    if (!func) {
      return;
    }

    // S'assurer que le fichier source est chargé dans le provider LSP
    if (this.lspProvider) {
      this.lspProvider.addFile(filePath);
    }

    // Créer le noeud fonction
    const funcId = `${filePath}:${functionName}`;
    const funcNode: GraphNode = {
      id: funcId,
      type: 'function',
      name: functionName,
      path: this.resolver.getRelativePath(filePath),
      location: this.resolver.classifyLocation(filePath, filePath),
    };
    this.graphBuilder.addNode(funcNode);
    this.graphBuilder.setEntryPoint(funcId);

    // Traiter les appels de fonction avec résolution LSP
    for (const call of func.calls) {
      // Utiliser le LSP pour trouver la définition de la fonction appelée
      const definition = this.lspProvider
        ? await this.lspProvider.getDefinitionFromImport(
            filePath,
            call.name,
            call.fromModule || ''
          )
        : null;

      let targetPath: string | undefined;
      let targetLine: number | undefined;
      let targetColumn: number | undefined;
      let nodeId: string;
      let nodePath: string | undefined;
      let location: 'internal' | 'external' | 'third-party';

      if (definition) {
        // Définition trouvée via LSP
        targetPath = definition.filePath;
        targetLine = definition.line;
        targetColumn = definition.column;
        nodeId = `${definition.filePath}:${call.name}`;
        nodePath = this.resolver.getRelativePath(definition.filePath);
        location = this.resolver.classifyLocation(definition.filePath, definition.filePath);
      } else {
        // Fallback: utiliser les informations d'origine
        nodeId = call.fromModule ? `${call.fromModule}:${call.name}` : call.name;
        location = call.fromModule ? 'external' : 'internal';
      }

      const callNode: GraphNode = {
        id: nodeId,
        type: 'function',
        name: call.name,
        path: nodePath,
        location,
        line: targetLine,
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
      };
      this.graphBuilder.addEdge(edge);
    }
  }

  /**
   * Libère les ressources
   */
  async dispose(): Promise<void> {
    await this.lspFactory.disposeAll();
  }
}
