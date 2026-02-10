/**
 * ComposerResolver - Résolution des namespaces PHP via composer.json PSR-4
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ComposerConfig, PhpNamespaceResolution } from '../types/index.js';

/**
 * Résout les namespaces PHP vers des chemins de fichiers en utilisant
 * la configuration PSR-4 de composer.json
 */
export class ComposerResolver {
  /** Cache des configurations Composer par répertoire projet */
  private configCache: Map<string, ComposerConfig | null> = new Map();
  
  /** Cache des résolutions de namespaces */
  private resolutionCache: Map<string, PhpNamespaceResolution> = new Map();

  /**
   * Trouve le fichier composer.json en remontant l'arborescence
   * @param startPath Chemin de départ (fichier ou répertoire)
   * @returns Chemin absolu vers composer.json ou null si non trouvé
   */
  findComposerJson(startPath: string): string | null {
    let currentDir = fs.statSync(startPath).isDirectory() 
      ? startPath 
      : path.dirname(startPath);
    
    const root = path.parse(currentDir).root;
    
    while (currentDir !== root) {
      const composerPath = path.join(currentDir, 'composer.json');
      if (fs.existsSync(composerPath)) {
        return composerPath;
      }
      currentDir = path.dirname(currentDir);
    }
    
    // Vérifier aussi la racine
    const rootComposer = path.join(root, 'composer.json');
    if (fs.existsSync(rootComposer)) {
      return rootComposer;
    }
    
    return null;
  }

  /**
   * Charge et parse la configuration Composer
   * @param composerJsonPath Chemin vers composer.json
   * @returns Configuration parsée ou null si erreur
   */
  loadConfig(composerJsonPath: string): ComposerConfig | null {
    // Vérifier le cache
    const cacheKey = path.dirname(composerJsonPath);
    if (this.configCache.has(cacheKey)) {
      return this.configCache.get(cacheKey) ?? null;
    }

    try {
      const content = fs.readFileSync(composerJsonPath, 'utf-8');
      const json = JSON.parse(content);
      
      const psr4Mappings = new Map<string, string>();
      const projectDir = path.dirname(composerJsonPath);
      
      // Parser autoload.psr-4
      if (json.autoload?.['psr-4']) {
        for (const [prefix, baseDir] of Object.entries(json.autoload['psr-4'])) {
          // Normaliser le préfixe (s'assurer qu'il se termine par \)
          const normalizedPrefix = prefix.endsWith('\\') ? prefix : prefix + '\\';
          // Résoudre le chemin de base en absolu
          const baseDirStr = Array.isArray(baseDir) ? baseDir[0] : baseDir as string;
          const absoluteBaseDir = path.resolve(projectDir, baseDirStr);
          psr4Mappings.set(normalizedPrefix, absoluteBaseDir);
        }
      }
      
      // Parser aussi autoload-dev.psr-4 (pour les tests)
      if (json['autoload-dev']?.['psr-4']) {
        for (const [prefix, baseDir] of Object.entries(json['autoload-dev']['psr-4'])) {
          const normalizedPrefix = prefix.endsWith('\\') ? prefix : prefix + '\\';
          const baseDirStr = Array.isArray(baseDir) ? baseDir[0] : baseDir as string;
          const absoluteBaseDir = path.resolve(projectDir, baseDirStr);
          psr4Mappings.set(normalizedPrefix, absoluteBaseDir);
        }
      }

      const config: ComposerConfig = {
        configPath: composerJsonPath,
        psr4Mappings,
        vendorDir: path.resolve(projectDir, json.config?.['vendor-dir'] || 'vendor'),
      };

      this.configCache.set(cacheKey, config);
      return config;
    } catch {
      // Fichier invalide ou erreur de parsing
      this.configCache.set(cacheKey, null);
      return null;
    }
  }

  /**
   * Résout un namespace PHP vers un chemin de fichier
   * @param namespace Namespace complet (ex: "App\\Models\\User")
   * @param fromFile Fichier source (pour trouver composer.json)
   * @returns Résultat de résolution
   */
  resolve(namespace: string, fromFile: string): PhpNamespaceResolution {
    // Clé de cache unique
    const cacheKey = `${fromFile}:${namespace}`;
    if (this.resolutionCache.has(cacheKey)) {
      return this.resolutionCache.get(cacheKey)!;
    }

    // Résultat par défaut (non résolu)
    const defaultResult: PhpNamespaceResolution = {
      namespace,
      filePath: null,
      resolvedVia: 'unresolved',
      location: 'unresolved',
    };

    // Trouver composer.json
    const composerPath = this.findComposerJson(fromFile);
    if (!composerPath) {
      this.resolutionCache.set(cacheKey, defaultResult);
      return defaultResult;
    }

    // Charger la configuration
    const config = this.loadConfig(composerPath);
    if (!config || config.psr4Mappings.size === 0) {
      this.resolutionCache.set(cacheKey, defaultResult);
      return defaultResult;
    }

    // Normaliser le namespace (enlever \ initial si présent)
    const normalizedNamespace = namespace.replace(/^\\+/, '');

    // Trier les mappings par longueur de préfixe (plus long d'abord) pour longest-match
    const sortedMappings = Array.from(config.psr4Mappings.entries())
      .sort((a, b) => b[0].length - a[0].length);

    // Chercher le préfixe le plus long qui match
    for (const [prefix, absoluteBaseDir] of sortedMappings) {
      // Normaliser le préfixe pour la comparaison (enlever \ final)
      const normalizedPrefix = prefix.replace(/\\+$/, '');
      
      // Vérifier si le namespace commence par ce préfixe
      if (normalizedNamespace.startsWith(normalizedPrefix + '\\') || 
          normalizedNamespace === normalizedPrefix) {
        
        // Calculer le chemin relatif après le préfixe
        let relativePath: string;
        if (normalizedNamespace === normalizedPrefix) {
          // Cas rare: le namespace est exactement le préfixe
          relativePath = '';
        } else {
          relativePath = normalizedNamespace
            .slice(normalizedPrefix.length)
            .replace(/^\\+/, '')  // Enlever les \ initiaux
            .replace(/\\/g, '/'); // Convertir \ en /
        }

        // Construire le chemin du fichier
        const filePath = path.join(absoluteBaseDir, relativePath + '.php');

        // Vérifier si le fichier existe
        if (fs.existsSync(filePath)) {
          // Déterminer si c'est third-party (dans vendor/)
          const isThirdParty = filePath.includes(path.sep + 'vendor' + path.sep) ||
                               filePath.includes('/vendor/');

          const result: PhpNamespaceResolution = {
            namespace,
            filePath,
            resolvedVia: 'composer-psr4',
            location: isThirdParty ? 'third-party' : 'internal',
            matchedMapping: {
              prefix,
              baseDir: path.relative(path.dirname(composerPath), absoluteBaseDir),
              absoluteBaseDir,
            },
          };

          this.resolutionCache.set(cacheKey, result);
          return result;
        }
      }
    }

    // Aucun mapping trouvé ou fichier inexistant
    this.resolutionCache.set(cacheKey, defaultResult);
    return defaultResult;
  }

  /**
   * Vérifie si une chaîne ressemble à un namespace PHP
   * @param str Chaîne à vérifier
   * @returns true si c'est probablement un namespace PHP
   */
  static isPhpNamespace(str: string): boolean {
    // Un namespace PHP contient des backslashes et commence par une lettre majuscule
    // Exemples: App\Models\User, Symfony\Component\HttpFoundation\Response
    return /^[A-Z][A-Za-z0-9_]*(?:\\[A-Z][A-Za-z0-9_]*)+$/.test(str);
  }

  /**
   * Vide les caches (utile pour les tests)
   */
  clearCache(): void {
    this.configCache.clear();
    this.resolutionCache.clear();
  }
}
