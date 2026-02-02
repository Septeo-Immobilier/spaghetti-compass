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
