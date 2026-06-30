/**
 * Analyse d'impact inverse (reverse dependency analysis).
 *
 * Là où `Analyzer.analyze` part d'un point d'entrée et descend vers ses dépendances
 * (« de quoi ce fichier dépend-il ? »), `ImpactAnalyzer` fait l'inverse : à partir d'un
 * fichier cible, il remonte vers tous les fichiers qui en dépendent (« qui serait impacté
 * si je modifie ce fichier ? »), et met en évidence les points d'entrée / routes touchés.
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import type { ContextInfo } from '../types/index.js';
import { PathResolver } from './resolver.js';
import { ParserFactory } from '../parser/index.js';

/** Une route (point d'entrée) impactée par une modification du fichier cible. */
export interface ImpactRoute {
  /** Chemin relatif au contexte */
  path: string;
  /** Chemin absolu */
  absolutePath: string;
  /**
   * Chaîne de dépendance la plus courte de la route vers la cible.
   * Chemins relatifs, du point d'entrée (premier) jusqu'à la cible (dernier).
   */
  chain: string[];
}

/** Résultat complet d'une analyse d'impact. */
export interface ImpactResult {
  /** Chemin relatif du fichier cible */
  target: string;
  /** Chemin absolu du fichier cible */
  targetAbsolute: string;
  /** Nombre de fichiers scannés dans le contexte */
  scannedFiles: number;
  /** Fichiers qui importent directement la cible (relatifs, triés) */
  directDependents: string[];
  /** Tous les fichiers qui dépendent transitivement de la cible (relatifs, triés) */
  dependents: string[];
  /** Routes / points d'entrée impactés, avec la chaîne vers la cible */
  routes: ImpactRoute[];
  /** Patterns utilisés pour identifier les routes */
  routePatterns: string[];
  /** true si la cible elle-même correspond à un pattern de route */
  targetIsRoute: boolean;
}

export interface ImpactOptions {
  /** Globs identifiant les routes / points d'entrée (ex: **\/*.controller.ts) */
  routePatterns: string[];
}

/**
 * Construit le graphe de dépendances inverse d'un contexte et calcule l'impact
 * d'une modification d'un fichier cible.
 */
export class ImpactAnalyzer {
  private context: ContextInfo;
  private resolver: PathResolver;
  private parserFactory: ParserFactory;

  constructor(context: ContextInfo) {
    this.context = context;
    this.resolver = new PathResolver(context);
    this.parserFactory = new ParserFactory();
  }

  /**
   * Analyse l'impact d'une modification du fichier `targetPath`.
   */
  analyze(targetPath: string, options: ImpactOptions): ImpactResult {
    const targetAbsolute = path.resolve(targetPath);

    // 1. Lister tous les fichiers supportés du contexte (en respectant include/exclude).
    const files = this.collectFiles(this.context.rootPath);

    // 2. Construire le graphe inverse: pour chaque fichier, résoudre ses imports internes
    //    et enregistrer une arête cible -> importeur.
    //    reverseDeps[F] = ensemble des fichiers qui importent F.
    const reverseDeps = new Map<string, Set<string>>();
    for (const file of files) {
      const imported = this.resolveInternalImports(file);
      for (const dep of imported) {
        let importers = reverseDeps.get(dep);
        if (!importers) {
          importers = new Set<string>();
          reverseDeps.set(dep, importers);
        }
        importers.add(file);
      }
    }

    // 3. BFS depuis la cible sur le graphe inverse pour collecter tous les dépendants.
    //    `parent[X]` pointe vers le fichier (plus proche de la cible) que X importe,
    //    ce qui permet de reconstruire la chaîne route -> cible.
    const parent = new Map<string, string | null>();
    parent.set(targetAbsolute, null);
    const queue: string[] = [targetAbsolute];
    const directDependents = new Set<string>(reverseDeps.get(targetAbsolute) ?? []);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const importers = reverseDeps.get(current);
      if (!importers) continue;
      for (const importer of importers) {
        if (!parent.has(importer)) {
          parent.set(importer, current);
          queue.push(importer);
        }
      }
    }

    // L'ensemble des dépendants exclut la cible elle-même.
    const dependentSet = new Set(parent.keys());
    dependentSet.delete(targetAbsolute);

    // 4. Identifier les routes impactées parmi les dépendants.
    const routes: ImpactRoute[] = [];
    for (const dep of dependentSet) {
      if (this.matchesAnyPattern(dep, options.routePatterns)) {
        routes.push({
          path: this.rel(dep),
          absolutePath: dep,
          chain: this.buildChain(dep, parent),
        });
      }
    }

    routes.sort((a, b) => a.path.localeCompare(b.path));
    const dependents = [...dependentSet].map((f) => this.rel(f)).sort();
    const direct = [...directDependents].map((f) => this.rel(f)).sort();

    return {
      target: this.rel(targetAbsolute),
      targetAbsolute,
      scannedFiles: files.length,
      directDependents: direct,
      dependents,
      routes,
      routePatterns: options.routePatterns,
      targetIsRoute: this.matchesAnyPattern(targetAbsolute, options.routePatterns),
    };
  }

  /**
   * Reconstruit la chaîne de dépendance d'un fichier jusqu'à la cible
   * en suivant les pointeurs `parent`.
   */
  private buildChain(from: string, parent: Map<string, string | null>): string[] {
    const chain: string[] = [];
    let current: string | null = from;
    const seen = new Set<string>();
    while (current && !seen.has(current)) {
      seen.add(current);
      chain.push(this.rel(current));
      current = parent.get(current) ?? null;
    }
    return chain;
  }

  /**
   * Résout les imports internes (dans le contexte) d'un fichier vers des chemins absolus.
   */
  private resolveInternalImports(file: string): string[] {
    const parser = this.parserFactory.getParser(file);
    if (!parser.isSupported(file)) {
      return [];
    }

    let parseResult;
    try {
      parseResult = parser.parse(file, { extractFunctions: false });
    } catch {
      return [];
    }

    const result: string[] = [];
    const specifiers = [
      ...parseResult.imports.map((i) => i.moduleSpecifier),
      ...parseResult.exports
        .filter((e) => e.kind === 're-export' && e.fromModule)
        .map((e) => e.fromModule as string),
    ];

    for (const spec of specifiers) {
      const resolved = this.resolver.resolve(spec, file);
      if (!resolved) continue;
      const location = this.resolver.classifyLocation(resolved, spec);
      if (location === 'internal') {
        result.push(path.resolve(resolved));
      }
    }
    return result;
  }

  /**
   * Parcourt récursivement un répertoire et retourne les fichiers supportés
   * respectant les patterns include/exclude du contexte.
   */
  private collectFiles(root: string): string[] {
    const files: string[] = [];
    const walk = (dir: string): void => {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          // Élagage rapide des répertoires lourds courants.
          if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'vendor') {
            continue;
          }
          walk(full);
        } else if (entry.isFile()) {
          if (!this.parserFactory.isSupported(full)) continue;
          if (this.matchesContextPatterns(full)) {
            files.push(path.resolve(full));
          }
        }
      }
    };
    walk(path.resolve(root));
    return files;
  }

  /** Chemin relatif au contexte. */
  private rel(absolutePath: string): string {
    return this.resolver.getRelativePath(absolutePath);
  }

  /**
   * Applique les patterns include/exclude du contexte à un fichier.
   * (N'utilise pas PathResolver.matchesPatterns dont le matchGlob a un bug d'échappement.)
   */
  private matchesContextPatterns(filePath: string): boolean {
    const relativePath = this.rel(filePath);
    for (const pattern of this.context.excludePatterns) {
      if (matchGlob(relativePath, pattern)) return false;
    }
    if (this.context.includePatterns.length === 0) return true;
    return this.context.includePatterns.some((p) => matchGlob(relativePath, p));
  }

  /** Teste si un chemin (relatif au contexte) correspond à l'un des globs. */
  private matchesAnyPattern(absolutePath: string, patterns: string[]): boolean {
    const relativePath = this.rel(absolutePath);
    return patterns.some((p) => matchGlob(relativePath, p));
  }
}

/**
 * Matching glob simplifié. Supporte `**` (globstar, traverse les répertoires),
 * `*` (dans un segment) et `?`. Échappe d'abord les caractères regex spéciaux
 * pour éviter le bug d'ordre où le `.` du `.*` (issu de `**`) serait ré-échappé.
 * `**\/` matche zéro répertoire ou plus (donc `**\/*.ts` matche aussi un fichier racine).
 */
function matchGlob(filePath: string, pattern: string): boolean {
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // échappe les spéciaux, sauf * ? /
    .replace(/\*\*\//g, '{{GLOBSTAR_SLASH}}')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/{{GLOBSTAR_SLASH}}/g, '(?:.*/)?')
    .replace(/{{GLOBSTAR}}/g, '.*');
  const regex = new RegExp(`^${regexPattern}$`);
  const normalized = filePath.replace(/\\/g, '/');
  return regex.test(normalized);
}
