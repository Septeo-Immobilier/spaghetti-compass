/**
 * @module availability
 * @description Shared LSP availability detection and diagnostics for PHP, Python, and Go.
 * Centralizes executable detection, install hints, and degraded-mode warnings to prevent duplication
 * across language providers and the doctor command.
 *
 * This module owns the single source of truth for:
 * - Language → LSP command mapping (intelephense, pyright-langserver, gopls)
 * - Install hints for each unavailable LSP
 * - Executable detection via PATH (which/where)
 * - Exact degraded-mode warning text
 * - LSP provider status tracking (available, degraded, message)
 *
 * @see {@link LspProviderFactory} — records availability into LspProviderStatus
 * @see {@link DoctorCommand} — uses availability data for diagnostics
 */

import { execSync } from 'node:child_process';
import { platform } from 'node:os';

/**
 * Enumeration of supported language identifiers.
 */
export type LanguageId = 'typescript' | 'php' | 'python' | 'go' | 'unknown';

/**
 * Result of detecting an executable on the system.
 * Used by doctor command and provider initialization.
 */
export interface ExecutableAvailability {
  /** Logical command name (e.g., 'intelephense', 'gopls', 'node') */
  command: string;
  /** True if found in PATH or verified available */
  available: boolean;
  /** Absolute path to the executable when found */
  path?: string;
  /** Installation instruction hint when unavailable (for optional LSPs) */
  installHint?: string;
}

/**
 * Status of LSP provider resolution for a language during analysis.
 * Recorded by the factory and exposed to the CLI for degraded-mode warnings.
 */
export interface LspProviderStatus {
  /** Language identifier */
  language: LanguageId;
  /** Provider implementation name (e.g., 'php-intelephense', 'NullLspProvider') */
  providerName: string;
  /** True when the LSP executable is available in PATH */
  available: boolean;
  /** True when an optional LSP was unavailable and fell back to parser-only */
  degraded: boolean;
  /** User-facing degraded-mode warning (stderr); only present when degraded=true */
  message?: string;
}

/**
 * Language → LSP command mapping: single source of truth.
 * Maps optional languages to their expected executable name and installation instruction.
 * TypeScript/JavaScript are bundled and have no entry (always available, never degraded).
 */
export const LSP_COMMANDS: Record<
  'php' | 'python' | 'go',
  { command: string; installHint: string }
> = {
  php: {
    command: 'intelephense',
    installHint: 'npm install -g intelephense',
  },
  python: {
    command: 'pyright-langserver',
    installHint: 'npm install -g pyright',
  },
  go: {
    command: 'gopls',
    installHint: 'go install golang.org/x/tools/gopls@latest',
  },
};

/**
 * Detects whether an executable is available in PATH.
 *
 * Uses `which` (POSIX) or `where` (Windows) to locate the command.
 * Never throws; all errors result in availability=false.
 *
 * @param command - Executable name to search (e.g., 'gopls')
 * @returns Availability result with path (if found) or availability=false
 *
 * @example
 * ```typescript
 * const result = checkExecutable('gopls');
 * if (result.available) {
 *   console.log(`gopls found at: ${result.path}`);
 * }
 * ```
 */
export function checkExecutable(command: string): ExecutableAvailability {
  try {
    const whichCmd = platform() === 'win32' ? 'where' : 'which';
    const path = execSync(`${whichCmd} ${command}`, {
      stdio: 'pipe',
      encoding: 'utf-8',
    })
      .trim()
      .split('\n')[0]; // First line only (in case of multiple matches)

    return {
      command,
      available: !!path,
      path: path || undefined,
    };
  } catch {
    return {
      command,
      available: false,
    };
  }
}

/**
 * Checks LSP availability for a specific language.
 *
 * Routes through the shared `checkExecutable` function to detect the language's
 * expected LSP command. Attaches the installation hint for missing LSPs.
 *
 * For Python: the result reflects the direct `pyright-langserver` binary in PATH,
 * independent of any `npx`-based fallback tolerance in the provider (FR-017).
 *
 * @param language - Language identifier ('php', 'python', 'go')
 * @returns Availability with command, path (if found), and installHint
 *
 * @see {@link LSP_COMMANDS} — language→command mapping
 * @see {@link checkExecutable} — underlying PATH detection
 */
export function checkLspForLanguage(language: 'php' | 'python' | 'go'): ExecutableAvailability {
  const config = LSP_COMMANDS[language];
  const result = checkExecutable(config.command);

  return {
    ...result,
    installHint: config.installHint,
  };
}

/**
 * Generates the exact degraded-mode warning message for a language.
 *
 * Used when an optional LSP is unavailable and analysis falls back to parser-only mode.
 * Emitted to stderr (never stdout) by the CLI command handlers.
 *
 * Messages must match the spec exactly for test assertion (FR-002).
 *
 * @param language - Language identifier ('php', 'python', 'go')
 * @returns User-facing warning text for stderr
 *
 * @example
 * ```typescript
 * const msg = degradedMessage('php');
 * // "Warning: PHP LSP unavailable: `intelephense` was not found in PATH. ..."
 * console.error(msg);
 * ```
 */
export function degradedMessage(language: 'php' | 'python' | 'go'): string {
  const messages: Record<'php' | 'python' | 'go', string> = {
    php: 'Warning: PHP LSP unavailable: `intelephense` was not found in PATH. Continuing with parser fallback; symbol resolution may be less precise.',
    python:
      'Warning: Python LSP unavailable: `pyright-langserver` was not found in PATH. Continuing with parser fallback; symbol resolution may be less precise.',
    go: 'Warning: Go LSP unavailable: `gopls` was not found in PATH. Continuing with parser fallback; symbol positions may be less precise.',
  };

  return messages[language];
}
