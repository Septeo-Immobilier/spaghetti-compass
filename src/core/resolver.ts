/**
 * Path resolution and module location classification
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import type { NodeLocation, ContextInfo } from '../types/index.js';
import { TsConfigResolver } from './tsconfig.js';
import { ComposerResolver } from './composer.js';
import { GoModResolver } from './go-mod.js';

/**
 * Resolves module paths and classifies their location
 */
export class PathResolver {
  private context: ContextInfo;
  private resolvedCache: Map<string, string | null> = new Map();
  private resolvedAllCache: Map<string, string[]> = new Map();
  private tsConfigResolver: TsConfigResolver | null = null;
  private composerResolver: ComposerResolver;
  private goModResolver: GoModResolver;

  constructor(context: ContextInfo) {
    this.context = context;
    if (context.tsConfigPath) {
      this.tsConfigResolver = new TsConfigResolver(context.tsConfigPath);
    }
    this.composerResolver = new ComposerResolver();
    this.goModResolver = new GoModResolver();
  }

  /**
   * Checks whether a specifier is an npm package (bare import).
   * When fromFile is a .go file, Go imports are never npm packages.
   */
  isNpmPackage(moduleSpecifier: string, fromFile?: string): boolean {
    // Go imports (.go files) are never npm packages
    if (fromFile && path.extname(fromFile).toLowerCase() === '.go') {
      return false;
    }

    // Bare imports: do not start with '.', '/', or a Windows path
    if (
      moduleSpecifier.startsWith('.') ||
      moduleSpecifier.startsWith('/') ||
      /^[a-zA-Z]:/.test(moduleSpecifier)
    ) {
      return false;
    }

    // If it's a TypeScript alias, it is NOT an npm package
    if (this.tsConfigResolver?.matchesAlias(moduleSpecifier)) {
      return false;
    }

    // Scoped packages (@org/package) or plain packages
    return /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*/.test(moduleSpecifier);
  }

  /**
   * Extracts the npm package name from a specifier
   */
  getPackageName(moduleSpecifier: string): string {
    // For @scope/package/path -> @scope/package
    // For package/path -> package
    const parts = moduleSpecifier.split('/');
    if (moduleSpecifier.startsWith('@')) {
      return parts.slice(0, 2).join('/');
    }
    return parts[0];
  }

  /**
   * Resolves a module path relative to a source file
   */
  resolve(moduleSpecifier: string, fromFile: string): string | null {
    const cacheKey = `${fromFile}:${moduleSpecifier}`;
    if (this.resolvedCache.has(cacheKey)) {
      return this.resolvedCache.get(cacheKey) ?? null;
    }

    let resolved: string | null = null;

    // Try TypeScript alias resolution first
    if (this.tsConfigResolver) {
      const aliasResult = this.tsConfigResolver.resolveAlias(moduleSpecifier, fromFile);
      if (aliasResult.resolved) {
        resolved = aliasResult.resolved;
        this.resolvedCache.set(cacheKey, resolved);
        return resolved;
      }
    }

    // Detect the source file's language to avoid a language-specific
    // resolution strategy intercepting another language's imports.
    // (e.g. `./foo` or `../bar` in TS/JS must NOT go through PHP resolution,
    //  which does not try .ts/.tsx extensions nor extensionless files.)
    const fromExt = path.extname(fromFile).toLowerCase();
    const isPythonSource = fromExt === '.py' || fromExt === '.pyi';
    const isPhpSource = fromExt === '.php';
    const isGoSource = fromExt === '.go';

    // Handle Python relative imports (.module, ..module, etc.)
    if (isPythonSource && this.isPythonRelativeImport(moduleSpecifier)) {
      resolved = this.resolvePythonRelativeImport(moduleSpecifier, fromFile);
      this.resolvedCache.set(cacheKey, resolved);
      return resolved;
    }

    // Handle PHP relative paths with __DIR__ (/../path/to/file.php)
    if (isPhpSource && this.isPhpRelativePath(moduleSpecifier)) {
      resolved = this.resolvePhpRelativePath(moduleSpecifier, fromFile);
      this.resolvedCache.set(cacheKey, resolved);
      return resolved;
    }

    // Handle PHP namespaces (App\Models\User, etc.)
    if (isPhpSource && this.isPhpNamespace(moduleSpecifier)) {
      resolved = this.resolvePhpNamespace(moduleSpecifier, fromFile);
      this.resolvedCache.set(cacheKey, resolved);
      return resolved;
    }

    // Handle Go imports — never fall through to TS/npm resolution
    if (isGoSource) {
      // resolveImport returns an absolute path for an internal import,
      // null for stdlib and third-party modules.
      resolved = this.goModResolver.resolveImport(moduleSpecifier, fromFile);
      this.resolvedCache.set(cacheKey, resolved);
      return resolved;
    }

    if (this.isNpmPackage(moduleSpecifier)) {
      // For npm packages, return the package name
      resolved = this.getPackageName(moduleSpecifier);
    } else {
      // Relative path resolution
      const fromDir = path.dirname(fromFile);
      const candidates = this.getResolutionCandidates(moduleSpecifier, fromDir);

      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          resolved = path.resolve(candidate);
          break;
        }
      }
    }

    this.resolvedCache.set(cacheKey, resolved);
    return resolved;
  }

  /**
   * Resolves a module to **every** file it corresponds to.
   * For a Go import, a package can group several source files; each of them
   * must appear as a reverse-edge target so the graph stays truthful
   * regardless of which file of the package is queried (`resolve()` itself
   * only returns one representative candidate for the package).
   * For every other language, falls back to `resolve()`: a single-element
   * result, or an empty array when `resolve()` returns `null`.
   */
  resolveAll(moduleSpecifier: string, fromFile: string): string[] {
    const cacheKey = `${fromFile}:${moduleSpecifier}`;
    if (this.resolvedAllCache.has(cacheKey)) {
      return this.resolvedAllCache.get(cacheKey)!;
    }

    // TypeScript alias resolution takes priority for every source, mirroring
    // `resolve()`'s ordering (lines 84-92 above), so the two entry points
    // never diverge on an aliased specifier.
    if (this.tsConfigResolver) {
      const aliasResult = this.tsConfigResolver.resolveAlias(moduleSpecifier, fromFile);
      if (aliasResult.resolved) {
        const result = [aliasResult.resolved];
        this.resolvedAllCache.set(cacheKey, result);
        return result;
      }
    }

    const isGoSource = path.extname(fromFile).toLowerCase() === '.go';

    let result: string[];
    if (isGoSource) {
      result = this.goModResolver.resolvePackageFiles(moduleSpecifier, fromFile);
    } else {
      const resolved = this.resolve(moduleSpecifier, fromFile);
      result = resolved ? [resolved] : [];
    }

    this.resolvedAllCache.set(cacheKey, result);
    return result;
  }

  /**
   * Checks whether a specifier is a Python relative import
   * (.module, ..module, .subpkg.module, etc.)
   */
  private isPythonRelativeImport(moduleSpecifier: string): boolean {
    // Python relative imports start with one or more dots
    return /^\.+[a-zA-Z_]/.test(moduleSpecifier) || moduleSpecifier === '.';
  }

  /**
   * Resolves a Python relative import to a file path
   * .module -> ./module.py
   * ..module -> ../module.py
   * .subpkg.module -> ./subpkg/module.py
   */
  private resolvePythonRelativeImport(moduleSpecifier: string, fromFile: string): string | null {
    // Count the leading dots to determine how far up to walk
    const dotMatch = moduleSpecifier.match(/^(\.+)/);
    if (!dotMatch) {
      return null;
    }

    const dots = dotMatch[1];
    const dotCount = dots.length;
    const modulePath = moduleSpecifier.slice(dotCount);

    // Start from the source file's directory
    let fromDir = path.dirname(fromFile);

    // Walk up one level for each extra dot beyond the first
    // . = same directory (current package)
    // .. = parent directory
    // ... = grandparent, etc.
    for (let i = 1; i < dotCount; i++) {
      fromDir = path.dirname(fromDir);
    }

    // Convert the Python module path into a file path
    // .services.user_service -> ./services/user_service.py
    const pathParts = modulePath.split('.');
    const relativePath = pathParts.join(path.sep);

    // Resolution candidates for Python
    const candidates = [
      path.join(fromDir, relativePath + '.py'),
      path.join(fromDir, relativePath + '.pyi'),
      path.join(fromDir, relativePath, '__init__.py'),
      path.join(fromDir, relativePath, '__init__.pyi'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return path.resolve(candidate);
      }
    }

    return null;
  }

  /**
   * Checks whether a specifier is a PHP relative path
   * Includes paths like /../path (used with __DIR__)
   */
  private isPhpRelativePath(moduleSpecifier: string): boolean {
    // Paths starting with ./ or ../
    if (moduleSpecifier.startsWith('./') || moduleSpecifier.startsWith('../')) {
      return true;
    }
    // Paths starting with / followed by .. (like /../Models/User.php used with __DIR__)
    if (moduleSpecifier.startsWith('/..')) {
      return true;
    }
    // Absolute paths starting with / and ending with .php
    if (moduleSpecifier.startsWith('/') && moduleSpecifier.endsWith('.php')) {
      return true;
    }
    return false;
  }

  /**
   * Resolves a PHP relative path to an absolute file path
   * /../Models/User.php -> /absolute/path/to/Models/User.php
   */
  private resolvePhpRelativePath(moduleSpecifier: string, fromFile: string): string | null {
    const fromDir = path.dirname(fromFile);

    // PHP paths using __DIR__ like /../path must be treated as relative
    // path.resolve treats /.. as an absolute path, so we prefix with .
    let normalizedSpec = moduleSpecifier;
    if (moduleSpecifier.startsWith('/')) {
      normalizedSpec = '.' + moduleSpecifier;
    }

    // Normalize the path (handle /../ and /./)
    const resolvedPath = path.resolve(fromDir, normalizedSpec);

    if (fs.existsSync(resolvedPath)) {
      return resolvedPath;
    }

    return null;
  }

  /**
   * Checks whether a specifier is a PHP namespace
   * Examples: App\Models\User, Symfony\Component\HttpFoundation\Response
   */
  private isPhpNamespace(moduleSpecifier: string): boolean {
    return ComposerResolver.isPhpNamespace(moduleSpecifier);
  }

  /**
   * Resolves a PHP namespace to a file path via composer.json PSR-4
   * App\Models\User -> /path/to/src/Models/User.php
   */
  private resolvePhpNamespace(moduleSpecifier: string, fromFile: string): string | null {
    const resolution = this.composerResolver.resolve(moduleSpecifier, fromFile);
    return resolution.filePath;
  }

  /**
   * Generates the resolution candidates for a module
   */
  private getResolutionCandidates(moduleSpecifier: string, fromDir: string): string[] {
    const basePath = path.resolve(fromDir, moduleSpecifier);
    const candidates: string[] = [];

    // TypeScript and JavaScript extensions
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

    // Exact path
    candidates.push(basePath);

    // TypeScript allows importing with .js while the file is .ts
    // Handle TypeScript-style resolution
    if (moduleSpecifier.endsWith('.js')) {
      const withoutJs = basePath.slice(0, -3);
      candidates.push(withoutJs + '.ts');
      candidates.push(withoutJs + '.tsx');
    } else if (moduleSpecifier.endsWith('.mjs')) {
      const withoutMjs = basePath.slice(0, -4);
      candidates.push(withoutMjs + '.mts');
    } else if (moduleSpecifier.endsWith('.cjs')) {
      const withoutCjs = basePath.slice(0, -4);
      candidates.push(withoutCjs + '.cts');
    }

    // With extensions
    for (const ext of extensions) {
      candidates.push(basePath + ext);
    }

    // Index files
    for (const ext of extensions) {
      candidates.push(path.join(basePath, `index${ext}`));
    }

    return candidates;
  }

  /**
   * Classifies the location of a resolved file.
   * When fromFile is a .go file, uses Go-aware classification:
   *   - resolved internal import (within the context) -> 'internal'
   *   - unresolved stdlib / third-party module -> 'third-party'
   */
  classifyLocation(resolvedPath: string | null, moduleSpecifier: string, fromFile?: string): NodeLocation {
    // Go-aware classification
    if (fromFile && path.extname(fromFile).toLowerCase() === '.go') {
      if (resolvedPath) {
        const normalizedResolved = path.resolve(resolvedPath);
        const projectRoot = this.context.projectRoot || this.context.rootPath;
        const normalizedContext = path.resolve(projectRoot);
        if (normalizedResolved.startsWith(normalizedContext + path.sep) ||
            normalizedResolved === normalizedContext) {
          return 'internal';
        }
      }
      // Stdlib or third-party module (resolvedPath is null) -> third-party
      return 'third-party';
    }

    // npm package -> third-party
    if (this.isNpmPackage(moduleSpecifier)) {
      return 'third-party';
    }

    // Unresolved -> default to third-party
    if (!resolvedPath) {
      return 'third-party';
    }

    // Normalize paths for comparison
    const normalizedResolved = path.resolve(resolvedPath);

    // Use projectRoot if available, otherwise rootPath
    const projectRoot = this.context.projectRoot || this.context.rootPath;
    const normalizedContext = path.resolve(projectRoot);

    // Inside node_modules -> third-party
    if (normalizedResolved.includes('node_modules')) {
      return 'third-party';
    }

    // Inside vendor/ (PHP Composer) -> third-party
    if (normalizedResolved.includes(path.sep + 'vendor' + path.sep) ||
        normalizedResolved.includes('/vendor/')) {
      return 'third-party';
    }

    // Inside the context -> internal
    if (normalizedResolved.startsWith(normalizedContext + path.sep)) {
      return 'internal';
    }

    // Outside the context but within the project -> external
    return 'external';
  }

  /**
   * Computes the path relative to the context
   */
  getRelativePath(absolutePath: string): string {
    const contextRoot = this.context.relativeTo || this.context.rootPath;
    return path.relative(contextRoot, absolutePath);
  }

  /**
   * Checks whether a file matches the include/exclude patterns
   */
  matchesPatterns(filePath: string): boolean {
    const relativePath = this.getRelativePath(filePath);

    // Check exclude patterns
    for (const pattern of this.context.excludePatterns) {
      if (this.matchGlob(relativePath, pattern)) {
        return false;
      }
    }

    // Check include patterns
    if (this.context.includePatterns.length === 0) {
      return true;
    }

    for (const pattern of this.context.includePatterns) {
      if (this.matchGlob(relativePath, pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Simplified glob matching
   */
  private matchGlob(filePath: string, pattern: string): boolean {
    // Convert the glob into a regex
    const regexPattern = pattern
      .replace(/\*\*/g, '{{GLOBSTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/{{GLOBSTAR}}/g, '.*')
      .replace(/\?/g, '.')
      .replace(/\./g, '\\.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath) || regex.test(filePath.replace(/\\/g, '/'));
  }
}
