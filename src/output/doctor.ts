/**
 * @module doctor-output
 * @description Renders DoctorReport as text or JSON per doctor.contract.md.
 * Provides human-readable diagnostics and machine-parseable structured output.
 *
 * @see {@link buildDoctorReport} — builds the report
 * @see {@link doctor.contract.md} — output format specification
 */

import type { DoctorReport, LspLanguageStatus } from '../cli/doctor.js';

/**
 * Formats a DoctorReport as human-readable text (aligned table).
 * Output conforms to doctor.contract.md text example.
 *
 * @param report - The doctor report
 * @returns Text string for stdout, ends with LSP note
 */
export function formatDoctorText(report: DoctorReport): string {
  const lines: string[] = [];

  lines.push('Spaghetti Compass environment');
  lines.push('');

  // Runtime tools
  formatToolLine(lines, 'spaghetti-compass', report.runtime.spaghettiCompass);
  formatToolLine(lines, 'node', report.runtime.node);

  // TypeScript (always bundled)
  lines.push(`OK   TypeScript            bundled`);

  // LSP tools
  formatToolLine(lines, 'intelephense', report.lsp.php);
  formatToolLine(lines, 'pyright-langserver', report.lsp.python);
  formatToolLine(lines, 'gopls', report.lsp.go);

  lines.push('');
  lines.push(
    'LSP note: spaghetti-compass starts its own LSP processes when available; it does not reuse VSCode/Cursor LSP sessions.'
  );

  return lines.join('\n');
}

/**
 * Helper: format a single OK/MISS line for text output.
 */
function formatToolLine(
  lines: string[],
  displayName: string,
  tool: any
): void {
  if (tool.available) {
    const location = tool.mode === 'bundled' ? 'bundled' : tool.path || 'unknown';
    lines.push(`OK   ${displayName.padEnd(20)} ${location}`);
  } else {
    const hint = tool.installHint || 'unknown installation method';
    lines.push(`MISS ${displayName.padEnd(20)} install with: ${hint}`);
  }
}

/**
 * Formats a DoctorReport as JSON (stable { runtime, lsp } shape).
 * Output conforms to doctor.contract.md JSON example.
 *
 * @param report - The doctor report
 * @returns JSON string for stdout
 */
export function formatDoctorJson(report: DoctorReport): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const output: any = {
    runtime: {
      node: {
        available: report.runtime.node.available,
        path: report.runtime.node.path,
      },
      spaghettiCompass: {
        available: report.runtime.spaghettiCompass.available,
        path: report.runtime.spaghettiCompass.path,
      },
    },
    lsp: {
      typescript: report.lsp.typescript,
      php: buildLspEntry(report.lsp.php),
      python: buildLspEntry(report.lsp.python),
      go: buildLspEntry(report.lsp.go),
    },
  };

  return JSON.stringify(output, null, 2);
}

/**
 * Helper: build LSP entry for JSON output.
 * Omits path/installHint when not needed; uses mode for TypeScript.
 */
function buildLspEntry(status: LspLanguageStatus): LspLanguageStatus {
  if (status.mode === 'bundled') {
    return { available: true, mode: 'bundled' };
  }

  const entry: LspLanguageStatus = {
    available: status.available,
    command: status.command,
  };

  if (status.path) {
    entry.path = status.path;
  }

  if (status.installHint) {
    entry.installHint = status.installHint;
  }

  return entry;
}
