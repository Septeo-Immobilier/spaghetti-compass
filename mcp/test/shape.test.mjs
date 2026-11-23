import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateReview,
  includeGlobsFor,
  renderCallTree,
  shapeDependencies,
  shapeImpact,
  splitByMention,
} from '../lib/shape.mjs';
import { resolveLauncher } from '../lib/cli.mjs';

const impact = (over = {}) => ({
  target: 'a.ts',
  scannedFiles: 10,
  directDependents: ['b.ts'],
  dependents: ['b.ts', 'c.ts'],
  routes: [{ path: 'c.controller.ts', chain: ['c.controller.ts', 'b.ts', 'a.ts'] }],
  coveringTests: ['b.test.ts'],
  targetIsRoute: false,
  granularity: 'file',
  granularityNote: null,
  ...over,
});

test('shapeImpact separates direct and transitive dependents', () => {
  const s = shapeImpact(impact());
  assert.deepEqual(s.directDependents, ['b.ts']);
  assert.deepEqual(s.otherDependents, ['c.ts']);
  assert.match(s.summary, /2 dependent\(s\) \(1 direct\), 1 route/);
  assert.equal(s.warning, undefined);
});

test('shapeImpact warns on an empty Go answer, never claims it is unused', () => {
  const s = shapeImpact(impact({ dependents: [], directDependents: [], routes: [], granularity: 'package' }));
  assert.match(s.warning, /NOT proof/);
});

test('splitByMention matches whole identifiers only, last segment of Class.method', () => {
  const files = { 'b.ts': 'x.register(1)', 'c.ts': 'const registered = 1; // preregister', 'd.ts': 'boom' };
  const read = (f) => {
    if (!(f in files)) throw new Error('nope');
    return files[f];
  };
  const r = splitByMention(['b.ts', 'c.ts', 'd.ts', 'gone.ts'], 'AuthService.register', read);
  assert.equal(r.needle, 'register');
  assert.deepEqual(r.mentioning, ['b.ts']);
  assert.deepEqual(r.others, ['c.ts', 'd.ts', 'gone.ts']);
});

test('aggregateReview merges routes and tests across changed files', () => {
  const agg = aggregateReview([
    { file: 'a.ts', impact: impact() },
    { file: 'z.ts', impact: impact({ coveringTests: ['z.test.ts', 'b.test.ts'] }) },
  ]);
  assert.equal(agg.routesToRetest.length, 1);
  assert.equal(agg.routesToRetest[0].because.length, 2);
  assert.deepEqual(agg.testsToRun, ['b.test.ts', 'z.test.ts']);
});

test('renderCallTree walks call edges and marks recursion / repeats', () => {
  const n = (id, name, depth) => ({ id, type: 'function', name, path: 'f.ts', line: 1, depth });
  const e = (from, to, line) => ({ from, to, type: 'call', resolved: true, line, targetPath: '/r/f.ts', targetLine: 9 });
  const graph = {
    nodes: [n('A', 'A', 0), n('B', 'B', 1), n('C', 'C', 2)],
    edges: [e('A', 'B', 3), e('B', 'C', 4), e('C', 'A', 5), e('A', 'C', 6)],
  };
  const { tree, callCount } = renderCallTree(graph, '/r');
  assert.equal(callCount, 4);
  assert.match(tree, /- B \[f.ts:9\] called at line 3/);
  assert.match(tree, /- A \[f.ts:9\] \(recursion\)/);
  assert.match(tree, /- C \[f.ts:9\] \(see above\)/);
});

test('shapeDependencies reports cycles and third-party modules', () => {
  const graph = {
    entryPoint: '/r/a.ts',
    nodes: [
      { id: '/r/a.ts', type: 'file', name: 'a.ts', path: 'a.ts', location: 'internal' },
      { id: '/r/b.ts', type: 'file', name: 'b.ts', path: 'b.ts', location: 'internal' },
      { id: 'node:fs', type: 'external-module', name: 'node:fs', location: 'third-party' },
    ],
    edges: [
      { from: '/r/a.ts', to: '/r/b.ts', type: 'import-static', resolved: true, line: 1 },
      { from: '/r/a.ts', to: 'node:fs', type: 'import-static', resolved: true, line: 2 },
    ],
    stats: { circularDependencies: [['/r/a.ts', '/r/b.ts', '/r/a.ts']] },
  };
  const s = shapeDependencies(graph, '/r');
  assert.deepEqual(s.thirdParty, ['node:fs']);
  assert.deepEqual(s.cycles, [['a.ts', 'b.ts', 'a.ts']]);
  assert.deepEqual(s.internalImports, ['a.ts → b.ts (line 1)']);
});

test('includeGlobsFor widens only Python and PHP', () => {
  assert.deepEqual(includeGlobsFor('x/y.py'), ['**/*.py', '**/*.pyi']);
  assert.deepEqual(includeGlobsFor('x/y.php'), ['**/*.php']);
  assert.deepEqual(includeGlobsFor('x/y.ts'), []);
});

test('resolveLauncher honours the override, then repo build, then PATH, then npx', () => {
  assert.deepEqual(resolveLauncher({ SPAGHETTI_COMPASS_BIN: 'node /x/cli.js' }, () => false).args, ['/x/cli.js']);
  assert.equal(resolveLauncher({ PATH: '/bin' }, () => false).source, 'npx');
  assert.equal(resolveLauncher({ PATH: '/bin' }, (p) => p === '/bin/spaghetti-compass').source, 'PATH');
  assert.equal(resolveLauncher({ PATH: '' }, () => true).source, 'repo build');
});
