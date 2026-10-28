/**
 * @module spawn-command
 * @description Cross-platform resolution of the command used to spawn an LSP server.
 *
 * On native Windows, npm-installed binaries (`intelephense`, `pyright-langserver`, `npx`)
 * are `.cmd` shims. Spawning the bare name fails with ENOENT, and spawning a `.cmd` file
 * without a shell throws EINVAL on Node >= 20.12 (CVE-2024-27980 hardening). This module
 * resolves the command against PATH/PATHEXT and, for batch files, builds a safe command
 * line to run through the shell.
 *
 * @see {@link LspProcessManager} — consumes the resolved command before calling spawn
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Options for {@link resolveSpawnCommand}. All fields exist for testability.
 */
export interface ResolveSpawnOptions {
  /** Target platform (default: process.platform) */
  platform?: NodeJS.Platform;
  /** Environment used to read PATH / PATHEXT (default: process.env) */
  env?: NodeJS.ProcessEnv;
  /** File existence check (default: fs.existsSync) */
  exists?: (p: string) => boolean;
}

/**
 * Command, arguments and shell flag ready to be passed to `child_process.spawn`.
 */
export interface ResolvedSpawnCommand {
  command: string;
  args: string[];
  shell: boolean;
}

const DEFAULT_PATHEXT = '.COM;.EXE;.BAT;.CMD';

/** Characters that cmd.exe interprets even inside double quotes, plus the quote itself. */
const UNSAFE_CMD_CHARS = /["%!^&|<>\r\n]/;

/**
 * Reads an environment variable case-insensitively (Windows semantics).
 */
function getEnv(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const wanted = name.toLowerCase();
  for (const key of Object.keys(env)) {
    if (key.toLowerCase() === wanted) {
      return env[key];
    }
  }
  return undefined;
}

/**
 * Locates the executable file for a command on Windows.
 * @returns The resolved path, or null when nothing matches.
 */
function findWindowsExecutable(
  command: string,
  env: NodeJS.ProcessEnv,
  exists: (p: string) => boolean
): string | null {
  const pathExt = (getEnv(env, 'PATHEXT') || DEFAULT_PATHEXT)
    .split(';')
    .map((ext) => ext.trim())
    .filter((ext) => ext.length > 0);

  const hasDirectory = /[\\/]/.test(command);
  const hasExtension = path.win32.extname(command) !== '';

  // Candidate names for a given base path
  const candidates = (base: string): string[] =>
    hasExtension ? [base] : pathExt.map((ext) => base + ext);

  if (hasDirectory) {
    return candidates(command).find((c) => exists(c)) ?? null;
  }

  const dirs = (getEnv(env, 'PATH') ?? '')
    .split(';')
    .map((dir) => dir.trim().replace(/^"(.*)"$/, '$1'))
    .filter((dir) => dir.length > 0);

  for (const dir of dirs) {
    const found = candidates(path.win32.join(dir, command)).find((c) => exists(c));
    if (found) {
      return found;
    }
  }
  return null;
}

/**
 * Quotes one token for a cmd.exe command line, refusing anything needing escaping.
 * @throws Error when the token contains a quote or a cmd metacharacter.
 */
function quoteForCmd(token: string): string {
  if (UNSAFE_CMD_CHARS.test(token)) {
    throw new Error(`Refusing to spawn through cmd.exe: unsafe character in "${token}"`);
  }
  return `"${token}"`;
}

/**
 * Resolves the command to spawn so that it works on every platform.
 *
 * - Non-win32: returned unchanged, no shell.
 * - win32 `.exe`/`.com`: resolved to its full path, no shell.
 * - win32 `.cmd`/`.bat`: resolved and wrapped in a quoted command line run via the shell.
 * - win32 not found: returned unchanged so that spawn reports ENOENT.
 *
 * @throws Error when a batch file path or argument contains a quote or cmd metacharacter.
 */
export function resolveSpawnCommand(
  command: string,
  args: string[],
  options: ResolveSpawnOptions = {}
): ResolvedSpawnCommand {
  const platform = options.platform ?? process.platform;
  if (platform !== 'win32') {
    return { command, args, shell: false };
  }

  const env = options.env ?? process.env;
  const exists = options.exists ?? fs.existsSync;

  const resolved = findWindowsExecutable(command, env, exists);
  if (!resolved) {
    return { command, args, shell: false };
  }

  const ext = path.win32.extname(resolved).toLowerCase();
  if (ext === '.cmd' || ext === '.bat') {
    const line = [resolved, ...args].map(quoteForCmd).join(' ');
    return { command: line, args: [], shell: true };
  }

  return { command: resolved, args, shell: false };
}
