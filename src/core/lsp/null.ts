/**
 * NullLspProvider - Provider no-op pour les langages non supportés
 * Retourne toujours null pour toutes les requêtes
 */

import type { LspProvider, DefinitionResult } from './types.js';

/**
 * Provider LSP no-op utilisé comme fallback
 * Pour les langages non supportés ou quand le LSP n'est pas disponible
 */
export class NullLspProvider implements LspProvider {
  readonly name = 'null';
  readonly supportedExtensions: string[] = [];

  async isAvailable(): Promise<boolean> {
    return true; // Toujours disponible car c'est un fallback
  }

  async initialize(_projectRoot: string, _configPath?: string): Promise<void> {
    // No-op
  }

  addFile(_filePath: string, _content?: string): void {
    // No-op
  }

  async getDefinition(
    _filePath: string,
    _position: number
  ): Promise<DefinitionResult | null> {
    return null;
  }

  async getDefinitionByName(
    _filePath: string,
    _symbolName: string
  ): Promise<DefinitionResult | null> {
    return null;
  }

  async getDefinitionFromImport(
    _sourceFilePath: string,
    _symbolName: string,
    _moduleSpecifier: string
  ): Promise<DefinitionResult | null> {
    return null;
  }

  async dispose(): Promise<void> {
    // No-op
  }
}
