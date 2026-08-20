/**
 * Tests for the text formatter of the reverse impact analysis
 * (`formatImpactText`), covering granularity-aware empty-result rendering.
 *
 * See contracts/impact-cli.md sections 1, 4 and 5 for the fixed strings and
 * cases asserted here.
 */

import { describe, it, expect } from 'vitest';
import { formatImpactText } from './impact.js';
import type { ImpactResult } from '../core/impact.js';

const LINE_EXACT_EMPTY =
  '✅ No file depends on this target — modifying it impacts nothing else.';
const LINE_PKG_EMPTY =
  '⚠️  No file in the scanned context imports this package — but Go analysis is package-granular, so this is not a proof that the file is unused.';

function baseResult(overrides: Partial<ImpactResult>): ImpactResult {
  return {
    target: 'target.ts',
    targetAbsolute: '/repo/target.ts',
    scannedFiles: 3,
    directDependents: [],
    dependents: [],
    routes: [],
    routePatterns: ['**/main.ts'],
    targetIsRoute: false,
    granularity: 'file',
    granularityNote: null,
    ...overrides,
  };
}

describe('formatImpactText — granularity-aware empty result', () => {
  it('still prints LINE-EXACT-EMPTY byte-identical for a file-granularity empty result', () => {
    const result = baseResult({ granularity: 'file', granularityNote: null });

    const output = formatImpactText(result);

    expect(output).toContain(LINE_EXACT_EMPTY);
    expect(output).not.toContain(LINE_PKG_EMPTY);
  });

  it('replaces LINE-EXACT-EMPTY with LINE-PKG-EMPTY for a package-granularity empty result', () => {
    const result = baseResult({
      granularity: 'package',
      granularityNote:
        'Go analysis resolves imports at package granularity: no file in the scanned context imports internal/repo, but this is a package-level observation and may be incomplete.',
    });

    const output = formatImpactText(result);

    expect(output).not.toContain(LINE_EXACT_EMPTY);
    expect(output).toContain(LINE_PKG_EMPTY);
  });

  it('produces byte-identical stdout for a package-granularity non-empty result (ANALYZE A-005)', () => {
    const fileResult = baseResult({
      granularity: 'file',
      granularityNote: null,
      dependents: ['services/user-service.ts'],
      directDependents: ['services/user-service.ts'],
    });
    const packageResult = baseResult({
      granularity: 'package',
      granularityNote:
        'Go analysis resolves imports at package granularity: every non-test file of internal/repo shares this dependents set.',
      dependents: ['services/user-service.ts'],
      directDependents: ['services/user-service.ts'],
    });

    expect(formatImpactText(packageResult)).toBe(formatImpactText(fileResult));
  });
});
