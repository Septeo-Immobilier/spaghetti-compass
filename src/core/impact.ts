/**
 * Reverse dependency (impact) analysis.
 *
 * Where `Analyzer.analyze` starts from an entry point and walks down into its
 * dependencies ("what does this file depend on?"), `ImpactAnalyzer` does the
 * opposite: starting from a target file, it walks up to every file that depends
 * on it ("who would be impacted if I change this file?"), and highlights the
 * entry points / routes touched.
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import type { ContextInfo } from '../types/index.js';
import { PathResolver } from './resolver.js';
import { ParserFactory } from '../parser/index.js';

/** A route (entry point) impacted by a change to the target file. */
export interface ImpactRoute {
  /** Path relative to the context */
  path: string;
  /** Absolute path */
  absolutePath: string;
  /**
   * Shortest dependency chain from the route to the target.
   * Relative paths, from the entry point (first) to the target (last).
   */
  chain: string[];
}

/** Complete result of an impact analysis. */
export interface ImpactResult {
  /** Relative path of the target file */
  target: string;
  /** Absolute path of the target file */
  targetAbsolute: string;
  /** Number of files scanned in the context */
  scannedFiles: number;
  /** Files that directly import the target (relative, sorted) */
  directDependents: string[];
  /** All files that transitively depend on the target (relative, sorted) */
  dependents: string[];
  /** Routes / entry points impacted, with the chain to the target */
  routes: ImpactRoute[];
  /** Patterns used to identify routes */
  routePatterns: string[];
  /** true if the target itself matches a route pattern */
  targetIsRoute: boolean;
  /**
   * 'package' for a Go target (edges are resolved at package granularity),
   * 'file' for every other language (edges are resolved to the exact file).
   */
  granularity: 'file' | 'package';
  /** Human-readable caveat for a package-granular result; null otherwise. */
  granularityNote: string | null;
}

export interface ImpactOptions {
  /** Globs identifying routes / entry points (e.g. **\/*.controller.ts) */
  routePatterns: string[];
}

/**
 * Builds the reverse dependency graph of a context and computes the impact
 * of a change to a target file.
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
   * Analyzes the impact of a change to `targetPath`.
   */
  analyze(targetPath: string, options: ImpactOptions): ImpactResult {
    const targetAbsolute = path.resolve(targetPath);

    // 1. List every supported file in the context (respecting include/exclude).
    const files = this.collectFiles(this.context.rootPath);

    // 2. Build the reverse graph: for each file, resolve its internal imports
    //    and record an edge target -> importer.
    //    reverseDeps[F] = set of files that import F.
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

    // 3. BFS from the target over the reverse graph to collect every dependent.
    //    `parent[X]` points to the file (closest to the target) that X imports,
    //    which lets us reconstruct the route -> target chain.
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

    // The dependent set excludes the target itself.
    const dependentSet = new Set(parent.keys());
    dependentSet.delete(targetAbsolute);

    // 4. Identify the impacted routes among the dependents.
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

    // A Go target's transitive closure is entirely Go: resolveInternalImports
    // only emits an edge when the importer's own parser resolved the specifier,
    // so a Go importer only ever points at Go files. This makes it sound to
    // derive granularity once, from the target's parser, rather than per edge.
    const isGoTarget = this.parserFactory.getParser(targetAbsolute).name === 'go';
    const granularity: 'file' | 'package' = isGoTarget ? 'package' : 'file';
    const granularityNote = isGoTarget
      ? this.buildGoGranularityNote(targetAbsolute, dependents.length > 0)
      : null;

    return {
      target: this.rel(targetAbsolute),
      targetAbsolute,
      scannedFiles: files.length,
      directDependents: direct,
      dependents,
      routes,
      routePatterns: options.routePatterns,
      targetIsRoute: this.matchesAnyPattern(targetAbsolute, options.routePatterns),
      granularity,
      granularityNote,
    };
  }

  /**
   * Reconstructs the dependency chain from a file up to the target
   * by following the `parent` pointers.
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
   * Resolves a file's internal imports (within the context) to absolute paths.
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
      const resolvedAll = this.resolver.resolveAll(spec, file);
      for (const resolved of resolvedAll) {
        const location = this.resolver.classifyLocation(resolved, spec, file);
        if (location === 'internal') {
          result.push(path.resolve(resolved));
        }
      }
    }
    return result;
  }

  /**
   * Recursively walks a directory and returns the supported files
   * matching the context's include/exclude patterns.
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
          // Quick pruning of common heavy directories.
          if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'vendor' || entry.name === '.gomodcache') {
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
    // Deterministic order: `fs.readdirSync` order is filesystem-dependent
    // (e.g. ext4 returns hash order), and reverseDeps/BFS below assigns each
    // dependent's `parent` on a first-wins basis, so an unsorted `files`
    // array would make `routes[].chain` vary across machines and runs.
    files.sort();
    return files;
  }

  /** Path relative to the context. */
  private rel(absolutePath: string): string {
    return this.resolver.getRelativePath(absolutePath);
  }

  /**
   * Builds the `granularityNote` for a Go target: `contracts/impact-cli.md`
   * `NOTE-PKG-JSON-NONEMPTY` / `NOTE-PKG-JSON-EMPTY`, with `<pkg>` substituted
   * by the target's package directory relative to the context.
   */
  private buildGoGranularityNote(targetAbsolute: string, hasDependents: boolean): string {
    const pkg = this.goPackageName(targetAbsolute);
    return hasDependents
      ? `Go analysis resolves imports at package granularity: every non-test file of ${pkg} shares this dependents set.`
      : `Go analysis resolves imports at package granularity: no file in the scanned context imports ${pkg}, but this is a package-level observation and may be incomplete.`;
  }

  /**
   * Human-readable package name for the granularity note: the package
   * directory relative to the context, normalised to `/`-separated
   * segments. When the target sits at the context root (`this.rel()`'s
   * dirname is `.`), falls back to the directory's own name so the note
   * never renders the unreadable `.`.
   */
  private goPackageName(targetAbsolute: string): string {
    const relDir = path.dirname(this.rel(targetAbsolute));
    if (relDir === '.' || relDir === '') {
      return path.basename(path.dirname(targetAbsolute));
    }
    return relDir.split(path.sep).join('/');
  }

  /**
   * Applies the context's include/exclude patterns to a file.
   * (Does not use PathResolver.matchesPatterns, whose matchGlob has an
   * escaping bug.)
   */
  private matchesContextPatterns(filePath: string): boolean {
    const relativePath = this.rel(filePath);
    for (const pattern of this.context.excludePatterns) {
      if (matchGlob(relativePath, pattern)) return false;
    }
    if (this.context.includePatterns.length === 0) return true;
    return this.context.includePatterns.some((p) => matchGlob(relativePath, p));
  }

  /** Tests whether a path (relative to the context) matches any of the globs. */
  private matchesAnyPattern(absolutePath: string, patterns: string[]): boolean {
    const relativePath = this.rel(absolutePath);
    return patterns.some((p) => matchGlob(relativePath, p));
  }
}

/**
 * Simplified glob matching. Supports `**` (globstar, crosses directories),
 * `*` (within a segment) and `?`. Escapes regex-special characters first
 * to avoid the ordering bug where the `.` of `.*` (from `**`) would get
 * re-escaped.
 * `**\/` matches zero or more directories (so `**\/*.ts` also matches a
 * root-level file).
 */
function matchGlob(filePath: string, pattern: string): boolean {
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape specials, except * ? /
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
