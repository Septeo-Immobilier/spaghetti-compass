/**
 * Resolve and validate the target directory for agent-setup.
 */

import * as path from 'node:path';
import * as fs from 'node:fs';

export interface ResolveTargetResult {
  ok: true;
  absolutePath: string;
}

export interface ResolveTargetError {
  ok: false;
  message: string;
  code: number;
}

export type ResolveTargetOutcome = ResolveTargetResult | ResolveTargetError;

/**
 * Resolves the given path (relative to cwd) and checks it exists and is a directory.
 * Returns { ok: true, absolutePath } or { ok: false, message, code }.
 */
export function resolveTargetDir(rawPath: string): ResolveTargetOutcome {
  const absolutePath = path.resolve(rawPath);
  if (!fs.existsSync(absolutePath)) {
    return { ok: false, message: `Path does not exist: ${absolutePath}`, code: 2 };
  }
  const stat = fs.statSync(absolutePath);
  if (!stat.isDirectory()) {
    return { ok: false, message: `Path is not a directory: ${absolutePath}`, code: 2 };
  }
  return { ok: true, absolutePath };
}
