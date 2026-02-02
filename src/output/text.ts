/**
 * Formatter de sortie texte arborescent
 */

import type { DependencyGraph, GraphNode, GraphEdge } from '../types/index.js';

/**
 * Options de formatage
 */
export interface TextFormatOptions {
  hyperlinks?: boolean;
}

// Symboles Unicode
const SYMBOLS = {
  entryPoint: '📍',
  context: '📁',
  stats: '📊',
  importInternal: '📥',
  importExternal: '📥',
  thirdParty: '📦',
  export: '📤',
  dynamic: '⚠️',
  circular: '🔄',
  branch: '├──',
  lastBranch: '└──',
  vertical: '│',
  indent: '    ',
};

/**
 * Génère un hyperlien cliquable (format OSC 8)
 */
function createHyperlink(text: string, url: string): string {
  // Séquence d'échappement ANSI OSC 8: \e]8;;URL\e\\texte\e]8;;\e\\
  return `\u001b]8;;${url}\u001b\\${text}\u001b]8;;\u001b\\`;
}

/**
 * Crée un hyperlien vers un fichier
 */
function createFileLink(text: string, filePath: string, line?: number): string {
  const url = line ? `file://${filePath}#L${line}` : `file://${filePath}`;
  return createHyperlink(text, url);
}

/**
 * Formate le graphe en texte lisible
 */
export function formatText(graph: DependencyGraph, options: TextFormatOptions = {}): string {
  const lines: string[] = [];

  // Header
  lines.push('═'.repeat(65));
  lines.push(` ${SYMBOLS.entryPoint} Entry Point: ${getEntryPointDisplay(graph)}`);
  lines.push(` ${SYMBOLS.context} Context: ${graph.context.rootPath}`);
  const aliasCount = graph.stats.aliasResolutions || 0;
  const aliasSuffix = aliasCount > 0 ? ` (${aliasCount} via alias)` : '';
  lines.push(
    ` ${SYMBOLS.stats} Stats: ${graph.stats.internalNodes} internal, ${graph.stats.externalNodes} external, ${graph.stats.thirdPartyNodes} third-party, ${graph.stats.unresolvedEdges} unresolved${aliasSuffix}`
  );
  lines.push('═'.repeat(65));
  lines.push('');

  // Trouver le noeud d'entrée
  const entryNode = graph.nodes.find((n) => n.id === graph.entryPoint);
  if (!entryNode) {
    lines.push('No entry point found.');
    return lines.join('\n');
  }

  // Afficher le fichier d'entrée
  const entryDisplay = entryNode.path || entryNode.name;
  if (options.hyperlinks && entryNode.type === 'file') {
    const entryFilePath = entryNode.id.startsWith('/') ? entryNode.id : graph.context.rootPath + '/' + entryNode.id;
    lines.push(createFileLink(entryDisplay, entryFilePath));
  } else {
    lines.push(entryDisplay);
  }

  // Grouper les edges par type et location
  const edges = graph.edges.filter((e) => e.from === graph.entryPoint);
  const grouped = groupEdges(edges, graph.nodes);

  // Afficher les imports internes
  if (grouped.internal.length > 0) {
    lines.push(`${SYMBOLS.branch} ${SYMBOLS.importInternal} IMPORTS (internal)`);
    formatEdgeGroup(grouped.internal, graph, lines, `${SYMBOLS.vertical}   `, new Set(), options);
  }

  // Afficher les imports externes
  if (grouped.external.length > 0) {
    lines.push(`${SYMBOLS.branch} ${SYMBOLS.importExternal} IMPORTS (external)`);
    formatEdgeGroup(grouped.external, graph, lines, `${SYMBOLS.vertical}   `, new Set(), options);
  }

  // Afficher les packages tiers
  if (grouped.thirdParty.length > 0) {
    lines.push(`${SYMBOLS.branch} ${SYMBOLS.thirdParty} IMPORTS (third-party)`);
    formatEdgeGroup(grouped.thirdParty, graph, lines, `${SYMBOLS.vertical}   `, new Set(), options);
  }

  // Afficher les exports
  const exports = getExportsForNode(graph.entryPoint, graph);
  if (exports.length > 0) {
    lines.push(`${SYMBOLS.branch} ${SYMBOLS.export} EXPORTS`);
    for (let i = 0; i < exports.length; i++) {
      const isLast = i === exports.length - 1;
      const prefix = isLast ? SYMBOLS.lastBranch : SYMBOLS.branch;
      lines.push(`${SYMBOLS.vertical}   ${prefix} ${exports[i]}`);
    }
  }

  // Afficher les imports dynamiques non résolus
  if (grouped.dynamic.length > 0) {
    lines.push(`${SYMBOLS.lastBranch} ${SYMBOLS.dynamic}  DYNAMIC IMPORTS (unresolved)`);
    for (let i = 0; i < grouped.dynamic.length; i++) {
      const edge = grouped.dynamic[i];
      const isLast = i === grouped.dynamic.length - 1;
      const prefix = isLast ? SYMBOLS.lastBranch : SYMBOLS.branch;
      const node = graph.nodes.find((n) => n.id === edge.to);
      const lineInfo = edge.line ? ` (line ${edge.line})` : '';
      const aliasInfo = edge.aliasInfo 
        ? ` (→ ${edge.aliasInfo.pattern}, file not found)`
        : '';
      lines.push(`    ${prefix} ${node?.name || edge.to}${lineInfo}${aliasInfo}`);
    }
  }

  // Afficher les dépendances circulaires
  if (graph.stats.circularDependencies.length > 0) {
    lines.push('');
    lines.push('─'.repeat(65));
    lines.push(` ${SYMBOLS.circular} Circular Dependencies Detected:`);
    for (const cycle of graph.stats.circularDependencies) {
      const cycleStr = cycle.map((p) => getShortPath(p, graph)).join(' ↔ ');
      lines.push(`    ${cycleStr}`);
    }
    lines.push('─'.repeat(65));
  }

  return lines.join('\n');
}

/**
 * Obtient l'affichage du point d'entrée
 */
function getEntryPointDisplay(graph: DependencyGraph): string {
  const node = graph.nodes.find((n) => n.id === graph.entryPoint);
  return node?.path || node?.name || graph.entryPoint;
}

/**
 * Groupe les edges par location
 */
function groupEdges(
  edges: GraphEdge[],
  nodes: GraphNode[]
): {
  internal: GraphEdge[];
  external: GraphEdge[];
  thirdParty: GraphEdge[];
  dynamic: GraphEdge[];
} {
  const result = {
    internal: [] as GraphEdge[],
    external: [] as GraphEdge[],
    thirdParty: [] as GraphEdge[],
    dynamic: [] as GraphEdge[],
  };

  for (const edge of edges) {
    if (!edge.resolved || edge.type === 'import-dynamic') {
      result.dynamic.push(edge);
      continue;
    }

    const targetNode = nodes.find((n) => n.id === edge.to);
    if (!targetNode) continue;

    switch (targetNode.location) {
      case 'internal':
        result.internal.push(edge);
        break;
      case 'external':
        result.external.push(edge);
        break;
      case 'third-party':
        result.thirdParty.push(edge);
        break;
    }
  }

  return result;
}

/**
 * Formate un groupe d'edges avec leurs dépendances transitives
 */
function formatEdgeGroup(
  edges: GraphEdge[],
  graph: DependencyGraph,
  lines: string[],
  prefix: string,
  visited: Set<string> = new Set(),
  options: TextFormatOptions = {}
): void {
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    const isLast = i === edges.length - 1;
    const branchSymbol = isLast ? SYMBOLS.lastBranch : SYMBOLS.branch;
    const node = graph.nodes.find((n) => n.id === edge.to);

    if (!node) continue;

    const displayName = node.path || node.name;
    // Afficher l'alias original si disponible
    const aliasSuffix = edge.aliasInfo ? ` (${edge.aliasInfo.original})` : '';

    // Créer le texte avec hyperlien si activé
    let displayText = displayName;
    if (options.hyperlinks && node.type === 'file') {
      const filePath = node.id.startsWith('/') ? node.id : graph.context.rootPath + '/' + node.id;
      displayText = createFileLink(displayName, filePath);
    } else if (options.hyperlinks && node.type === 'function') {
      // Pour les fonctions internes (appels dans le même fichier), lier vers la ligne dans le fichier parent
      if (node.location === 'internal' && edge.line) {
        const fileId = edge.from.split(':')[0];
        const fileNode = graph.nodes.find(n => n.id === fileId);
        if (fileNode) {
          const filePath = fileNode.id.startsWith('/') ? fileNode.id : graph.context.rootPath + '/' + fileNode.id;
          displayText = createFileLink(displayName, filePath, edge.line);
        }
      } else if (node.location === 'external' && node.id.includes(':')) {
        // Pour les fonctions externes, essayer de lier vers le fichier si possible
        const parts = node.id.split(':');
        if (parts.length >= 2) {
          const moduleName = parts[0];
          // Essayer de résoudre le module vers un fichier
          const modulePath = graph.context.rootPath + '/' + moduleName;
          if (modulePath.endsWith('.ts') || modulePath.endsWith('.js')) {
            displayText = createFileLink(displayName, modulePath);
          }
        }
      }
    }

    lines.push(`${prefix}${branchSymbol} ${displayText}${aliasSuffix}`);

    // Afficher les dépendances transitives (seulement pour les fichiers internes)
    if (node.location === 'internal' && !visited.has(node.id)) {
      visited.add(node.id);
      const childEdges = graph.edges.filter(
        (e) => e.from === node.id && e.resolved && e.type !== 'import-dynamic'
      );
      const childInternal = childEdges.filter((e) => {
        const targetNode = graph.nodes.find((n) => n.id === e.to);
        return targetNode?.location === 'internal';
      });

      if (childInternal.length > 0) {
        const newPrefix = prefix + (isLast ? '    ' : `${SYMBOLS.vertical}   `);
        formatEdgeGroup(childInternal, graph, lines, newPrefix, visited, options);
      }
    }
  }
}

/**
 * Obtient les exports pour un noeud (basé sur les edges de type export/re-export)
 */
function getExportsForNode(nodeId: string, graph: DependencyGraph): string[] {
  // Pour l'instant, on retourne les edges de type export/re-export
  const exportEdges = graph.edges.filter(
    (e) => e.from === nodeId && (e.type === 'export' || e.type === 're-export')
  );

  return exportEdges.map((e) => {
    const names = e.importedNames?.join(', ') || '*';
    const node = graph.nodes.find((n) => n.id === e.to);
    return `${names} from ${node?.name || e.to}`;
  });
}

/**
 * Obtient un chemin court pour l'affichage
 */
function getShortPath(fullPath: string, graph: DependencyGraph): string {
  const node = graph.nodes.find((n) => n.id === fullPath);
  return node?.path || node?.name || fullPath.split('/').pop() || fullPath;
}
