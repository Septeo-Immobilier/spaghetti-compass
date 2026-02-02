/**
 * Résolution des chemins et classification des modules
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import type { NodeLocation, ContextInfo } from '../types/index';

/**
 * Résout les chemins de modules et classifie leur localisation
 */
export class PathResolver {
  private context: ContextInfo;
  private resolvedCache: Map<string, string | null> = new Map();

  constructor(context: ContextInfo) {
    this.context = context;
  }

  /**
   * Vérifie si un specifier est un package npm (bare import)
   */
  isNpmPackage(moduleSpecifier: string): boolean {
    // Bare imports: ne commencent pas par '.', '/', ou un chemin Windows
    if (
      moduleSpecifier.startsWith('.') ||
      moduleSpecifier.startsWith('/') ||
      /^[a-zA-Z]:/.test(moduleSpecifier)
    ) {
      return false;
    }

    // Packages scoped (@org/package) ou packages simples
    return /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*/.test(moduleSpecifier);
  }

  /**
   * Extrait le nom du package npm depuis un specifier
   */
  getPackageName(moduleSpecifier: string): string {
    // Pour @scope/package/path -> @scope/package
    // Pour package/path -> package
    const parts = moduleSpecifier.split('/');
    if (moduleSpecifier.startsWith('@')) {
      return parts.slice(0, 2).join('/');
    }
    return parts[0];
  }

  /**
   * Résout un chemin de module relatif à un fichier source
   */
  resolve(moduleSpecifier: string, fromFile: string): string | null {
    const cacheKey = `${fromFile}:${moduleSpecifier}`;
    if (this.resolvedCache.has(cacheKey)) {
      return this.resolvedCache.get(cacheKey) ?? null;
    }

    let resolved: string | null = null;

    if (this.isNpmPackage(moduleSpecifier)) {
      // Pour les packages npm, on retourne le nom du package
      resolved = this.getPackageName(moduleSpecifier);
    } else {
      // Résolution de chemin relatif
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
   * Génère les candidats de résolution pour un module
   */
  private getResolutionCandidates(moduleSpecifier: string, fromDir: string): string[] {
    const basePath = path.resolve(fromDir, moduleSpecifier);
    const candidates: string[] = [];

    // Extensions TypeScript et JavaScript
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

    // Chemin exact
    candidates.push(basePath);

    // TypeScript permet d'importer avec .js mais le fichier est .ts
    // Gérer la résolution style TypeScript
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

    // Avec extensions
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
   * Classifie la localisation d'un fichier résolu
   */
  classifyLocation(resolvedPath: string | null, moduleSpecifier: string): NodeLocation {
    // Package npm -> third-party
    if (this.isNpmPackage(moduleSpecifier)) {
      return 'third-party';
    }

    // Non résolu -> on considère third-party par défaut
    if (!resolvedPath) {
      return 'third-party';
    }

    // Normaliser les chemins pour comparaison
    const normalizedResolved = path.resolve(resolvedPath);
    const normalizedContext = path.resolve(this.context.rootPath);

    // Dans node_modules -> third-party
    if (normalizedResolved.includes('node_modules')) {
      return 'third-party';
    }

    // Dans le contexte -> internal
    if (normalizedResolved.startsWith(normalizedContext + path.sep)) {
      return 'internal';
    }

    // Hors contexte mais dans le projet -> external
    return 'external';
  }

  /**
   * Calcule le chemin relatif au contexte
   */
  getRelativePath(absolutePath: string): string {
    const contextRoot = this.context.relativeTo || this.context.rootPath;
    return path.relative(contextRoot, absolutePath);
  }

  /**
   * Vérifie si un fichier correspond aux patterns include/exclude
   */
  matchesPatterns(filePath: string): boolean {
    const relativePath = this.getRelativePath(filePath);

    // Vérifier les patterns d'exclusion
    for (const pattern of this.context.excludePatterns) {
      if (this.matchGlob(relativePath, pattern)) {
        return false;
      }
    }

    // Vérifier les patterns d'inclusion
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
   * Matching glob simplifié
   */
  private matchGlob(filePath: string, pattern: string): boolean {
    // Convertir le glob en regex
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
