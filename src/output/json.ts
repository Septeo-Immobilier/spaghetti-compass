/**
 * Formatter de sortie JSON
 */

import type { DependencyGraph } from '../types/index';

/**
 * Formate le graphe en JSON
 */
export function formatJson(graph: DependencyGraph): string {
  return JSON.stringify(graph, null, 2);
}
