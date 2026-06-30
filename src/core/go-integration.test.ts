/**
 * Integration tests for Go language support — Analyzer + ImpactAnalyzer against fixtures/go.
 *
 * Covers:
 *   SC-001  Analyzer on main.go -> ≥1 internal node + ≥1 third-party node
 *   SC-003  Analyzer function-level on ReceiveInvoice.Execute -> method node + ≥2 call edges
 *   SC-002  ImpactAnalyzer on entity.go -> dependents include use case / handler / main
 */

import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Analyzer } from './analyzer.js';
import { ImpactAnalyzer } from './impact.js';
import type { ContextInfo } from '../types/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const goFixtures = path.join(repoRoot, 'fixtures/go');

function goContext(): ContextInfo {
  return {
    rootPath: goFixtures,
    projectRoot: goFixtures,
    includePatterns: ['**/*.go'],
    excludePatterns: [],
  };
}

describe('SC-001 — Analyzer.analyze(main.go)', () => {
  it('graph has ≥1 internal Go node AND ≥1 third-party node', async () => {
    const analyzer = new Analyzer(goContext());
    const graph = await analyzer.analyze(
      path.join(goFixtures, 'cmd/service/main.go'),
      {}
    );

    const internalNodes = graph.nodes.filter((n) => n.location === 'internal');
    const thirdPartyNodes = graph.nodes.filter((n) => n.location === 'third-party');

    expect(internalNodes.length).toBeGreaterThanOrEqual(1);
    expect(thirdPartyNodes.length).toBeGreaterThanOrEqual(1);
  });
});

describe('SC-003 — Analyzer.analyze(receive_invoice.go, {functionName})', () => {
  it('method node ReceiveInvoice.Execute exists and has ≥2 call edges', async () => {
    const analyzer = new Analyzer(goContext());
    const graph = await analyzer.analyze(
      path.join(goFixtures, 'internal/application/usecases/receive_invoice.go'),
      { functionName: 'ReceiveInvoice.Execute' }
    );

    // The entry-point function node must exist
    const executeNode = graph.nodes.find(
      (n) => n.type === 'function' && n.name === 'ReceiveInvoice.Execute'
    );
    expect(executeNode).toBeDefined();

    // There must be ≥2 call edges outgoing from the Execute node
    const callEdges = graph.edges.filter(
      (e) => e.type === 'call' && e.from === executeNode?.id
    );
    expect(callEdges.length).toBeGreaterThanOrEqual(2);
  });
});

describe('SC-002 — ImpactAnalyzer.analyze(entity.go)', () => {
  it('dependents include the use case and main.go', () => {
    const analyzer = new ImpactAnalyzer(goContext());
    const result = analyzer.analyze(
      path.join(goFixtures, 'internal/domain/invoice/entity.go'),
      { routePatterns: ['**/main.go', '**/*.go'] }
    );

    // At least the use case and main.go must appear in dependents
    const hasUseCase = result.dependents.some((d) => d.includes('receive_invoice'));
    const hasMain = result.dependents.some((d) => d.includes('main.go'));

    expect(hasUseCase).toBe(true);
    expect(hasMain).toBe(true);
  });

  it('entity.go has direct dependents (receive_invoice imports it)', () => {
    const analyzer = new ImpactAnalyzer(goContext());
    const result = analyzer.analyze(
      path.join(goFixtures, 'internal/domain/invoice/entity.go'),
      { routePatterns: ['**/main.go'] }
    );

    expect(result.directDependents.length).toBeGreaterThanOrEqual(1);
  });
});
