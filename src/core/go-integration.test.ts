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

describe('T003 — package-vs-file asymmetry (internal/notify fixture)', () => {
  it('sender.go and aaa_marker.go report identical dependents/directDependents/routes, both containing cmd/notifier/main.go', () => {
    const analyzer = new ImpactAnalyzer(goContext());
    const options = { routePatterns: ['**/main.go'] };

    const senderResult = analyzer.analyze(
      path.join(goFixtures, 'internal/notify/sender.go'),
      options
    );
    const markerResult = analyzer.analyze(
      path.join(goFixtures, 'internal/notify/aaa_marker.go'),
      options
    );

    expect(senderResult.dependents).toEqual(markerResult.dependents);
    expect(senderResult.directDependents).toEqual(markerResult.directDependents);
    expect(senderResult.routes.map((r) => r.path)).toEqual(
      markerResult.routes.map((r) => r.path)
    );

    expect(senderResult.dependents.some((d) => d.includes('cmd/notifier/main.go'))).toBe(true);
    expect(markerResult.dependents.some((d) => d.includes('cmd/notifier/main.go'))).toBe(true);
  });

  it('context boundary (NFR-002): excluding cmd/notifier/main.go from the scanned context removes it from sender.go dependents', () => {
    const options = { routePatterns: ['**/main.go'] };

    // Baseline: with no exclude, cmd/notifier/main.go is a real importer of
    // sender.go's package and must show up as a dependent.
    const withoutExclude = new ImpactAnalyzer(goContext()).analyze(
      path.join(goFixtures, 'internal/notify/sender.go'),
      options
    );
    expect(
      withoutExclude.dependents.some((d) => d.includes('cmd/notifier/main.go'))
    ).toBe(true);

    // Excluding the importer from the scanned context must remove it from
    // both the transitive and the direct dependent sets.
    const excludedContext: ContextInfo = {
      ...goContext(),
      excludePatterns: ['**/cmd/notifier/main.go'],
    };
    const withExclude = new ImpactAnalyzer(excludedContext).analyze(
      path.join(goFixtures, 'internal/notify/sender.go'),
      options
    );
    expect(
      withExclude.dependents.some((d) => d.includes('cmd/notifier/main.go'))
    ).toBe(false);
    expect(
      withExclude.directDependents.some((d) => d.includes('cmd/notifier/main.go'))
    ).toBe(false);
  });
});

describe('T008 — granularity marker on Go targets (US2, FR-004)', () => {
  it('non-empty Go target (internal/notify/sender.go) carries granularity: package with a non-null note', () => {
    const analyzer = new ImpactAnalyzer(goContext());
    const result = analyzer.analyze(
      path.join(goFixtures, 'internal/notify/sender.go'),
      { routePatterns: ['**/main.go'] }
    );

    expect(result.dependents.length).toBeGreaterThan(0);
    expect(result.granularity).toBe('package');
    expect(result.granularityNote).not.toBeNull();
  });

  it('empty Go target (cmd/service/main.go, quickstart.md step 4) also carries granularity: package with a non-null note', () => {
    const analyzer = new ImpactAnalyzer(goContext());
    const result = analyzer.analyze(
      path.join(goFixtures, 'cmd/service/main.go'),
      { routePatterns: ['**/main.go'] }
    );

    expect(result.dependents.length).toBe(0);
    expect(result.granularity).toBe('package');
    expect(result.granularityNote).not.toBeNull();
  });
});
