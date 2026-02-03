/**
 * LspProviderFactory - Factory pour créer les providers LSP appropriés
 */

import * as path from 'node:path';
import type { LspProvider, LspConfig } from './types.js';
import { TypeScriptLspProvider } from './typescript.js';
import { PhpLspProvider } from './php.js';
import { PythonLspProvider } from './python.js';
import { NullLspProvider } from './null.js';

/**
 * Mapping des extensions vers les types de providers
 */
const EXTENSION_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'typescript',
  '.jsx': 'typescript',
  '.mjs': 'typescript',
  '.cjs': 'typescript',
  '.php': 'php',
  '.py': 'python',
  '.pyi': 'python',
};

/**
 * Factory pour créer et gérer les providers LSP
 */
export class LspProviderFactory {
  /** Cache des providers par projet + type */
  private providers: Map<string, LspProvider> = new Map();
  /** Configuration globale */
  private config: LspConfig;

  constructor(config: LspConfig = {}) {
    this.config = config;
  }

  /**
   * Crée ou récupère un provider pour un fichier donné
   * @param filePath Chemin du fichier à analyser
   * @param projectRoot Racine du projet
   * @param configPath Chemin optionnel vers la config (tsconfig, etc.)
   */
  async getProvider(
    filePath: string,
    projectRoot: string,
    configPath?: string
  ): Promise<LspProvider> {
    const ext = path.extname(filePath).toLowerCase();
    const providerType = EXTENSION_MAP[ext] || 'null';

    // Clé de cache: projet + type
    const cacheKey = `${projectRoot}:${providerType}`;

    // Vérifier le cache
    let provider = this.providers.get(cacheKey);
    if (provider) {
      return provider;
    }

    // Créer un nouveau provider
    provider = this.createProvider(providerType);

    // Vérifier si le provider est disponible
    const available = await provider.isAvailable();
    if (!available) {
      // Fallback vers NullProvider avec warning
      if (this.config.debug) {
        console.warn(`[LSP] Provider ${providerType} not available, using fallback`);
      }
      provider = new NullLspProvider();
    } else {
      // Initialiser le provider
      await provider.initialize(projectRoot, configPath);
    }

    // Mettre en cache
    this.providers.set(cacheKey, provider);

    return provider;
  }

  /**
   * Crée un provider selon le type
   */
  private createProvider(type: string): LspProvider {
    switch (type) {
      case 'typescript':
        return new TypeScriptLspProvider();
      case 'php':
        return new PhpLspProvider(this.config.debug);
      case 'python':
        return new PythonLspProvider(this.config.debug);
      default:
        return new NullLspProvider();
    }
  }

  /**
   * Retourne le type de provider pour une extension donnée
   */
  static getProviderType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    return EXTENSION_MAP[ext] || 'null';
  }

  /**
   * Vérifie si une extension est supportée
   */
  static isSupported(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext in EXTENSION_MAP;
  }

  /**
   * Libère tous les providers
   */
  async disposeAll(): Promise<void> {
    const disposePromises = Array.from(this.providers.values()).map((p) =>
      p.dispose()
    );
    await Promise.all(disposePromises);
    this.providers.clear();
  }
}
