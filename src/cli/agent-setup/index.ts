/**
 * Agent-setup CLI module: write agent config files (rules, commands, skills)
 * for a given workflow (e.g. cursor) into a target directory.
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import { resolveTargetDir } from './path.js';
import { getWorkflow, getSupportedWorkflowIds } from './workflows.js';
import type { FileArtifact } from './templates/cursor/index.js';

export const AGENT_SETUP_EXIT_INVALID_PATH = 2;
export const AGENT_SETUP_EXIT_UNKNOWN_WORKFLOW = 5;

/**
 * Writes all file artifacts to the target directory.
 * Creates parent directories as needed. Overwrites existing files.
 */
export function writeArtifacts(targetDir: string, artifacts: FileArtifact[]): void {
  for (const { relativePath, content } of artifacts) {
    if (relativePath.includes('..')) {
      continue; // skip path traversal
    }
    const fullPath = path.join(targetDir, relativePath);
    const dir = path.dirname(fullPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
  }
}

/**
 * Runs agent-setup: validates path and workflow, writes files, exits the process.
 */
export function runAgentSetup(targetPath: string, workflowId: string): void {
  const pathResult = resolveTargetDir(targetPath);
  if (!pathResult.ok) {
    console.error(`Error: ${pathResult.message}`);
    process.exit(pathResult.code);
  }

  const workflow = getWorkflow(workflowId);
  if (!workflow) {
    const supported = getSupportedWorkflowIds().join(', ');
    console.error(`Error: Unknown workflow "${workflowId}". Supported workflows: ${supported}`);
    process.exit(AGENT_SETUP_EXIT_UNKNOWN_WORKFLOW);
  }

  const artifacts = workflow.getArtifacts();
  writeArtifacts(pathResult.absolutePath, artifacts);

  console.log(`Agent setup complete for workflow "${workflow.id}" at ${pathResult.absolutePath}`);
  process.exit(0);
}
