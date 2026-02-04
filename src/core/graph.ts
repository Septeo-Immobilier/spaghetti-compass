/**
 * Gestion du graphe de dépendances
 */

import type {
  GraphNode,
  GraphEdge,
  DependencyGraph,
  ContextInfo,
  GraphStats,
} from '../types/index.js';

const VERSION = '1.0.0';

/**
 * Classe pour construire et manipuler le graphe de dépendances
 */
export class DependencyGraphBuilder {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: GraphEdge[] = [];
  private entryPoint: string = '';
  private context: ContextInfo;

  constructor(context: ContextInfo) {
    this.context = context;
  }

  /**
   * Définit le point d'entrée de l'analyse
   */
  setEntryPoint(nodeId: string): void {
    this.entryPoint = nodeId;
  }

  /**
   * Ajoute un noeud au graphe
   */
  addNode(node: GraphNode): void {
    if (!this.nodes.has(node.id)) {
      this.nodes.set(node.id, node);
    }
  }

  /**
   * Récupère un noeud par son ID
   */
  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Vérifie si un noeud existe
   */
  hasNode(id: string): boolean {
    return this.nodes.has(id);
  }

  /**
   * Ajoute une arête au graphe
   */
  addEdge(edge: GraphEdge): void {
    // Éviter les doublons
    const exists = this.edges.some(
      (e) => e.from === edge.from && e.to === edge.to && e.type === edge.type
    );
    if (!exists) {
      this.edges.push(edge);
    }
  }

  /**
   * Récupère toutes les arêtes sortantes d'un noeud
   */
  getOutgoingEdges(nodeId: string): GraphEdge[] {
    return this.edges.filter((e) => e.from === nodeId);
  }

  /**
   * Récupère toutes les arêtes entrantes d'un noeud
   */
  getIncomingEdges(nodeId: string): GraphEdge[] {
    return this.edges.filter((e) => e.to === nodeId);
  }

  /**
   * Récupère tous les noeuds
   */
  getAllNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Récupère toutes les arêtes
   */
  getAllEdges(): GraphEdge[] {
    return [...this.edges];
  }

  /**
   * Extrait le chemin du fichier depuis un node ID
   * Les IDs peuvent être:
   * - Un chemin de fichier absolu: /path/to/file.ts
   * - Un ID de fonction: /path/to/file.ts:functionName
   * - Un module externe: @nestjs/common:Injectable
   */
  private extractFilePath(nodeId: string): string {
    // Pour les chemins absolus avec fonction (file:function)
    // On cherche le dernier ':' qui n'est pas précédé d'un chemin Windows (C:\)
    const colonIndex = nodeId.lastIndexOf(':');

    // Si le colon est à la position 1 (comme C:\), c'est un chemin Windows
    if (colonIndex > 1) {
      const beforeColon = nodeId.substring(0, colonIndex);
      // Si ce qui précède le colon ressemble à un chemin de fichier, c'est un file:function
      if (beforeColon.includes('/') || beforeColon.includes('\\')) {
        return beforeColon;
      }
    }

    // Sinon, c'est juste un chemin de fichier ou un module
    return nodeId;
  }

  /**
   * Détecte les cycles dans le graphe (dépendances circulaires entre fichiers)
   * Note: Un appel récursif (fonction qui s'appelle elle-même) n'est PAS une dépendance circulaire.
   * Une dépendance circulaire nécessite au moins 2 fichiers différents qui s'importent mutuellement.
   */
  detectCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (nodeId: string): void => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const outgoing = this.getOutgoingEdges(nodeId);
      for (const edge of outgoing) {
        if (!visited.has(edge.to)) {
          dfs(edge.to);
        } else if (recursionStack.has(edge.to)) {
          // Cycle détecté - vérifier si c'est une vraie dépendance circulaire
          const cycleStart = path.indexOf(edge.to);
          if (cycleStart !== -1) {
            const cycle = path.slice(cycleStart);
            cycle.push(edge.to); // Fermer le cycle

            // Extraire les fichiers uniques dans le cycle
            const filesInCycle = new Set(cycle.map((id) => this.extractFilePath(id)));

            // C'est une vraie dépendance circulaire seulement si au moins 2 fichiers différents
            if (filesInCycle.size > 1) {
              cycles.push(cycle);
            }
            // Sinon c'est juste un appel récursif dans le même fichier - on ignore
          }
        }
      }

      path.pop();
      recursionStack.delete(nodeId);
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    }

    return cycles;
  }

  /**
   * Calcule les statistiques du graphe
   */
  computeStats(): GraphStats {
    const nodes = this.getAllNodes();
    const edges = this.getAllEdges();

    return {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      internalNodes: nodes.filter((n) => n.location === 'internal').length,
      externalNodes: nodes.filter((n) => n.location === 'external').length,
      thirdPartyNodes: nodes.filter((n) => n.location === 'third-party').length,
      unresolvedEdges: edges.filter((e) => !e.resolved).length,
      aliasResolutions: edges.filter((e) => e.aliasInfo !== undefined).length,
      circularDependencies: this.detectCycles(),
    };
  }

  /**
   * Construit le graphe final
   */
  build(): DependencyGraph {
    return {
      version: VERSION,
      generatedAt: new Date().toISOString(),
      context: this.context,
      entryPoint: this.entryPoint,
      nodes: this.getAllNodes(),
      edges: this.getAllEdges(),
      stats: this.computeStats(),
    };
  }
}
