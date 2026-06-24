/**
 * Skill content getter (replaced the old workflow registry pattern).
 */

import { SKILL_CONTENT, SKILL_DIR_NAME } from './templates/cursor/index.js';

/**
 * Gets the skill content and directory name for writing.
 */
export function getSkillArtifact() {
  return {
    dirName: SKILL_DIR_NAME,
    content: SKILL_CONTENT,
  };
}
