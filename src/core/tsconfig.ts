/**
 * Résolution des alias TypeScript via tsconfig.json
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import ts from 'typescript';
import type { TsConfigInfo, PathMapping, ResolvedAlias } from '../types/index.js';

/**
 * Cache pour les tsconfig parsés
 */
class TsConfigCache {
  private cache = new Map<string, ts.ParsedCommandLine | null>();

  get(configPath: string): ts.ParsedCommandLine | null {
    if (!this.cache.has(configPath)) {
      this.cache.set(configPath, this.load(configPath));
    }
    return this.cache.get(configPath)!;
  }

  private load(configPath: string): ts.ParsedCommandLine | null {
    try {
      const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
      if (configFile.error) {
        return null;
      }

      const basePath = path.dirname(configPath);
      return ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        basePath
      );
    } catch {
      return null;
    }
  }
}

/**
 * Résout les alias de chemin TypeScript définis dans tsconfig.json
 */
export class TsConfigResolver {
  private configInfo: TsConfigInfo | null = null;
  private cache = new TsConfigCache();

  constructor(configPath: string | null) {
    if (configPath) {
      this.configInfo = this.loadConfig(configPath);
    }
  }

  /**
   * Trouve le package.json le plus proche depuis un fichier
   */
  static findPackageJson(fromFile: string): string | null {
    let dir = path.dirname(fromFile);
    const root = path.parse(dir).root;

    while (dir !== root) {
      const pkgPath = path.join(dir, 'package.json');
      if (fs.existsSync(pkgPath)) {
        return pkgPath;
      }
      const parentDir = path.dirname(dir);
      if (parentDir === dir) {
        break;
      }
      dir = parentDir;
    }

    return null;
  }

  /**
   * Trouve le tsconfig.json le plus proche depuis un fichier
   */
  static findTsConfig(fromFile: string): string | null {
    let dir = path.dirname(fromFile);
    const root = path.parse(dir).root;

    while (dir !== root) {
      const configPath = path.join(dir, 'tsconfig.json');
      if (fs.existsSync(configPath)) {
        return configPath;
      }
      const parentDir = path.dirname(dir);
      if (parentDir === dir) {
        break;
      }
      dir = parentDir;
    }

    return null;
  }

  /**
   * Charge et parse un tsconfig.json
   */
  private loadConfig(configPath: string): TsConfigInfo | null {
    const parsed = this.cache.get(configPath);
    if (!parsed) {
      return null;
    }

    const basePath = path.dirname(configPath);
    const baseUrl = parsed.options.baseUrl
      ? path.resolve(basePath, parsed.options.baseUrl)
      : null;

    const paths = this.extractPathMappings(parsed.options.paths || {}, baseUrl || basePath);

    // Extraire le chemin extends s'il est une string
    const extendsValue = parsed.options.extends;
    const extendsFrom = typeof extendsValue === 'string' ? extendsValue : null;

    return {
      configPath,
      baseUrl,
      paths,
      extendsFrom,
    };
  }

  /**
   * Extrait les mappings de paths depuis la config TypeScript
   */
  private extractPathMappings(
    paths: ts.MapLike<string[]>,
    basePath: string
  ): PathMapping[] {
    const mappings: PathMapping[] = [];

    for (const [pattern, targets] of Object.entries(paths)) {
      if (!targets || targets.length === 0) {
        continue;
      }

      const hasWildcard = pattern.includes('*');
      const regex = this.compilePatternRegex(pattern);

      mappings.push({
        pattern,
        regex,
        targets: targets.map((t) => path.resolve(basePath, t)),
        hasWildcard,
      });
    }

    return mappings;
  }

  /**
   * Compile un pattern avec wildcard en regex
   * Note: Dans TypeScript paths, * matche tout le reste du chemin (pas juste un segment)
   */
  private compilePatternRegex(pattern: string): RegExp {
    // Échapper les caractères spéciaux sauf *
    const escaped = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '(.*)');  // * matche tout, y compris les /

    return new RegExp(`^${escaped}$`);
  }

  /**
   * Résout un alias vers un chemin de fichier
   */
  resolveAlias(specifier: string, _fromFile: string): ResolvedAlias {
    if (!this.configInfo) {
      return {
        original: specifier,
        resolved: null,
        matchedPattern: null,
        error: 'No tsconfig loaded',
      };
    }

    // Chercher un pattern qui matche
    for (const mapping of this.configInfo.paths) {
      const match = specifier.match(mapping.regex);
      if (!match) {
        continue;
      }

      // Essayer chaque cible jusqu'à trouver un fichier existant
      for (const target of mapping.targets) {
        let resolvedPath: string;

        if (mapping.hasWildcard) {
          // Remplacer le wildcard par la capture
          const captured = match[1] || '';
          resolvedPath = target.replace(/\*/g, captured);
        } else {
          // Pattern exact
          resolvedPath = target;
        }

        // Chercher le fichier avec extensions
        const filePath = this.findFileWithExtension(resolvedPath);
        if (filePath) {
          return {
            original: specifier,
            resolved: filePath,
            matchedPattern: mapping.pattern,
            error: null,
          };
        }
      }
    }

    return {
      original: specifier,
      resolved: null,
      matchedPattern: null,
      error: 'No matching pattern or file not found',
    };
  }

  /**
   * Trouve un fichier avec les extensions TypeScript/JavaScript
   */
  private findFileWithExtension(basePath: string): string | null {
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'];

    // Chemin exact
    if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
      return path.resolve(basePath);
    }

    // Avec extensions
    for (const ext of extensions) {
      const candidate = basePath + ext;
      if (fs.existsSync(candidate)) {
        return path.resolve(candidate);
      }
    }

    // Index files
    for (const ext of extensions) {
      const candidate = path.join(basePath, `index${ext}`);
      if (fs.existsSync(candidate)) {
        return path.resolve(candidate);
      }
    }

    return null;
  }

  /**
   * Vérifie si un specifier matche un alias configuré
   */
  matchesAlias(specifier: string): boolean {
    if (!this.configInfo) {
      return false;
    }

    for (const mapping of this.configInfo.paths) {
      if (mapping.regex.test(specifier)) {
        return true;
      }
    }

    return false;
  }
}
