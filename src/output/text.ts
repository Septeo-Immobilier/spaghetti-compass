/**
 * Formatter de sortie texte arborescent
 */

import type { DependencyGraph, GraphNode, GraphEdge } from '../types/index.js';

/**
 * Options de formatage
 */
export interface TextFormatOptions {
  /** Activer les hyperliens OSC 8 (format file://) */
  hyperlinks?: boolean;
  /** Utiliser des chemins absolus au lieu de relatifs */
  absolutePaths?: boolean;
  /** Désactiver les liens cliquables (format chemin:ligne:colonne) */
  noLinks?: boolean;
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
  function: '🔹',
  internalCall: '📥',
  externalCall: '📦',
  sameFile: '📄',
  otherFile: '📂',
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
 * Informations sur un package externe
 */
interface PackageInfo {
  /** Nom du package (ex: "lodash", "@nestjs/core") */
  name: string;
  /** Version du package */
  version: string;
  /** Chemin relatif dans le package */
  internalPath: string;
}

/**
 * Vérifie si un chemin est dans node_modules
 */
function isExternalPath(filePath: string): boolean {
  return filePath.includes('/node_modules/') || filePath.includes('\\node_modules\\');
}

/**
 * Extrait les informations du package depuis un chemin node_modules
 */
function extractPackageInfo(filePath: string, _projectRoot?: string): PackageInfo | null {
  const nodeModulesIndex = filePath.lastIndexOf('node_modules');
  if (nodeModulesIndex === -1) return null;

  // Chemin après node_modules/
  const afterNodeModules = filePath.substring(nodeModulesIndex + 'node_modules/'.length);

  let packageName: string;
  let internalPath: string;

  // Gérer les scoped packages (@org/package)
  if (afterNodeModules.startsWith('@')) {
    const parts = afterNodeModules.split('/');
    if (parts.length < 2) return null;
    packageName = `${parts[0]}/${parts[1]}`;
    internalPath = parts.slice(2).join('/');
  } else {
    const parts = afterNodeModules.split('/');
    packageName = parts[0];
    internalPath = parts.slice(1).join('/');
  }

  // Note: La version serait idéalement lue depuis package.json du module
  // mais cela nécessiterait un accès fs synchrone. Pour le MVP, on affiche '?'
  const version = '?';

  return {
    name: packageName,
    version,
    internalPath: internalPath || 'index',
  };
}

/**
 * Formate un chemin en format cliquable (chemin:ligne:colonne)
 * 
 * @param filePath - Chemin du fichier (absolu ou relatif)
 * @param line - Numéro de ligne (1-indexed)
 * @param column - Numéro de colonne (1-indexed, défaut: 1)
 * @param options - Options de formatage
 * @param context - Contexte pour les chemins relatifs
 */
function formatClickablePath(
  filePath: string,
  line?: number,
  column: number = 1,
  options: TextFormatOptions = {},
  rootPath?: string,
  projectRoot?: string
): string {
  // Si noLinks, retourner juste le chemin
  if (options.noLinks) {
    if (options.absolutePaths) {
      return filePath.startsWith('/') ? filePath : (rootPath ? `${rootPath}/${filePath}` : filePath);
    }
    return filePath;
  }

  // Gérer les fichiers externes (node_modules)
  const absolutePath = filePath.startsWith('/') ? filePath : (rootPath ? `${rootPath}/${filePath}` : filePath);

  if (isExternalPath(absolutePath)) {
    const packageInfo = extractPackageInfo(absolutePath, projectRoot);
    if (packageInfo) {
      // Format: package@version:path:line:column
      const basePath = `${packageInfo.name}@${packageInfo.version}:${packageInfo.internalPath}`;
      if (line !== undefined) {
        return `${basePath}:${line}:${column}`;
      }
      return basePath;
    }
  }

  // Déterminer le chemin à utiliser
  let displayPath: string;
  if (options.absolutePaths) {
    displayPath = absolutePath;
  } else {
    // Utiliser le chemin relatif s'il ne commence pas par /
    displayPath = filePath.startsWith('/') && rootPath
      ? filePath.replace(rootPath + '/', '')
      : filePath;
  }

  // Échapper les espaces et caractères spéciaux pour les terminaux
  // Note: Le format chemin:ligne:colonne n'a pas besoin d'échappement spécial
  // car les terminaux modernes gèrent bien ce format

  // Ajouter ligne et colonne si disponibles
  if (line !== undefined) {
    return `${displayPath}:${line}:${column}`;
  }

  return displayPath;
}

/**
 * Formate le graphe en texte lisible
 */
export function formatText(graph: DependencyGraph, options: TextFormatOptions = {}): string {
  const lines: string[] = [];
  const rootPath = graph.context.rootPath;
  const projectRoot = graph.context.projectRoot;

  // Trouver le noeud d'entrée
  const entryNode = graph.nodes.find((n) => n.id === graph.entryPoint);
  if (!entryNode) {
    lines.push('No entry point found.');
    return lines.join('\n');
  }

  // Vérifier si c'est une analyse de fonction
  if (entryNode.type === 'function') {
    return formatFunctionAnalysis(graph, options);
  }

  // Header pour analyse de fichier
  lines.push('═'.repeat(65));
  lines.push(` ${SYMBOLS.entryPoint} Entry Point: ${getEntryPointDisplay(graph, options, rootPath, projectRoot)}`);
  lines.push(` ${SYMBOLS.context} Context: ${graph.context.rootPath}`);
  const aliasCount = graph.stats.aliasResolutions || 0;
  const aliasSuffix = aliasCount > 0 ? ` (${aliasCount} via alias)` : '';
  lines.push(
    ` ${SYMBOLS.stats} Stats: ${graph.stats.internalNodes} internal, ${graph.stats.externalNodes} external, ${graph.stats.thirdPartyNodes} third-party, ${graph.stats.unresolvedEdges} unresolved${aliasSuffix}`
  );
  lines.push('═'.repeat(65));
  lines.push('');

  // Afficher le fichier d'entrée avec format cliquable
  const entryDisplay = entryNode.path || entryNode.name;
  if (options.hyperlinks && entryNode.type === 'file') {
    const entryFilePath = entryNode.id.startsWith('/') ? entryNode.id : rootPath + '/' + entryNode.id;
    lines.push(createFileLink(entryDisplay, entryFilePath));
  } else {
    // Utiliser le format cliquable chemin:ligne:colonne
    const clickablePath = formatClickablePath(entryDisplay, 1, 1, options, rootPath, projectRoot);
    lines.push(clickablePath);
  }

  // Grouper les edges par type et location
  const edges = graph.edges.filter((e) => e.from === graph.entryPoint);
  const grouped = groupEdges(edges, graph.nodes);

  // Afficher les imports internes
  if (grouped.internal.length > 0) {
    lines.push(`${SYMBOLS.branch} ${SYMBOLS.importInternal} IMPORTS (internal)`);
    formatEdgeGroup(grouped.internal, graph, lines, `${SYMBOLS.vertical}   `, new Set(), options, rootPath, projectRoot);
  }

  // Afficher les imports externes
  if (grouped.external.length > 0) {
    lines.push(`${SYMBOLS.branch} ${SYMBOLS.importExternal} IMPORTS (external)`);
    formatEdgeGroup(grouped.external, graph, lines, `${SYMBOLS.vertical}   `, new Set(), options, rootPath, projectRoot);
  }

  // Afficher les packages tiers
  if (grouped.thirdParty.length > 0) {
    lines.push(`${SYMBOLS.branch} ${SYMBOLS.thirdParty} IMPORTS (third-party)`);
    formatEdgeGroup(grouped.thirdParty, graph, lines, `${SYMBOLS.vertical}   `, new Set(), options, rootPath, projectRoot);
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
 * Formate une analyse de fonction avec arbre récursif et externes à plat
 */
function formatFunctionAnalysis(graph: DependencyGraph, options: TextFormatOptions = {}): string {
  const lines: string[] = [];
  const rootPath = graph.context.rootPath;
  const projectRoot = graph.context.projectRoot;

  const entryNode = graph.nodes.find((n) => n.id === graph.entryPoint);
  if (!entryNode) {
    return 'No entry point found.';
  }

  // Collecter toutes les dépendances externes (à plat)
  const externalCalls = new Map<string, Set<string>>(); // package -> function names

  // Header
  lines.push('═'.repeat(65));

  // Extraire le chemin du fichier et le nom de la fonction
  const filePath = entryNode.path || entryNode.id.split(':')[0];
  const funcName = entryNode.name;
  const funcLine = entryNode.line || 1;

  const entryDisplay = formatClickablePath(filePath, funcLine, 1, options, rootPath, projectRoot);
  lines.push(` ${SYMBOLS.entryPoint} Function: ${funcName}`);
  lines.push(` ${SYMBOLS.context} File: ${entryDisplay}`);
  lines.push(` ${SYMBOLS.context} Context: ${graph.context.rootPath}`);

  // Compter les appels internes et externes
  const allEdges = graph.edges.filter(e => e.type === 'call');
  const internalEdges = allEdges.filter(e => e.callType !== 'external');
  const externalEdges = allEdges.filter(e => e.callType === 'external');

  lines.push(
    ` ${SYMBOLS.stats} Stats: ${internalEdges.length} internal calls, ${externalEdges.length} external calls`
  );
  lines.push('═'.repeat(65));
  lines.push('');

  // Afficher l'arbre récursif des appels internes
  const visited = new Set<string>();

  // Fonction récursive pour afficher l'arbre
  function formatFunctionTree(
    nodeId: string,
    prefix: string,
    isLast: boolean,
    depth: number
  ): void {
    const node = graph.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const branchSymbol = depth === 0 ? '' : (isLast ? SYMBOLS.lastBranch : SYMBOLS.branch);

    // Afficher ce noeud
    if (depth === 0) {
      // Point d'entrée
      const displayPath = formatClickablePath(
        node.path || nodeId.split(':')[0],
        node.line || 1,
        1,
        options,
        rootPath,
        projectRoot
      );
      lines.push(`${SYMBOLS.function} ${node.name}`);
      lines.push(`   ${displayPath} (${node.name})`);
    } else {
      // Noeud enfant
      let displayText: string;
      if (node.path) {
        displayText = formatClickablePath(
          node.path,
          node.line || 1,
          1,
          options,
          rootPath,
          projectRoot
        );
        displayText = `${displayText} (${node.name})`;
      } else {
        displayText = node.name;
      }

      // Indiquer si c'est le même fichier ou un autre fichier
      const edge = graph.edges.find(e => e.to === nodeId && e.type === 'call');
      const callTypeIcon = edge?.callType === 'internal-same-file' ? SYMBOLS.sameFile : SYMBOLS.otherFile;

      lines.push(`${prefix}${branchSymbol} ${callTypeIcon} ${displayText}`);
    }

    // Éviter les boucles infinies
    if (visited.has(nodeId)) {
      return;
    }
    visited.add(nodeId);

    // Récupérer les edges sortants de ce noeud
    const childEdges = graph.edges.filter(e => e.from === nodeId && e.type === 'call');

    // Séparer internes et externes
    const internalChildren = childEdges.filter(e => e.callType !== 'external');
    const externalChildren = childEdges.filter(e => e.callType === 'external');

    // Collecter les externes pour l'affichage à plat
    for (const edge of externalChildren) {
      const targetNode = graph.nodes.find(n => n.id === edge.to);
      if (targetNode) {
        // Extraire le nom du package (module d'où vient la fonction)
        const packageName = extractPackageName(targetNode.id, edge.targetPath);
        if (!externalCalls.has(packageName)) {
          externalCalls.set(packageName, new Set());
        }
        externalCalls.get(packageName)!.add(targetNode.name);
      }
    }

    // Afficher les enfants internes récursivement
    const newPrefix = depth === 0 ? '   ' : prefix + (isLast ? '    ' : `${SYMBOLS.vertical}   `);

    for (let i = 0; i < internalChildren.length; i++) {
      const childEdge = internalChildren[i];
      const isLastChild = i === internalChildren.length - 1;
      formatFunctionTree(childEdge.to, newPrefix, isLastChild, depth + 1);
    }
  }

  // Démarrer l'affichage depuis le point d'entrée
  formatFunctionTree(graph.entryPoint, '', true, 0);

  // Afficher les dépendances externes à plat
  if (externalCalls.size > 0) {
    lines.push('');
    lines.push(`${SYMBOLS.branch} ${SYMBOLS.externalCall} EXTERNAL (flat)`);

    const packages = Array.from(externalCalls.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    for (let i = 0; i < packages.length; i++) {
      const [packageName, functions] = packages[i];
      const isLast = i === packages.length - 1;
      const branchSymbol = isLast ? SYMBOLS.lastBranch : SYMBOLS.branch;
      const funcList = Array.from(functions).sort().join(', ');
      lines.push(`${SYMBOLS.vertical}   ${branchSymbol} ${packageName}: ${funcList}`);
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
 * Extrait le nom du package depuis un ID de noeud ou un chemin
 */
function extractPackageName(nodeId: string, targetPath?: string): string {
  // Si c'est un chemin dans node_modules
  if (targetPath && (targetPath.includes('node_modules') || targetPath.includes('\\node_modules\\'))) {
    const info = extractPackageInfo(targetPath);
    if (info) {
      return info.name;
    }
  }

  // Sinon, utiliser le module specifier s'il est dans l'ID
  // Format: moduleSpecifier:functionName
  if (nodeId.includes(':')) {
    const parts = nodeId.split(':');
    if (parts.length >= 2) {
      // Si ça commence par @, c'est un scoped package
      if (parts[0].startsWith('@')) {
        return parts[0];
      }
      // Sinon prendre le premier segment
      const firstPart = parts[0];
      // Si c'est un chemin, prendre le dernier segment
      if (firstPart.includes('/') || firstPart.includes('\\')) {
        return firstPart.split(/[/\\]/).pop() || firstPart;
      }
      return firstPart;
    }
  }

  return 'unknown';
}

/**
 * Obtient l'affichage du point d'entrée
 */
function getEntryPointDisplay(
  graph: DependencyGraph,
  options: TextFormatOptions = {},
  rootPath?: string,
  projectRoot?: string
): string {
  const node = graph.nodes.find((n) => n.id === graph.entryPoint);
  // Utiliser le chemin absolu (node.id) ou relatif (node.path) selon les options
  const basePath = options.absolutePaths
    ? (node?.id || graph.entryPoint)
    : (node?.path || node?.name || graph.entryPoint);

  // Pour le header, on utilise le format cliquable
  return formatClickablePath(basePath, 1, 1, options, rootPath, projectRoot);
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
  options: TextFormatOptions = {},
  rootPath?: string,
  projectRoot?: string
): void {
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    const isLast = i === edges.length - 1;
    const branchSymbol = isLast ? SYMBOLS.lastBranch : SYMBOLS.branch;
    const node = graph.nodes.find((n) => n.id === edge.to);

    if (!node) continue;

    // Afficher l'alias original si disponible
    const aliasSuffix = edge.aliasInfo ? ` (${edge.aliasInfo.original})` : '';

    // Créer le texte avec le format approprié
    let displayText: string;

    // Pour les appels de fonction avec définition résolue via LSP
    if (node.type === 'function' && edge.targetPath) {
      // Utiliser le chemin de définition résolu par LSP
      const defPath = options.absolutePaths
        ? edge.targetPath
        : getRelativePathFrom(edge.targetPath, rootPath);
      const defLine = edge.targetLine ?? 1;
      const defColumn = edge.targetColumn ?? 1;

      if (options.hyperlinks) {
        // Mode hyperlinks OSC 8
        displayText = createFileLink(`${defPath} (${node.name})`, edge.targetPath, defLine);
      } else if (options.noLinks) {
        // Mode sans liens
        displayText = `${defPath} (${node.name})`;
      } else {
        // Mode standard : format chemin:ligne:colonne (nom)
        displayText = `${defPath}:${defLine}:${defColumn} (${node.name})`;
      }
    } else if (options.hyperlinks && node.type === 'file') {
      // Mode hyperlinks OSC 8 pour fichiers
      const displayName = options.absolutePaths ? node.id : (node.path || node.name);
      const filePath = node.id.startsWith('/') ? node.id : (rootPath ? rootPath + '/' + node.id : node.id);
      displayText = createFileLink(displayName, filePath, edge.targetLine ?? edge.line);
    } else if (options.hyperlinks && node.type === 'function') {
      // Pour les fonctions internes (appels dans le même fichier), lier vers la ligne dans le fichier parent
      const displayName = options.absolutePaths ? node.id : (node.path || node.name);
      if (node.location === 'internal' && edge.line) {
        const fileId = edge.from.split(':')[0];
        const fileNode = graph.nodes.find(n => n.id === fileId);
        if (fileNode) {
          const filePath = fileNode.id.startsWith('/') ? fileNode.id : (rootPath ? rootPath + '/' + fileNode.id : fileNode.id);
          displayText = createFileLink(displayName, filePath, edge.line);
        } else {
          displayText = displayName;
        }
      } else if (node.location === 'external' && node.id.includes(':')) {
        // Pour les fonctions externes, essayer de lier vers le fichier si possible
        const parts = node.id.split(':');
        if (parts.length >= 2) {
          const moduleName = parts[0];
          // Essayer de résoudre le module vers un fichier
          const modulePath = rootPath ? rootPath + '/' + moduleName : moduleName;
          if (modulePath.endsWith('.ts') || modulePath.endsWith('.js')) {
            displayText = createFileLink(displayName, modulePath);
          } else {
            displayText = displayName;
          }
        } else {
          displayText = displayName;
        }
      } else {
        displayText = displayName;
      }
    } else {
      // Mode standard : format chemin:ligne:colonne
      const displayName = options.absolutePaths ? node.id : (node.path || node.name);
      // Utiliser targetLine (ligne de définition dans le fichier cible) si disponible,
      // sinon fallback sur line (ligne de l'import dans le fichier source)
      const navigationLine = edge.targetLine ?? edge.line;
      const navigationColumn = edge.targetColumn ?? 1;
      displayText = formatClickablePath(displayName, navigationLine, navigationColumn, options, rootPath, projectRoot);
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
        formatEdgeGroup(childInternal, graph, lines, newPrefix, visited, options, rootPath, projectRoot);
      }
    }
  }
}

/**
 * Convertit un chemin absolu en chemin relatif depuis rootPath
 */
function getRelativePathFrom(absolutePath: string, rootPath?: string): string {
  if (!rootPath || !absolutePath.startsWith('/')) {
    return absolutePath;
  }
  if (absolutePath.startsWith(rootPath + '/')) {
    return absolutePath.slice(rootPath.length + 1);
  }
  return absolutePath;
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
