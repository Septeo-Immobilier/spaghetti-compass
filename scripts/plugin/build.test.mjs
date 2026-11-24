import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildPlugin, PLUGIN } from './build.mjs';
import { commitBump, nextVersion } from './next-version.mjs';

test('commitBump: feat is minor, breaking is major, the rest none', () => {
  assert.equal(commitBump('feat(mcp): x'), 'minor');
  assert.equal(commitBump('feat!: x'), 'major');
  assert.equal(commitBump('chore: x\n\nBREAKING CHANGE: y'), 'major');
  assert.equal(commitBump('fix: x'), 'none');
  assert.equal(commitBump('docs: x'), 'none');
});

test('nextVersion never stays below a patch bump', () => {
  assert.equal(nextVersion('1.1.5', []), '1.1.6');
  assert.equal(nextVersion('1.1.5', ['chore: a', 'fix: b']), '1.1.6');
  assert.equal(nextVersion('1.1.5', ['fix: a', 'feat: b']), '1.2.0');
  assert.equal(nextVersion('1.1.5', ['feat!: a']), '2.0.0');
  assert.throws(() => nextVersion('1.1', []));
});

test('buildPlugin writes a self-contained marketplace', async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-plugin-'));
  const dir = path.join(out, 'build');
  try {
    await buildPlugin({ out: dir, version: '9.9.9' });
    const read = (p) => JSON.parse(fs.readFileSync(path.join(dir, p), 'utf8'));
    const mkt = read('.claude-plugin/marketplace.json');
    assert.equal(mkt.plugins[0].name, PLUGIN);
    assert.equal(mkt.plugins[0].version, '9.9.9');
    assert.equal(mkt.plugins[0].source, `./plugins/${PLUGIN}`);
    const base = `plugins/${PLUGIN}`;
    assert.equal(read(`${base}/.claude-plugin/plugin.json`).version, '9.9.9');
    const mcp = read(`${base}/.mcp.json`).mcpServers[PLUGIN];
    assert.equal(mcp.command, 'node');
    assert.deepEqual(mcp.args, ['${CLAUDE_PLUGIN_ROOT}/mcp/server.mjs']);
    assert.ok(fs.existsSync(path.join(dir, base, 'skills', PLUGIN, 'SKILL.md')));

    // The bundle must start with no node_modules around it.
    const bundle = path.join(dir, base, 'mcp/server.mjs');
    const isolated = path.join(out, 'isolated.mjs');
    fs.copyFileSync(bundle, isolated);
    const probe = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import { Client } from ${JSON.stringify(path.resolve('mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js'))};
         import { StdioClientTransport } from ${JSON.stringify(path.resolve('mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js'))};
         const c = new Client({ name: 't', version: '0' });
         await c.connect(new StdioClientTransport({ command: process.execPath, args: [${JSON.stringify(isolated)}] }));
         const { tools } = await c.listTools(); console.log(tools.length); await c.close();`,
      ],
      { encoding: 'utf8' }
    );
    assert.equal(probe.stdout.trim(), '6', probe.stderr);
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test('buildPlugin refuses a bad version and a foreign non-empty directory', async () => {
  await assert.rejects(buildPlugin({ out: '/tmp/x', version: 'v1' }), /invalid --version/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-foreign-'));
  fs.writeFileSync(path.join(dir, 'precious.txt'), 'keep');
  try {
    await assert.rejects(buildPlugin({ out: dir, version: '1.0.0' }), /refusing to clean/);
    assert.ok(fs.existsSync(path.join(dir, 'precious.txt')));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
