/**
 * LspProviderFactory - Factory pour créer les providers LSP appropriés
 */

import * as path from 'node:path';
import type { LspProvider, LspConfig } from './types.js';
import { TypeScriptLspProvider } from './typescript.js';
import { PhpLspProvider } from './php.js';
import { PythonLspProvider } from './python.js';
import { GoLspProvider } from './go.js';
import { NullLspProvider } from './null.js';
import { degradedMessage, type LspProviderStatus } from './availability.js';

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
  '.go': 'go',
};

/**
 * Factory pour créer et gérer les providers LSP
 */
export class LspProviderFactory {
  /** Cache des providers par projet + type */
  private providers: Map<string, LspProvider> = new Map();
  /** Configuration globale */
  private config: LspConfig;
  /** Track LSP provider status (available/degraded) per provider type for warnings */
  private statuses: Map<string, LspProviderStatus> = new Map();

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
      // Record degraded status for optional LSPs (FR-001/008)
      if (providerType === 'php' || providerType === 'python' || providerType === 'go') {
        this.statuses.set(providerType, {
          language: providerType as 'php' | 'python' | 'go',
          providerName: provider.name,
          available: false,
          degraded: true,
          message: degradedMessage(providerType as 'php' | 'python' | 'go'),
        });
      }
      
      // Fallback vers NullProvider avec warning
      if (this.config.debug) {
        console.warn(`[LSP] Provider ${providerType} not available, using fallback`);
      }
      provider = new NullLspProvider();
    } else {
      // Record available status (not degraded)
      if (providerType === 'typescript') {
        this.statuses.set(providerType, {
          language: 'typescript',
          providerName: provider.name,
          available: true,
          degraded: false,
        });
      } else if (providerType === 'php' || providerType === 'python' || providerType === 'go') {
        this.statuses.set(providerType, {
          language: providerType as 'php' | 'python' | 'go',
          providerName: provider.name,
          available: true,
          degraded: false,
        });
      }
      
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
      case 'go':
        return new GoLspProvider(this.config.paths?.gopls, this.config.debug);
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

  /**
   * Returns collected LSP provider statuses for degraded warnings (FR-008).
   * Used by CLI to emit stderr warnings for unavailable providers.
   *
   * @returns Array of LspProviderStatus (one per resolved provider type)
   * @see {@link LspProviderStatus}
   */
  getStatuses(): LspProviderStatus[] {
    return Array.from(this.statuses.values());
  }
}
