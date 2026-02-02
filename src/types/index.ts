/**
 * Types partagés pour le graphe de dépendances
 */

/**
 * Type de noeud dans le graphe
 */
export type NodeType = 'file' | 'function' | 'class' | 'external-module';

/**
 * Classification de la localisation d'un noeud
 */
export type NodeLocation = 'internal' | 'external' | 'third-party';

/**
 * Type de relation entre deux noeuds
 */
export type EdgeType =
  | 'import-static'
  | 'import-dynamic'
  | 'require'
  | 'export'
  | 're-export'
  | 'call';

/**
 * Représente un élément analysable dans le graphe de dépendances
 */
export interface GraphNode {
  /** Identifiant unique (chemin absolu pour fichiers, `file:function` pour fonctions) */
  id: string;
  /** Type du noeud */
  type: NodeType;
  /** Nom court affiché (nom de fichier ou de fonction) */
  name: string;
  /** Chemin relatif au contexte (null pour external-module) */
  path?: string;
  /** Classification de la localisation */
  location: NodeLocation;
}

/**
 * Informations sur un alias TypeScript résolu
 */
export interface AliasInfo {
  /** Import original (ex: "@/core/service") */
  original: string;
  /** Pattern qui a matché (ex: "@/*") */
  pattern: string;
  /** Source de résolution */
  resolvedVia: string;
}

/**
 * Représente une relation entre deux noeuds
 */
export interface GraphEdge {
  /** ID du noeud source */
  from: string;
  /** ID du noeud cible */
  to: string;
  /** Type de relation */
  type: EdgeType;
  /** true si la cible est résolue, false pour les imports dynamiques */
  resolved: boolean;
  /** Numéro de ligne de l'import/appel dans le fichier source */
  line?: number;
  /** Noms importés pour les imports nommés */
  importedNames?: string[];
  /** Informations sur l'alias TypeScript si résolu via tsconfig */
  aliasInfo?: AliasInfo;
}

/**
 * Mapping de path TypeScript (alias → chemins cibles)
 */
export interface PathMapping {
  /** Pattern de l'alias (ex: "@/*", "@core/*") */
  pattern: string;
  /** Regex compilée pour le matching */
  regex: RegExp;
  /** Chemins cibles (en ordre de priorité) */
  targets: string[];
  /** true si le pattern contient un wildcard */
  hasWildcard: boolean;
}

/**
 * Configuration TypeScript parsée
 */
export interface TsConfigInfo {
  /** Chemin absolu du tsconfig.json */
  configPath: string;
  /** Répertoire de base pour la résolution (baseUrl résolu en absolu) */
  baseUrl: string | null;
  /** Mappings de paths (patterns → chemins cibles) */
  paths: PathMapping[];
  /** Chemin du tsconfig parent si extends est utilisé */
  extendsFrom: string | null;
}

/**
 * Résultat de résolution d'un alias
 */
export interface ResolvedAlias {
  /** Import original (ex: "@/core/service") */
  original: string;
  /** Chemin résolu absolu (ex: "/project/src/core/service.ts") */
  resolved: string | null;
  /** Pattern qui a matché (ex: "@/*") */
  matchedPattern: string | null;
  /** Raison si non résolu */
  error: string | null;
}

/**
 * Métadonnées sur le contexte d'analyse
 */
export interface ContextInfo {
  /** Chemin absolu du dossier contexte */
  rootPath: string;
  /** Chemin de référence pour les chemins relatifs */
  relativeTo?: string;
  /** Globs des fichiers inclus */
  includePatterns: string[];
  /** Globs des fichiers exclus */
  excludePatterns: string[];
  /** Chemin absolu du dossier racine du projet (package.json) */
  projectRoot?: string;
  /** Chemin absolu du tsconfig.json à utiliser */
  tsConfigPath?: string;
}

/**
 * Statistiques agrégées du graphe
 */
export interface GraphStats {
  /** Nombre total de noeuds */
  totalNodes: number;
  /** Nombre total d'arêtes */
  totalEdges: number;
  /** Noeuds internes au contexte */
  internalNodes: number;
  /** Noeuds externes au contexte */
  externalNodes: number;
  /** Noeuds packages tiers */
  thirdPartyNodes: number;
  /** Arêtes non résolues (imports dynamiques) */
  unresolvedEdges: number;
  /** Nombre d'imports résolus via alias TypeScript */
  aliasResolutions?: number;
  /** Liste des cycles détectés */
  circularDependencies: string[][];
}

/**
 * Structure racine contenant le graphe complet
 */
export interface DependencyGraph {
  /** Version du format de sortie (semver) */
  version: string;
  /** Timestamp ISO 8601 */
  generatedAt: string;
  /** Informations sur le contexte d'analyse */
  context: ContextInfo;
  /** ID du noeud point de départ */
  entryPoint: string;
  /** Liste des noeuds */
  nodes: GraphNode[];
  /** Liste des arêtes */
  edges: GraphEdge[];
  /** Statistiques du graphe */
  stats: GraphStats;
}

/**
 * Options d'analyse
 */
export interface AnalyzeOptions {
  /** Contexte d'analyse */
  context: ContextInfo;
  /** Inclure les relations transitives */
  transitive: boolean;
  /** Sortie JSON */
  json: boolean;
}

/**
 * Résultat d'extraction d'imports d'un fichier
 */
export interface ImportInfo {
  /** Chemin ou module importé (tel qu'écrit dans le code) */
  moduleSpecifier: string;
  /** Noms importés (pour les imports nommés) */
  importedNames: string[];
  /** Type d'import */
  type: EdgeType;
  /** Numéro de ligne */
  line: number;
  /** Import résolu ou non */
  resolved: boolean;
}

/**
 * Résultat d'extraction d'exports d'un fichier
 */
export interface ExportInfo {
  /** Nom exporté */
  name: string;
  /** Type d'export (function, class, variable, etc.) */
  kind: 'function' | 'class' | 'variable' | 'type' | 'default' | 're-export';
  /** Numéro de ligne */
  line: number;
  /** Pour les re-exports, le module source */
  fromModule?: string;
}

/**
 * Résultat du parsing d'un fichier
 */
export interface ParseResult {
  /** Chemin absolu du fichier */
  filePath: string;
  /** Imports trouvés */
  imports: ImportInfo[];
  /** Exports trouvés */
  exports: ExportInfo[];
  /** Fonctions déclarées (pour analyse niveau fonction) */
  functions: FunctionInfo[];
  /** Erreurs de parsing */
  errors: string[];
}

/**
 * Information sur une fonction
 */
export interface FunctionInfo {
  /** Nom de la fonction */
  name: string;
  /** Numéro de ligne de début */
  line: number;
  /** Est-ce une fonction exportée */
  exported: boolean;
  /** Appels de fonctions dans cette fonction */
  calls: FunctionCallInfo[];
}

/**
 * Information sur un appel de fonction
 */
export interface FunctionCallInfo {
  /** Nom de la fonction appelée */
  name: string;
  /** Numéro de ligne de l'appel */
  line: number;
  /** Module d'où vient la fonction (si import) */
  fromModule?: string;
}
