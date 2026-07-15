/**
 * @module doctor
 * @description Builds and reports environment diagnostics for spaghetti-compass.
 * Inspects runtime availability (Node, spaghetti-compass binary) and LSP tools.
 *
 * Used by the `doctor` CLI command to guide users on tool setup and LSP precision.
 * Reuses the shared availability module (no duplicated detection logic — FR-019).
 *
 * @see {@link availability} — shared detection functions
 * @see {@link formatDoctorText}, {@link formatDoctorJson} — output rendering
 */

import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkLspForLanguage } from '../core/lsp/availability.js';

/**
 * Report entry for a single tool's availability.
 */
export interface ToolAvailability {
  command: string;
  available: boolean;
  path?: string;
  installHint?: string;
}

/**
 * Per-language LSP availability status (for JSON/text rendering).
 */
export interface LspLanguageStatus {
  available: boolean;
  /** 'bundled' for TypeScript only */
  mode?: string;
  command?: string;
  path?: string;
  installHint?: string;
}

/**
 * Complete environment diagnostic report.
 * Top-level shape for JSON output (see doctor.contract.md).
 */
export interface DoctorReport {
  runtime: {
    node: ToolAvailability;
    spaghettiCompass: ToolAvailability;
  };
  lsp: {
    typescript: LspLanguageStatus;
    php: LspLanguageStatus;
    python: LspLanguageStatus;
    go: LspLanguageStatus;
  };
}

/**
 * Detects a tool via which/where or direct path check.
 * Never throws; returns availability=false on any error.
 */
function checkTool(command: string): ToolAvailability {
  try {
    const whichCmd = process.platform === 'win32' ? 'where' : 'which';
    const path = execSync(`${whichCmd} ${command}`, {
      stdio: 'pipe',
      encoding: 'utf-8',
    })
      .trim()
      .split('\n')[0];

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
 * Builds the complete environment report.
 * Detects Node, spaghetti-compass binary, bundled TypeScript, and LSP tools.
 *
 * @returns Complete DoctorReport ready for text or JSON rendering
 */
export function buildDoctorReport(): DoctorReport {
  // Get node info
  const nodePath = process.execPath;

  // Get spaghetti-compass info
  let spaghettiCompassPath: string | undefined;
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const binPath = path.resolve(__dirname, '../../bin/spaghetti-compass.js');
    spaghettiCompassPath = binPath;
  } catch {
    // Try PATH lookup
    const tool = checkTool('spaghetti-compass');
    spaghettiCompassPath = tool.path;
  }

  // Check LSPs
  const phpAvail = checkLspForLanguage('php');
  const pythonAvail = checkLspForLanguage('python');
  const goAvail = checkLspForLanguage('go');

  return {
    runtime: {
      node: {
        command: 'node',
        available: true,
        path: nodePath,
      },
      spaghettiCompass: {
        command: 'spaghetti-compass',
        available: !!spaghettiCompassPath,
        path: spaghettiCompassPath,
      },
    },
    lsp: {
      typescript: {
        available: true,
        mode: 'bundled',
      },
      php: {
        available: phpAvail.available,
        command: phpAvail.command,
        path: phpAvail.path,
        installHint: phpAvail.installHint,
      },
      python: {
        available: pythonAvail.available,
        command: pythonAvail.command,
        path: pythonAvail.path,
        installHint: pythonAvail.installHint,
      },
      go: {
        available: goAvail.available,
        command: goAvail.command,
        path: goAvail.path,
        installHint: goAvail.installHint,
      },
    },
  };
}

/**
 * Determines exit code for doctor command.
 * Returns 0 iff Node and spaghetti-compass are available (FR-013).
 * Non-zero only on unexpected failure (FR-014).
 *
 * @param report - The built doctor report
 * @returns Exit code: 0 if healthy, non-zero otherwise
 */
export function getDoctorExitCode(report: DoctorReport): number {
  if (report.runtime.node.available && report.runtime.spaghettiCompass.available) {
    return 0;
  }
  return 1;
}
