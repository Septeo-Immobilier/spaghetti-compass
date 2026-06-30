/**
 * Types et interfaces pour les providers LSP
 */

/**
 * Résultat de la recherche de définition
 */
export interface DefinitionResult {
  /** Chemin absolu du fichier contenant la définition */
  filePath: string;
  /** Numéro de ligne (1-indexed) */
  line: number;
  /** Numéro de colonne (1-indexed) */
  column: number;
  /** Nom du symbole défini */
  name?: string;
}

/**
 * Interface abstraite pour tous les providers LSP
 * Chaque langage implémente cette interface pour fournir "Go to Definition"
 */
export interface LspProvider {
  /** Nom du provider pour les logs/debug */
  readonly name: string;

  /** Extensions de fichiers supportées (ex: ['.php']) */
  readonly supportedExtensions: string[];

  /**
   * Vérifie si le LSP est disponible sur le système
   * @returns true si le LSP peut être utilisé
   */
  isAvailable(): Promise<boolean>;

  /**
   * Initialise le provider pour un projet donné
   * @param projectRoot Chemin absolu du projet
   * @param configPath Chemin optionnel vers la config (tsconfig, composer.json, etc.)
   */
  initialize(projectRoot: string, configPath?: string): Promise<void>;

  /**
   * Ajoute un fichier au contexte du LSP
   * @param filePath Chemin du fichier
   * @param content Contenu optionnel (sinon lu depuis le disque)
   */
  addFile(filePath: string, content?: string): void;

  /**
   * Trouve la définition d'un symbole à une position donnée
   * @param filePath Chemin du fichier source
   * @param position Position dans le fichier (offset en caractères)
   * @returns Résultat de définition ou null si non trouvé
   */
  getDefinition(filePath: string, position: number): Promise<DefinitionResult | null>;

  /**
   * Trouve la définition d'un symbole par son nom dans un fichier
   * @param filePath Chemin du fichier source
   * @param symbolName Nom du symbole à rechercher
   * @returns Résultat de définition ou null si non trouvé
   */
  getDefinitionByName(filePath: string, symbolName: string): Promise<DefinitionResult | null>;

  /**
   * Trouve la définition d'un symbole importé depuis un module
   * @param sourceFilePath Chemin du fichier source
   * @param symbolName Nom du symbole importé
   * @param moduleSpecifier Module d'origine (ex: './utils', 'lodash')
   * @returns Résultat de définition ou null si non trouvé
   */
  getDefinitionFromImport(
    sourceFilePath: string,
    symbolName: string,
    moduleSpecifier: string
  ): Promise<DefinitionResult | null>;

  /**
   * Libère les ressources (processus, mémoire, etc.)
   */
  dispose(): Promise<void>;
}

/**
 * Configuration pour les providers LSP
 */
export interface LspConfig {
  /** Timeout pour les requêtes LSP (ms) - default: 5000 */
  timeout?: number;
  /** Activer les logs debug */
  debug?: boolean;
  /** Chemins personnalisés vers les LSP */
  paths?: {
    intelephense?: string;
    pyright?: string;
    gopls?: string;
  };
}
