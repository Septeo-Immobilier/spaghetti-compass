/**
 * Pure reshaping of CLI JSON into compact, LLM-friendly answers.
 * No I/O here, so everything is unit-testable with canned CLI output.
 */

import * as path from 'node:path';

export const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|pyi|php|go)$/i;
/** Extensions `impact` scans by default (no .mjs/.cjs: see the skill). */
export const IMPACT_EXT = /\.(ts|tsx|js|jsx|py|pyi|php|go)$/i;

/** Keep the first `max` items and say how many were dropped. */
export function cap(list, max) {
  const items = list.slice(0, max);
  return { items, omitted: Math.max(0, list.length - items.length) };
}

/** Make a CLI path (relative or absolute) relative to the project root. */
export function relativize(p, root) {
  if (!p) return p;
  return path.isAbsolute(p) ? path.relative(root, p) || '.' : p;
}

/** `explore` only scans ts/js/go by default: widen it for Python and PHP entries. */
export function includeGlobsFor(file) {
  if (/\.pyi?$/i.test(file)) return ['**/*.py', '**/*.pyi'];
  if (/\.php$/i.test(file)) return ['**/*.php'];
  return [];
}

/** `impact` JSON → compact answer. */
export function shapeImpact(r, { maxFiles = 80 } = {}) {
  const direct = new Set(r.directDependents);
  const dependents = cap(r.dependents, maxFiles);
  return {
    target: r.target,
    granularity: r.granularity,
    ...(r.granularityNote ? { granularityNote: r.granularityNote } : {}),
    summary:
      `${r.dependents.length} dependent(s) (${r.directDependents.length} direct), ` +
      `${r.routes.length} route(s) impacted, ${r.coveringTests.length} covering test(s), ` +
      `${r.scannedFiles} files scanned`,
    targetIsRoute: r.targetIsRoute,
    routes: r.routes.map((x) => ({ path: x.path, chain: x.chain })),
    directDependents: r.directDependents,
    otherDependents: dependents.items.filter((f) => !direct.has(f)),
    omittedDependents: dependents.omitted,
    coveringTests: r.coveringTests,
    ...(r.dependents.length === 0
      ? {
          warning:
            r.granularity === 'package'
              ? 'Nothing in the scanned context imports this Go package. Go is package-granular: this is NOT proof the file is unused. Widen the search (grep the symbol, check `context`).'
              : 'Nothing the parsers could read imports this file. A file whose parser throws contributes no edges, so this is not an absolute proof.',
        }
      : {}),
  };
}

/** Escape a string for use inside a RegExp. */
export function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Split dependents by whether their source text mentions the symbol.
 * Heuristic (word-boundary match on the last segment, `Class.method` → `method`),
 * deliberately labelled as such by the tool: it narrows a FILE-level answer, it
 * is not a semantic reference search.
 */
export function splitByMention(dependents, symbol, readText) {
  const needle = symbol.split(/[.:/]/).filter(Boolean).pop() ?? symbol;
  const re = new RegExp(`(?<![\\w$])${escapeRegExp(needle)}(?![\\w$])`);
  const mentioning = [];
  const others = [];
  for (const file of dependents) {
    let text = null;
    try {
      text = readText(file);
    } catch {
      /* unreadable → cannot claim a mention */
    }
    (text !== null && re.test(text) ? mentioning : others).push(file);
  }
  return { needle, mentioning, others };
}

/** Aggregate per-file impact results for a review. */
export function aggregateReview(perFile) {
  const routes = new Map();
  const tests = new Set();
  for (const { file, impact } of perFile) {
    for (const r of impact.routes) {
      const entry = routes.get(r.path) ?? { path: r.path, because: [] };
      entry.because.push({ changedFile: file, chain: r.chain });
      routes.set(r.path, entry);
    }
    impact.coveringTests.forEach((t) => tests.add(t));
  }
  return {
    routesToRetest: [...routes.values()].sort((a, b) => a.path.localeCompare(b.path)),
    testsToRun: [...tests].sort(),
    perFile: perFile.map(({ file, impact }) => ({
      file,
      dependents: impact.dependents.length,
      routes: impact.routes.length,
      coveringTests: impact.coveringTests.length,
      granularity: impact.granularity,
    })),
  };
}

/**
 * Render the call graph of `explore file:symbol` as an indented tree.
 * Walks `call` edges from the entry node; a node already on the path is marked
 * `(recursion)`, one already printed elsewhere `(see above)`. Capped by `maxLines`.
 */
export function renderCallTree(graph, root, { maxLines = 150 } = {}) {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const out = new Map();
  for (const e of graph.edges) {
    if (e.type !== 'call') continue;
    if (!out.has(e.from)) out.set(e.from, []);
    out.get(e.from).push(e);
  }
  const entry = graph.nodes.find((n) => n.type === 'function' && n.depth === 0) ?? graph.nodes[0];
  const lines = [];
  const printed = new Set();
  let truncated = false;

  // node.path is context-relative; edge targets are absolute. Rebuild a root-relative
  // path from the node id (`<abs file>:<symbol>`) so the whole tree speaks one dialect.
  const where = (n, line) => {
    if (!n?.path) return '';
    const abs = n.type === 'function' && n.id.includes(':') ? n.id.slice(0, n.id.lastIndexOf(':')) : null;
    const p = abs && path.isAbsolute(abs) ? relativize(abs, root) : n.path;
    return `${p}${line ? `:${line}` : ''}`;
  };

  const walk = (id, indent, trail) => {
    for (const e of out.get(id) ?? []) {
      if (lines.length >= maxLines) {
        truncated = true;
        return;
      }
      const target = nodes.get(e.to);
      const name = target?.name ?? e.to;
      const loc = e.targetPath
        ? `${relativize(e.targetPath, root)}${e.targetLine ? `:${e.targetLine}` : ''}`
        : where(target, target?.line);
      const tag = e.resolved ? '' : ' (unresolved)';
      const pad = '  '.repeat(indent);
      if (trail.has(e.to)) {
        lines.push(`${pad}- ${name} [${loc}] (recursion)`);
      } else if (printed.has(e.to)) {
        lines.push(`${pad}- ${name} [${loc}] (see above)`);
      } else {
        lines.push(`${pad}- ${name} [${loc}] called at line ${e.line ?? '?'}${tag}`);
        printed.add(e.to);
        walk(e.to, indent + 1, new Set([...trail, e.to]));
      }
    }
  };

  if (entry) {
    printed.add(entry.id);
    walk(entry.id, 0, new Set([entry.id]));
  }
  return {
    entry: entry ? `${entry.name} [${where(entry, entry.line)}]` : root,
    tree: lines.join('\n') || '(no outgoing calls found)',
    callCount: graph.edges.filter((e) => e.type === 'call').length,
    truncated,
  };
}

/** `explore file` JSON (file mode) → compact dependency answer. */
export function shapeDependencies(graph, root, { maxEdges = 200 } = {}) {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const label = (id) => {
    const n = nodes.get(id);
    return n?.path ? n.path : (n?.name ?? relativize(id, root));
  };
  const internal = graph.nodes
    .filter((n) => n.type === 'file' && n.location === 'internal')
    .map((n) => n.path);
  const thirdParty = [
    ...new Set(
      graph.nodes
        .filter((n) => n.location === 'third-party' || n.type === 'external-module')
        .map((n) => n.name)
    ),
  ].sort();
  const imports = graph.edges
    .filter((e) => e.type !== 'call' && nodes.get(e.to)?.location === 'internal')
    .map(
      (e) =>
        `${label(e.from)} → ${label(e.to)}${e.line ? ` (line ${e.line})` : ''}${
          e.type === 'import-dynamic' ? ' [dynamic]' : ''
        }`
    );
  const edges = cap(imports, maxEdges);
  const unresolved = graph.edges
    .filter((e) => !e.resolved)
    .map((e) => `${label(e.from)} → ${e.to}${e.line ? ` (line ${e.line})` : ''}`);
  return {
    entry: graph.entryPoint ? relativize(graph.entryPoint, root) : undefined,
    summary: `${internal.length} internal file(s), ${thirdParty.length} third-party module(s), ${graph.stats.circularDependencies.length} cycle(s), ${unresolved.length} unresolved import(s)`,
    cycles: graph.stats.circularDependencies.map((c) => c.map((x) => relativize(x, root))),
    internalFiles: internal,
    thirdParty,
    internalImports: edges.items,
    omittedImports: edges.omitted,
    unresolved: cap(unresolved, 50).items,
  };
}
