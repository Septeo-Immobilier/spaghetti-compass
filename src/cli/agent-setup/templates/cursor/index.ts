/**
 * Skill template content for spaghetti-compass exploration.
 *
 * The skill body lives in the sibling `spaghetti-compass-exploration.md` file so
 * it can be edited as real Markdown (syntax highlighting, preview, clean diffs)
 * instead of an escaped TypeScript string. The build step copies the `.md` next
 * to the compiled JS in `dist/`, so `import.meta.url` resolves it at runtime both
 * from source and from the published package.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const SKILL_DIR_NAME = 'spaghetti-compass-exploration';

const SKILL_MD_PATH = fileURLToPath(
  new URL('./spaghetti-compass-exploration.md', import.meta.url)
);

export const SKILL_CONTENT = readFileSync(SKILL_MD_PATH, 'utf-8');
