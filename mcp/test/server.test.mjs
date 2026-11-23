// End-to-end: spawn the real server over stdio and call tools against this repository.
// Needs the CLI built (`npm run build` at the repo root); skipped otherwise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const built = fs.existsSync(path.join(REPO, 'dist/cli/index.js'));

async function withClient(fn) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve(HERE, '../server.mjs')],
    cwd: REPO,
  });
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}
const call = async (client, name, args) => {
  const res = await client.callTool({ name, arguments: args });
  const text = res.content[0].text;
  return { isError: !!res.isError, text, json: res.isError ? null : JSON.parse(text) };
};

test('lists the six tools with descriptions', async () => {
  await withClient(async (c) => {
    const { tools } = await c.listTools();
    assert.deepEqual(
      tools.map((t) => t.name).sort(),
      ['doctor', 'explore_dependencies', 'impact_of_file', 'impact_of_symbol', 'review_changed_files', 'trace_calls']
    );
    for (const t of tools) assert.ok(t.description.length > 80, t.name);
  });
});

test('impact_of_file finds direct dependents', { skip: !built }, async () => {
  await withClient(async (c) => {
    const r = await call(c, 'impact_of_file', { file: 'src/core/graph.ts', context: 'src' });
    assert.ok(r.json.directDependents.includes('core/analyzer.ts'), r.text);
  });
});

test('impact_of_symbol narrows to mentioning dependents', { skip: !built }, async () => {
  await withClient(async (c) => {
    const r = await call(c, 'impact_of_symbol', { file: 'src/core/graph.ts', symbol: 'DependencyGraphBuilder', context: 'src' });
    assert.ok(Array.isArray(r.json.mentioning), r.text);
    assert.match(r.json.caveat, /HEURISTIC|textual/i);
  });
});

test('trace_calls renders a call tree', { skip: !built }, async () => {
  await withClient(async (c) => {
    const r = await call(c, 'trace_calls', { file: 'src/core/impact.ts', symbol: 'ImpactAnalyzer.analyze', depth: 2, context: 'src' });
    assert.match(r.json.tree, /collectFiles/, r.text);
  });
});

test('explore_dependencies lists internal files', { skip: !built }, async () => {
  await withClient(async (c) => {
    const r = await call(c, 'explore_dependencies', { file: 'src/core/impact.ts', transitive: false, context: 'src' });
    assert.ok(r.json.internalFiles.length > 1, r.text);
  });
});

test('review_changed_files aggregates a diff (needs a git checkout)', { skip: !built }, async () => {
  await withClient(async (c) => {
    const r = await call(c, 'review_changed_files', { base: 'HEAD~1', context: 'src' });
    assert.ok(r.json.range && 'routesToRetest' in r.json, r.text);
  });
});

test('doctor reports the launcher', { skip: !built }, async () => {
  await withClient(async (c) => {
    const r = await call(c, 'doctor', {});
    assert.match(r.json.launcher, /repo build/);
  });
});

test('errors are returned as isError, not thrown', { skip: !built }, async () => {
  await withClient(async (c) => {
    const r = await call(c, 'impact_of_file', { file: 'does/not/exist.ts' });
    assert.equal(r.isError, true);
    assert.match(r.text, /File not found/);
  });
});
