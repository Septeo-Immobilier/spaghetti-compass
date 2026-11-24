#!/usr/bin/env node
// Build the Claude Code marketplace that ships the `spaghetti-compass` plugin
// (skill + MCP server). Output layout, ready to be pushed to the `dist` branch:
//
//   .claude-plugin/marketplace.json
//   plugins/spaghetti-compass/.claude-plugin/plugin.json
//   plugins/spaghetti-compass/.mcp.json
//   plugins/spaghetti-compass/mcp/server.mjs      (esbuild bundle: SDK + zod inlined)
//   plugins/spaghetti-compass/skills/spaghetti-compass/...
//
// Usage: node scripts/plugin/build.mjs --out <dir> --version X.Y.Z

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

export const PLUGIN = 'spaghetti-compass';
const SEMVER = /^\d+\.\d+\.\d+$/;
const here = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(here, '../..');

const json = (v) => `${JSON.stringify(v, null, 2)}\n`;

export function manifests({ version, description, repository }) {
  return {
    marketplace: {
      name: PLUGIN,
      owner: { name: 'Septeo-Immobilier' },
      description: 'Semantic code navigation (impact analysis, call tracing, dependency graph) for AI agents.',
      plugins: [{ name: PLUGIN, source: `./plugins/${PLUGIN}`, description, version }],
    },
    plugin: {
      name: PLUGIN,
      description,
      version,
      author: { name: 'Septeo-Immobilier' },
      homepage: repository,
      repository,
      license: 'MIT',
      keywords: ['mcp', 'code-analysis', 'impact-analysis', 'dependency-graph', 'lsp'],
    },
    mcp: {
      mcpServers: {
        [PLUGIN]: { command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/mcp/server.mjs'] },
      },
    },
  };
}

export async function buildPlugin({ root = defaultRoot, out, version }) {
  if (!SEMVER.test(version ?? '')) throw new Error(`invalid --version '${version}' (expected X.Y.Z)`);
  if (!out) throw new Error('missing --out');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const repository = String(pkg.repository?.url ?? '').replace(/^git\+/, '').replace(/\.git$/, '');

  if (fs.existsSync(out) && fs.readdirSync(out).length) {
    if (!fs.existsSync(path.join(out, '.claude-plugin/marketplace.json'))) {
      throw new Error(`refusing to clean '${out}': not empty and not a previous build`);
    }
  }
  fs.rmSync(out, { recursive: true, force: true });

  const pluginDir = path.join(out, 'plugins', PLUGIN);
  const description =
    'Explore, review and narrate code with language-server-backed impact analysis, call tracing and dependency graphs: MCP tools plus the usage skill.';
  const m = manifests({ version, description, repository });

  fs.mkdirSync(path.join(out, '.claude-plugin'), { recursive: true });
  fs.mkdirSync(path.join(pluginDir, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(path.join(out, '.claude-plugin/marketplace.json'), json(m.marketplace));
  fs.writeFileSync(path.join(pluginDir, '.claude-plugin/plugin.json'), json(m.plugin));
  fs.writeFileSync(path.join(pluginDir, '.mcp.json'), json(m.mcp));

  // The plugin cache has no node_modules: inline everything into one file.
  await build({
    entryPoints: [path.join(root, 'mcp/server.mjs')],
    outfile: path.join(pluginDir, 'mcp/server.mjs'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    banner: {
      js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
    },
    logLevel: 'warning',
  });

  fs.cpSync(path.join(root, 'skills', PLUGIN), path.join(pluginDir, 'skills', PLUGIN), { recursive: true });
  return { out, pluginDir, version };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
  try {
    const r = await buildPlugin({ out: path.resolve(opt('--out') ?? 'dist-plugin'), version: opt('--version') });
    console.log(`Built ${PLUGIN} v${r.version} → ${r.out}`);
  } catch (err) {
    console.error(`BUILD FAILED: ${err.message}`);
    process.exit(1);
  }
}
