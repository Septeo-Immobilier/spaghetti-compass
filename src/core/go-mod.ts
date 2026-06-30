/**
 * GoModResolver - Resolution des imports Go via go.mod
 *
 * Fournit une resolution deterministe et sans reseau des imports internes Go
 * en parcourant l'arborescence pour trouver le go.mod le plus proche.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Informations extraites d'un fichier go.mod.
 */
export interface GoModuleInfo {
  /** Chemin du module tel que declare dans la ligne `module <path>` */
  modulePath: string;
  /** Chemin absolu du repertoire contenant le go.mod */
  moduleRoot: string;
  /** Version Go de la ligne `go <version>`, ou null si absente */
  goVersion: string | null;
  /** Chemin absolu vers le fichier go.mod */
  filePath: string;
}

/**
 * Resout les imports Go internes vers des chemins de fichiers en utilisant
 * la declaration de module du go.mod le plus proche.
 */
export class GoModResolver {
  /** Cache des modules Go par repertoire (absolu) */
  private moduleCache: Map<string, GoModuleInfo | null> = new Map();

  /** Cache des resolutions import -> fichier: cle = moduleRoot + '\0' + importPath */
  private importCache: Map<string, string | null> = new Map();

  /**
   * Trouve le go.mod le plus proche en remontant depuis le fichier donne.
   * Strategie "nearest wins" pour les monorepos avec plusieurs go.mod.
   *
   * @param fromFile Chemin absolu vers le fichier source .go
   * @returns Informations du module le plus proche, ou null si aucun go.mod trouve
   */
  findModule(fromFile: string): GoModuleInfo | null {
    let currentDir: string;
    try {
      const stat = fs.statSync(fromFile);
      currentDir = stat.isDirectory() ? fromFile : path.dirname(fromFile);
    } catch {
      currentDir = path.dirname(fromFile);
    }

    const root = path.parse(currentDir).root;

    // Remonte jusqu'a la racine du systeme de fichiers
    let dir = currentDir;
    while (true) {
      // Verifier le cache par repertoire
      if (this.moduleCache.has(dir)) {
        return this.moduleCache.get(dir) ?? null;
      }

      const goModPath = path.join(dir, 'go.mod');
      if (fs.existsSync(goModPath)) {
        const info = this._parseGoMod(goModPath, dir);
        // Mettre en cache pour ce repertoire et tous les sous-repertoires deja traverses
        this._cacheForPath(currentDir, dir, info);
        return info;
      }

      if (dir === root) {
        // Aucun go.mod trouve jusqu'a la racine
        this._cacheForPath(currentDir, dir, null);
        return null;
      }

      const parent = path.dirname(dir);
      if (parent === dir) {
        // Securite: eviter une boucle infinie
        this._cacheForPath(currentDir, dir, null);
        return null;
      }
      dir = parent;
    }
  }

  /**
   * Resout un import Go interne vers un chemin de fichier .go representatif.
   *
   * @param importPath Le specifier d'import Go (ex: "github.com/example/app/internal/domain")
   * @param fromFile Chemin absolu du fichier source qui contient l'import
   * @returns Chemin absolu vers un fichier .go representatif du package, ou null
   */
  resolveImport(importPath: string, fromFile: string): string | null {
    const moduleInfo = this.findModule(fromFile);
    if (!moduleInfo) {
      return null;
    }

    const cacheKey = `${moduleInfo.moduleRoot}\0${importPath}`;
    if (this.importCache.has(cacheKey)) {
      return this.importCache.get(cacheKey) ?? null;
    }

    const result = this._resolveImportInternal(importPath, moduleInfo);
    this.importCache.set(cacheKey, result);
    return result;
  }

  /**
   * Determine si un import Go est issu de la bibliotheque standard.
   *
   * Heuristique (Decision 3 de research.md): un import est stdlib si le PREMIER
   * segment de chemin ne contient pas de point.
   * - `context`        -> true  (stdlib)
   * - `encoding/json`  -> true  (stdlib)
   * - `net/http`       -> true  (stdlib)
   * - `time`           -> true  (stdlib)
   * - `github.com/...` -> false (module tiers)
   * - `golang.org/x/…` -> false (module tiers)
   * - `go.uber.org/…`  -> false (module tiers)
   *
   * @param importPath Le specifier d'import Go
   * @returns true si c'est un package de la bibliotheque standard
   */
  isStandardLibrary(importPath: string): boolean {
    const firstSegment = importPath.split('/')[0];
    return !firstSegment.includes('.');
  }

  /**
   * Vide les caches (utile pour les tests).
   */
  clearCache(): void {
    this.moduleCache.clear();
    this.importCache.clear();
  }

  // ---------------------------------------------------------------------------
  // Methodes privees
  // ---------------------------------------------------------------------------

  /**
   * Parse le contenu d'un go.mod et retourne un GoModuleInfo.
   */
  private _parseGoMod(goModPath: string, moduleRoot: string): GoModuleInfo | null {
    let content: string;
    try {
      content = fs.readFileSync(goModPath, 'utf-8');
    } catch {
      return null;
    }

    let modulePath: string | null = null;
    let goVersion: string | null = null;

    for (const rawLine of content.split('\n')) {
      // Supprimer les commentaires de fin de ligne
      const commentIdx = rawLine.indexOf('//');
      const line = (commentIdx >= 0 ? rawLine.slice(0, commentIdx) : rawLine).trim();

      if (!modulePath) {
        const moduleMatch = line.match(/^module\s+("?)([^\s"]+)\1\s*$/);
        if (moduleMatch) {
          modulePath = moduleMatch[2];
        }
      }

      if (!goVersion) {
        const goMatch = line.match(/^go\s+(\S+)\s*$/);
        if (goMatch) {
          goVersion = goMatch[1];
        }
      }

      if (modulePath && goVersion) {
        break;
      }
    }

    if (!modulePath) {
      return null;
    }

    return {
      modulePath,
      moduleRoot,
      goVersion,
      filePath: goModPath,
    };
  }

  /**
   * Remplit le cache pour tous les repertoires depuis `start` jusqu'a `found`
   * avec la meme valeur, pour eviter de re-parcourir le meme chemin.
   */
  private _cacheForPath(
    start: string,
    found: string,
    info: GoModuleInfo | null,
  ): void {
    let dir = start;
    const root = path.parse(dir).root;
    while (true) {
      this.moduleCache.set(dir, info);
      if (dir === found || dir === root) {
        break;
      }
      const parent = path.dirname(dir);
      if (parent === dir) {
        break;
      }
      dir = parent;
    }
  }

  /**
   * Logique interne de resolution d'un import vers un fichier .go.
   */
  private _resolveImportInternal(
    importPath: string,
    moduleInfo: GoModuleInfo,
  ): string | null {
    const { modulePath, moduleRoot } = moduleInfo;

    // L'import doit commencer par le module path pour etre interne
    if (importPath !== modulePath && !importPath.startsWith(modulePath + '/')) {
      return null;
    }

    // Calculer le chemin relatif depuis la racine du module
    const suffix =
      importPath === modulePath ? '' : importPath.slice(modulePath.length + 1);

    const pkgDir = suffix ? path.join(moduleRoot, suffix) : moduleRoot;

    // Verifier que le repertoire existe
    try {
      const stat = fs.statSync(pkgDir);
      if (!stat.isDirectory()) {
        return null;
      }
    } catch {
      return null;
    }

    // Lire les fichiers .go dans ce repertoire
    let entries: string[];
    try {
      entries = fs.readdirSync(pkgDir);
    } catch {
      return null;
    }

    const goFiles = entries.filter(
      (f) =>
        f.endsWith('.go') &&
        !this._isInVendorOrCache(path.join(pkgDir, f)),
    );

    if (goFiles.length === 0) {
      return null;
    }

    // Preference: fichier non-test
    const nonTestFiles = goFiles.filter((f) => !f.endsWith('_test.go'));

    // Choisir parmi les fichiers non-test en priorite, sinon parmi tous
    const candidates = nonTestFiles.length > 0 ? nonTestFiles : goFiles;

    // Tri lexicographique pour resultat deterministe
    candidates.sort();

    return path.join(pkgDir, candidates[0]);
  }

  /**
   * Verifie si un chemin se trouve dans un repertoire vendor ou cache Go.
   */
  private _isInVendorOrCache(filePath: string): boolean {
    const segments = filePath.split(path.sep);
    return segments.includes('vendor') || segments.includes('.gomodcache');
  }
}
