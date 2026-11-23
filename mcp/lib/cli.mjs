/**
 * Thin runner around the spaghetti-compass CLI.
 *
 * The MCP layer owns no analysis logic: every tool shells out to the CLI with
 * `--json` and reshapes the answer for an LLM.
 */

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_BIN = path.resolve(HERE, '../../bin/spaghetti-compass.js');
const REPO_DIST = path.resolve(HERE, '../../dist/cli/index.js');

/** Exit codes documented in the skill (`explore` / `impact`). */
export const EXIT_MEANING = {
  1: 'entry file (or --tsconfig) not found, or a CLI usage error',
  2: 'context directory (or --root) not found / not a directory',
  3: 'internal error, or the entry parsed to zero nodes',
  4: 'function/symbol not found in the entry file',
};

/**
 * Pick how to launch the CLI, most specific first:
 *  1. SPAGHETTI_COMPASS_BIN (explicit override, may hold a command line)
 *  2. the repo build next to this folder (running from a checkout)
 *  3. `spaghetti-compass` on PATH
 *  4. `npx -y @septeo-immo/spaghetti-compass` (`-y` is mandatory: no TTY to confirm)
 */
export function resolveLauncher(env = process.env, exists = fs.existsSync) {
  if (env.SPAGHETTI_COMPASS_BIN) {
    const [command, ...args] = env.SPAGHETTI_COMPASS_BIN.split(/\s+/).filter(Boolean);
    return { command, args, source: 'SPAGHETTI_COMPASS_BIN' };
  }
  if (exists(REPO_BIN) && exists(REPO_DIST)) {
    return { command: process.execPath, args: [REPO_BIN], source: 'repo build' };
  }
  const onPath = (env.PATH || '')
    .split(path.delimiter)
    .some((dir) => dir && exists(path.join(dir, 'spaghetti-compass')));
  if (onPath) return { command: 'spaghetti-compass', args: [], source: 'PATH' };
  return {
    command: 'npx',
    args: ['-y', '@septeo-immo/spaghetti-compass'],
    source: 'npx',
  };
}

/**
 * Run the CLI. Resolves `{ code, stdout, stderr }`; never rejects on a non-zero
 * exit (the caller decides), only on a spawn failure.
 */
export function runCli(args, { cwd, timeoutMs = 120_000, launcher = resolveLauncher() } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(launcher.command, [...launcher.args, ...args], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Cannot start spaghetti-compass (${launcher.source}): ${err.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`spaghetti-compass timed out after ${timeoutMs} ms`));
        return;
      }
      resolve({ code: code ?? 1, stdout, stderr: stderr.trim() });
    });
  });
}

/** Run the CLI with `--json` and parse stdout. Throws a readable Error on failure. */
export async function runJson(args, opts = {}) {
  const { code, stdout, stderr } = await runCli([...args, '--json'], opts);
  if (code !== 0) {
    const meaning = EXIT_MEANING[code] ? ` (${EXIT_MEANING[code]})` : '';
    throw new Error(`spaghetti-compass exited ${code}${meaning}: ${stderr || stdout.trim()}`);
  }
  try {
    return { data: JSON.parse(stdout), stderr };
  } catch {
    throw new Error(`spaghetti-compass returned non-JSON output: ${stdout.slice(0, 300)}`);
  }
}
