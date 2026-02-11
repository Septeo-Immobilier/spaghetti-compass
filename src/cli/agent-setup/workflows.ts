/**
 * Workflow registry: id -> Workflow.
 * Each workflow defines the file artifacts to write (relativePath + content).
 */

import { getCursorArtifacts, type FileArtifact } from './templates/cursor/index.js';

export interface Workflow {
  id: string;
  name: string;
  description: string;
  getArtifacts(): FileArtifact[];
}

const cursorWorkflow: Workflow = {
  id: 'cursor',
  name: 'Cursor',
  description: 'Rules, commands and skills for Cursor (.cursor/rules, .cursor/commands, .agents/skills)',
  getArtifacts: getCursorArtifacts,
};

const registry = new Map<string, Workflow>([[cursorWorkflow.id, cursorWorkflow]]);

export function getWorkflow(id: string): Workflow | undefined {
  return registry.get(id);
}

export function getSupportedWorkflowIds(): string[] {
  return Array.from(registry.keys());
}

export function getAllWorkflows(): Workflow[] {
  return Array.from(registry.values());
}
