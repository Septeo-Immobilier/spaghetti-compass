/**
 * Output formatters for the reverse impact analysis.
 */

import type { ImpactResult } from '../core/impact.js';

export interface ImpactFormatOptions {
  /** Use absolute paths */
  absolutePaths?: boolean;
  /** Disable the clickable path:line:column format */
  noLinks?: boolean;
  /** Context root (used to rebuild absolute paths) */
  rootPath?: string;
}

const SYMBOLS = {
  target: '🎯',
  context: '📁',
  stats: '📊',
  route: '🚪',
  chain: '↳',
  dependent: '📄',
  test: '🧪',
  branch: '├──',
  lastBranch: '└──',
};

/** Puts a path in the clickable format (path:1:1) when links are enabled. */
function clickable(relPath: string, options: ImpactFormatOptions): string {
  let p = relPath;
  if (options.absolutePaths && options.rootPath && !relPath.startsWith('/')) {
    p = `${options.rootPath}/${relPath}`;
  }
  return options.noLinks ? p : `${p}:1:1`;
}

/**
 * Formats the impact result as readable text.
 */
export function formatImpactText(result: ImpactResult, options: ImpactFormatOptions = {}): string {
  const lines: string[] = [];
  const sep = '═'.repeat(65);

  lines.push(sep);
  lines.push(` ${SYMBOLS.target} Target: ${clickable(result.target, options)}`);
  lines.push(` ${SYMBOLS.context} Scanned: ${result.scannedFiles} files`);
  lines.push(
    ` ${SYMBOLS.stats} Impact: ${result.dependents.length} dependent(s), ` +
      `${result.directDependents.length} direct, ${result.routes.length} route(s) impacted`
  );
  lines.push(` ${SYMBOLS.route} Route patterns: ${result.routePatterns.join(', ')}`);
  lines.push(sep);
  lines.push('');

  if (result.targetIsRoute) {
    lines.push(`${SYMBOLS.route} NOTE: the target itself matches a route pattern.`);
    lines.push('');
  }

  if (result.dependents.length === 0) {
    lines.push(
      result.granularity === 'package'
        ? '⚠️  No file in the scanned context imports this package — but Go analysis is package-granular, so this is not a proof that the file is unused.'
        : '✅ No file depends on this target — modifying it impacts nothing else.'
    );
    // A target reached only by tests has an empty blast radius and a non-empty
    // coverage answer. Returning here without the tests would hide the one
    // useful thing left to say about it.
    appendCoveringTests(lines, result, options);
    return lines.join('\n');
  }

  // Impacted routes (the core of the need: which routes to verify).
  if (result.routes.length > 0) {
    lines.push(`${SYMBOLS.route} IMPACTED ROUTES (verify these):`);
    result.routes.forEach((route, idx) => {
      const isLast = idx === result.routes.length - 1;
      const branch = isLast ? SYMBOLS.lastBranch : SYMBOLS.branch;
      lines.push(`${branch} ${clickable(route.path, options)}`);
      // Chain route -> ... -> target
      const indent = isLast ? '    ' : '│   ';
      const chainStr = route.chain
        .map((c) => c.split('/').pop() ?? c)
        .join(` ${SYMBOLS.chain} `);
      lines.push(`${indent}${SYMBOLS.chain} ${chainStr}`);
    });
    lines.push('');
  } else {
    lines.push(
      `⚠️  No route matched ${result.routePatterns.join(', ')} among the dependents.`
    );
    lines.push(
      '    Use --routes to point at your entry points, or inspect the dependents below.'
    );
    lines.push('');
  }

  // Direct dependents.
  lines.push(`${SYMBOLS.dependent} DIRECT DEPENDENTS (import the target directly):`);
  result.directDependents.forEach((dep, idx) => {
    const isLast = idx === result.directDependents.length - 1;
    const branch = isLast ? SYMBOLS.lastBranch : SYMBOLS.branch;
    lines.push(`${branch} ${clickable(dep, options)}`);
  });
  lines.push('');

  // All transitive dependents.
  lines.push(`${SYMBOLS.dependent} ALL TRANSITIVE DEPENDENTS (${result.dependents.length}):`);
  result.dependents.forEach((dep, idx) => {
    const isLast = idx === result.dependents.length - 1;
    const branch = isLast ? SYMBOLS.lastBranch : SYMBOLS.branch;
    lines.push(`${branch} ${clickable(dep, options)}`);
  });

  appendCoveringTests(lines, result, options);

  return lines.join('\n');
}

/**
 * Appends the covering-tests section — the tests that already reach the target,
 * and therefore the ones to re-run. Kept visually distinct from the dependent
 * lists above, which carry production code only.
 */
function appendCoveringTests(
  lines: string[],
  result: ImpactResult,
  options: ImpactFormatOptions
): void {
  if (result.coveringTests.length === 0) {
    return;
  }
  lines.push('');
  lines.push(`${SYMBOLS.test} COVERING TESTS (${result.coveringTests.length}, re-run these):`);
  result.coveringTests.forEach((test, idx) => {
    const isLast = idx === result.coveringTests.length - 1;
    const branch = isLast ? SYMBOLS.lastBranch : SYMBOLS.branch;
    lines.push(`${branch} ${clickable(test, options)}`);
  });
}

/**
 * Formats the impact result as JSON.
 */
export function formatImpactJson(result: ImpactResult): string {
  return JSON.stringify(result, null, 2);
}
