/**
 * GoModResolver - Resolution of Go imports via go.mod
 *
 * Provides deterministic, network-free resolution of internal Go imports
 * by walking up the directory tree to find the nearest go.mod.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Information extracted from a go.mod file.
 */
export interface GoModuleInfo {
  /** Module path as declared on the `module <path>` line */
  modulePath: string;
  /** Absolute path of the directory containing the go.mod */
  moduleRoot: string;
  /** Go version from the `go <version>` line, or null if absent */
  goVersion: string | null;
  /** Absolute path to the go.mod file */
  filePath: string;
}

/**
 * Resolves internal Go imports to file paths using the module declaration
 * of the nearest go.mod.
 */
export class GoModResolver {
  /** Cache of Go modules by directory (absolute) */
  private moduleCache: Map<string, GoModuleInfo | null> = new Map();

  /** Cache of import -> every file of the package: key = moduleRoot + '\0' + importPath */
  private packageFilesCache: Map<string, string[]> = new Map();

  /**
   * Finds the nearest go.mod by walking up from the given file.
   * "Nearest wins" strategy for monorepos with several go.mod files.
   *
   * @param fromFile Absolute path to the .go source file
   * @returns Information of the nearest module, or null if none found
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

    // Walk up to the filesystem root
    let dir = currentDir;
    while (true) {
      // Check the per-directory cache
      if (this.moduleCache.has(dir)) {
        return this.moduleCache.get(dir) ?? null;
      }

      const goModPath = path.join(dir, 'go.mod');
      if (fs.existsSync(goModPath)) {
        const info = this._parseGoMod(goModPath, dir);
        // Cache for this directory and every already-walked subdirectory
        this._cacheForPath(currentDir, dir, info);
        return info;
      }

      if (dir === root) {
        // No go.mod found up to the root
        this._cacheForPath(currentDir, dir, null);
        return null;
      }

      const parent = path.dirname(dir);
      if (parent === dir) {
        // Safety: avoid an infinite loop
        this._cacheForPath(currentDir, dir, null);
        return null;
      }
      dir = parent;
    }
  }

  /**
   * Resolves an internal Go import to a representative .go file path.
   *
   * @param importPath The Go import specifier (e.g. "github.com/example/app/internal/domain")
   * @param fromFile Absolute path of the source file containing the import
   * @returns Absolute path to a representative .go file of the package, or null
   */
  resolveImport(importPath: string, fromFile: string): string | null {
    return this.resolvePackageFiles(importPath, fromFile)[0] ?? null;
  }

  /**
   * Resolves an internal Go import to every .go file of the target package
   * (non-test files first, falling back to the full set if the package has
   * none). Unlike `resolveImport()`, which returns only one representative
   * file, this method returns the whole set of package files: this is what
   * guarantees that two files of the same package report the same
   * dependents (FR-001, FR-003, FR-009).
   *
   * @param importPath The Go import specifier
   * @param fromFile Absolute path of the source file containing the import
   * @returns Absolute paths, sorted, to the package's .go files, or `[]`
   */
  resolvePackageFiles(importPath: string, fromFile: string): string[] {
    const moduleInfo = this.findModule(fromFile);
    if (!moduleInfo) {
      return [];
    }

    const cacheKey = `${moduleInfo.moduleRoot}\0${importPath}`;
    if (this.packageFilesCache.has(cacheKey)) {
      return this.packageFilesCache.get(cacheKey) ?? [];
    }

    const result = this._resolvePackageFilesInternal(importPath, moduleInfo);
    this.packageFilesCache.set(cacheKey, result);
    return result;
  }

  /**
   * Determines whether a Go import comes from the standard library.
   *
   * Heuristic (Decision 3 of research.md): an import is stdlib if its FIRST
   * path segment contains no dot.
   * - `context`        -> true  (stdlib)
   * - `encoding/json`  -> true  (stdlib)
   * - `net/http`       -> true  (stdlib)
   * - `time`           -> true  (stdlib)
   * - `github.com/...` -> false (third-party module)
   * - `golang.org/x/...` -> false (third-party module)
   * - `go.uber.org/...`  -> false (third-party module)
   *
   * @param importPath The Go import specifier
   * @returns true if it's a standard library package
   */
  isStandardLibrary(importPath: string): boolean {
    const firstSegment = importPath.split('/')[0];
    return !firstSegment.includes('.');
  }

  /**
   * Clears the caches (useful for tests).
   */
  clearCache(): void {
    this.moduleCache.clear();
    this.packageFilesCache.clear();
  }

  // ---------------------------------------------------------------------------
  // Private methods
  // ---------------------------------------------------------------------------

  /**
   * Parses the content of a go.mod and returns a GoModuleInfo.
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
      // Strip trailing line comments
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
   * Fills the cache for every directory from `start` up to `found`
   * with the same value, to avoid re-walking the same path.
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
   * Internal logic for selecting a package's .go candidates: filters `.go`,
   * excludes `vendor/`/`.gomodcache/`, prefers non-test files with a
   * fallback to the full set if the package has none. Shared by
   * `resolveImport()` (via `resolvePackageFiles()[0]`) and
   * `resolvePackageFiles()` so the two rules can never diverge.
   */
  private _resolvePackageFilesInternal(
    importPath: string,
    moduleInfo: GoModuleInfo,
  ): string[] {
    const { modulePath, moduleRoot } = moduleInfo;

    // The import must start with the module path to be internal
    if (importPath !== modulePath && !importPath.startsWith(modulePath + '/')) {
      return [];
    }

    // Compute the path relative to the module root
    const suffix =
      importPath === modulePath ? '' : importPath.slice(modulePath.length + 1);

    const pkgDir = suffix ? path.join(moduleRoot, suffix) : moduleRoot;

    // Check that the directory exists
    try {
      const stat = fs.statSync(pkgDir);
      if (!stat.isDirectory()) {
        return [];
      }
    } catch {
      return [];
    }

    // Read the .go files in this directory
    let entries: string[];
    try {
      entries = fs.readdirSync(pkgDir);
    } catch {
      return [];
    }

    const goFiles = entries.filter(
      (f) =>
        f.endsWith('.go') &&
        !this._isInVendorOrCache(path.join(pkgDir, f)),
    );

    if (goFiles.length === 0) {
      return [];
    }

    // Preference: non-test files
    const nonTestFiles = goFiles.filter((f) => !f.endsWith('_test.go'));

    // Pick among non-test files first, otherwise among all
    const candidates = nonTestFiles.length > 0 ? nonTestFiles : goFiles;

    // Lexicographic sort for a deterministic result
    candidates.sort();

    return candidates.map((f) => path.join(pkgDir, f));
  }

  /**
   * Checks whether a path lives under a vendor or Go cache directory.
   */
  private _isInVendorOrCache(filePath: string): boolean {
    const segments = filePath.split(path.sep);
    return segments.includes('vendor') || segments.includes('.gomodcache');
  }
}
