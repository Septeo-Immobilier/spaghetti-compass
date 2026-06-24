/**
 * Agent-setup CLI module: write agent skill files to selected destinations.
 * Supports both interactive (checkbox prompt) and non-interactive (--dest flags) modes.
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import { resolveTargetDir } from './path.js';
import {
  type DestinationId,
  ALL_DESTINATION_IDS,
  promptDestinations,
  getDestinationById,
} from './destinations.js';
import { getSkillArtifact } from './workflows.js';

export const AGENT_SETUP_EXIT_INVALID_PATH = 2;
export const AGENT_SETUP_EXIT_INVALID_DEST = 3;

/**
 * Validates that all destination IDs are valid.
 * Returns error message if invalid, undefined if all valid.
 */
function validateDestinationIds(destIds: string[]): string | undefined {
  for (const id of destIds) {
    if (!ALL_DESTINATION_IDS.includes(id as DestinationId)) {
      return `Unknown destination: "${id}". Supported: ${ALL_DESTINATION_IDS.join(', ')}`;
    }
  }
  return undefined;
}

/**
 * Checks if stdin is a TTY (interactive terminal).
 */
function isTTY(): boolean {
  return process.stdin.isTTY === true;
}

/**
 * Writes the skill file to the target directory under the destination path.
 */
function writeSkillFile(
  targetDir: string,
  destination: ReturnType<typeof getDestinationById>,
  skillContent: string,
  skillDirName: string
): void {
  const skillPath = path.join(targetDir, destination.relativePath, skillDirName, 'SKILL.md');
  const dir = path.dirname(skillPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(skillPath, skillContent, 'utf-8');
}

/**
 * Main agent-setup function.
 * If destIds provided: use them directly.
 * If no destIds and TTY: prompt user interactively.
 * If no destIds and not TTY: error.
 */
export async function runAgentSetup(targetPath: string, destIds?: string[]): Promise<void> {
  const pathResult = resolveTargetDir(targetPath);
  if (!pathResult.ok) {
    console.error(`Error: ${pathResult.message}`);
    process.exit(pathResult.code);
  }

  let selectedDestIds: DestinationId[] = [];

  if (destIds && destIds.length > 0) {
    // Validate provided destination IDs
    const validationError = validateDestinationIds(destIds);
    if (validationError) {
      console.error(`Error: ${validationError}`);
      process.exit(AGENT_SETUP_EXIT_INVALID_DEST);
    }
    selectedDestIds = destIds as DestinationId[];
  } else if (isTTY()) {
    // Prompt user interactively
    try {
      selectedDestIds = await promptDestinations();
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(AGENT_SETUP_EXIT_INVALID_DEST);
    }
  } else {
    // No destination provided and not a TTY
    console.error('Error: No destination specified and stdin is not a TTY.');
    console.error('Please provide one or more destinations using --dest flags.');
    console.error(`Supported: ${ALL_DESTINATION_IDS.join(', ')}`);
    process.exit(AGENT_SETUP_EXIT_INVALID_DEST);
  }

  // Get skill content
  const { dirName: skillDirName, content: skillContent } = getSkillArtifact();

  // Write skill to each selected destination
  for (const destId of selectedDestIds) {
    const destination = getDestinationById(destId);
    writeSkillFile(pathResult.absolutePath, destination, skillContent, skillDirName);
  }

  console.log(
    `Agent setup complete. Skill written to ${selectedDestIds.length} destination(s) at ${pathResult.absolutePath}`
  );
}
