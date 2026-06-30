/**
 * Destination definitions for agent-setup skill file writing.
 * Supports multiple standard locations: .claude/skills, .cursor/skills-cursor, .agents/skills
 */

import { checkbox } from '@inquirer/prompts';

export type DestinationId = 'claude' | 'cursor' | 'agents';

export interface Destination {
  id: DestinationId;
  label: string;
  relativePath: string;
}

export const DESTINATIONS: Destination[] = [
  {
    id: 'claude',
    label: '.claude/skills',
    relativePath: '.claude/skills',
  },
  {
    id: 'cursor',
    label: '.cursor/skills-cursor',
    relativePath: '.cursor/skills-cursor',
  },
  {
    id: 'agents',
    label: '.agents/skills',
    relativePath: '.agents/skills',
  },
];

export const ALL_DESTINATION_IDS: DestinationId[] = ['claude', 'cursor', 'agents'];

/**
 * Prompts the user to select one or more destinations via interactive checkbox.
 * Throws an error if no destinations are selected.
 */
export async function promptDestinations(): Promise<DestinationId[]> {
  const selected = await checkbox<DestinationId>({
    message: 'Select destination(s) for the skill:',
    choices: DESTINATIONS.map((dest) => ({
      name: dest.label,
      value: dest.id,
    })),
  });

  if (selected.length === 0) {
    throw new Error('At least one destination must be selected');
  }

  return selected;
}

/**
 * Gets a destination by its ID.
 */
export function getDestinationById(id: DestinationId): Destination {
  const dest = DESTINATIONS.find((d) => d.id === id);
  if (!dest) {
    throw new Error(`Unknown destination: ${id}`);
  }
  return dest;
}
