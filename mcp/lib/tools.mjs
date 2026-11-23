/**
 * Tool definitions: name, LLM-facing description, input schema, handler.
 * Each handler returns a plain object; `server.mjs` serialises it.
 */

import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';
import { runCli, runJson, resolveLauncher } from './cli.mjs';
import {
  IMPACT_EXT,
  aggregateReview,
  cap,
  includeGlobsFor,
  relativize,
  renderCallTree,
  shapeDependencies,
  shapeImpact,
  splitByMention,
} from './shape.mjs';

const rootArg = z
  .string()
  .optional()
  .describe(
    'Absolute path of the project to analyse. Defaults to the server working directory. ' +
      'Input `file` is relative to it.'
  );
const contextArg = z
  .string()
  .optional()
  .describe(
    'Directory (relative to root) that is scanned and treated as "internal". Default ".". ' +
      'Paths in impact/dependency answers are relative to THIS directory, so keep the default to get root-relative paths. ' +
      'Narrow it (e.g. "src") on a big monorepo to speed things up.'
  );

/** Resolve root, and turn `file` into a root-relative path that must exist. */
function resolveTarget({ root, file }) {
  const abs = path.resolve(root ?? process.cwd());
  const rel = relativize(path.isAbsolute(file) ? file : path.join(abs, file), abs);
  if (!fs.existsSync(path.join(abs, rel))) {
    throw new Error(`File not found: ${path.join(abs, rel)} (paths are relative to root ${abs})`);
  }
  return { root: abs, file: rel };
}

function git(root, args) {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd: root, maxBuffer: 16 * 1024 * 1024 }, (err, stdout) =>
      err ? reject(err) : resolve(stdout)
    );
  });
}

/** Changed source files: `<base>...HEAD`, else origin/main|master, else the working tree vs HEAD. */
async function changedFiles(root, base) {
  const ranges = base ? [`${base}...HEAD`] : ['origin/main...HEAD', 'origin/master...HEAD', 'HEAD'];
  let lastErr;
  for (const range of ranges) {
    try {
      const out = await git(root, ['diff', '--name-only', '-z', '--diff-filter=d', range]);
      const files = out.split('\0').filter(Boolean);
      return { range, files };
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(`git diff failed (${ranges.join(', ')}): ${lastErr?.message}`);
}

async function impactJson(root, file, context, extra = []) {
  const { data, stderr } = await runJson(['impact', file, '-c', context ?? '.', ...extra], {
    cwd: root,
  });
  return { impact: data, notes: stderr ? [stderr] : [] };
}

/** Run `fn` over `items` with at most `n` in flight. */
async function pool(items, n, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    })
  );
  return results;
}

export const tools = [
  {
    name: 'impact_of_file',
    title: 'Who depends on this file? (reverse impact)',
    description:
      'REVERSE analysis: given a file you are about to change, list every file and every route/entry point ' +
      '(HTTP controller, handler, cron…) that depends on it, plus the test files that already cover it. ' +
      'Use it BEFORE editing or deleting a file, or to answer "what breaks if I touch X?". ' +
      'Resolves real imports (tsconfig aliases, PSR-4, Go modules), not text matches. ' +
      'Answers: `routes` (re-test these, each with the import chain explaining why), `directDependents`, ' +
      '`otherDependents` (transitive blast radius), `coveringTests` (what to re-run). ' +
      'Go is package-granular: every file of a package shares the same dependents, and an empty answer is never proof a Go file is unused. ' +
      'Example: {"file":"src/shared/domain/project.model.ts"}.',
    inputSchema: {
      file: z.string().describe('File to change, relative to root. File only, never `file:symbol`.'),
      root: rootArg,
      context: contextArg,
      routes: z
        .array(z.string())
        .optional()
        .describe('Custom route globs. REPLACES the built-in list (controllers, handlers, page.tsx, views.py…).'),
      tests: z
        .array(z.string())
        .optional()
        .describe('Custom test-file globs. REPLACES the built-in list (*.test.*, *.spec.*, *_test.go…).'),
    },
    async handler({ file, root, context, routes, tests }) {
      const target = resolveTarget({ root, file });
      const extra = [
        ...(routes?.length ? ['--routes', ...routes] : []),
        ...(tests?.length ? ['--tests', ...tests] : []),
      ];
      const { impact, notes } = await impactJson(target.root, target.file, context, extra);
      return { ...shapeImpact(impact), ...(notes.length ? { notes } : {}) };
    },
  },
  {
    name: 'impact_of_symbol',
    title: 'Who uses this symbol? (file impact narrowed by mention)',
    description:
      'Find everything that "comes up" from a symbol (function, class, method, constant) defined in a file: ' +
      'runs the reverse impact of the defining file, then splits its dependents into those whose source ' +
      'mentions the symbol (`mentioning`: start reading here) and those that import the file but never name it. ' +
      'The mention test is a word-boundary text match: it is a HEURISTIC that narrows a file-level answer, ' +
      'not a semantic reference search. Routes and chains stay file-level. ' +
      'For an exact one-level answer on one symbol prefer the native LSP `findReferences` when available; ' +
      'use this tool for the transitive picture (routes, covering tests). ' +
      'Example: {"file":"src/auth/auth.service.ts","symbol":"AuthService.register"}.',
    inputSchema: {
      file: z.string().describe('File that DEFINES the symbol, relative to root.'),
      symbol: z
        .string()
        .describe('Symbol name. `Class.method` is accepted: the last segment (`method`) is searched.'),
      root: rootArg,
      context: contextArg,
    },
    async handler({ file, symbol, root, context }) {
      const target = resolveTarget({ root, file });
      const { impact, notes } = await impactJson(target.root, target.file, context);
      const base = shapeImpact(impact);
      const ctx = path.resolve(target.root, context ?? '.');
      const read = (f) => fs.readFileSync(path.join(ctx, f), 'utf8');
      const { needle, mentioning, others } = splitByMention(impact.dependents, symbol, read);
      const direct = new Set(impact.directDependents);
      return {
        target: base.target,
        symbol,
        searchedFor: needle,
        summary:
          `${mentioning.length} of ${impact.dependents.length} dependent(s) mention \`${needle}\`; ` +
          `${base.routes.length} route(s) impacted at file level`,
        mentioning: mentioning.map((f) => ({ file: f, direct: direct.has(f) })),
        importButNeverMention: cap(others, 40),
        routes: base.routes,
        coveringTests: base.coveringTests,
        granularity: base.granularity,
        caveat:
          'Mention = textual word match in the dependent file (comments and homonyms count). ' +
          'Routes/coveringTests are file-level: they hold for the whole defining file, not for this symbol alone.',
        ...(base.warning ? { warning: base.warning } : {}),
        ...(notes.length ? { notes } : {}),
      };
    },
  },
  {
    name: 'review_changed_files',
    title: 'Review: routes to re-test and tests to run for a diff',
    description:
      'One-shot REVIEW helper. Takes the files changed on the current branch (git diff `<base>...HEAD`, ' +
      'default origin/main, falling back to origin/master then the uncommitted working tree), runs the reverse ' +
      'impact of each and aggregates: `routesToRetest` (with the changed file that triggers each), `testsToRun`, ' +
      'and a per-file blast-radius table. Use when asked to review a PR/branch or before pushing. ' +
      'Only .ts/.tsx/.js/.jsx/.py/.pyi/.php/.go files are analysed; others are listed under `skipped`. ' +
      'Example: {"base":"origin/develop"}.',
    inputSchema: {
      base: z.string().optional().describe('Git ref to diff against (default: origin/main, then origin/master, then HEAD).'),
      root: rootArg,
      context: contextArg,
      maxFiles: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Max changed files to analyse (default 25): each one scans the whole context.'),
    },
    async handler({ base, root, context, maxFiles = 25 }) {
      const abs = path.resolve(root ?? process.cwd());
      const { range, files } = await changedFiles(abs, base);
      const analysable = files.filter((f) => IMPACT_EXT.test(f) && fs.existsSync(path.join(abs, f)));
      const skipped = files.filter((f) => !analysable.includes(f));
      const picked = analysable.slice(0, maxFiles);
      const errors = [];
      const perFile = (
        await pool(picked, 4, async (file) => {
          try {
            const { impact } = await impactJson(abs, file, context);
            return { file, impact };
          } catch (err) {
            errors.push({ file, error: String(err.message ?? err) });
            return null;
          }
        })
      ).filter(Boolean);
      return {
        range,
        summary: `${files.length} changed file(s), ${picked.length} analysed, ${skipped.length} skipped`,
        ...aggregateReview(perFile),
        notAnalysedForLimit: analysable.length - picked.length,
        skipped: cap(skipped, 40).items,
        ...(errors.length ? { errors } : {}),
        reminder:
          'Empty `routesToRetest` with non-zero dependents means an internal change, or route patterns that do not match this project (use impact_of_file with `routes`).',
      };
    },
  },
  {
    name: 'trace_calls',
    title: 'What does this function call? (forward call tree)',
    description:
      'FORWARD analysis: the call tree below a function or method, resolved through the language server ' +
      '(TypeScript, Python/Pyright, PHP/Intelephense, Go/gopls), as an indented tree with `path:line` for every ' +
      'callee. Use it to understand a flow end to end ("what happens when register() is called?") and to narrate ' +
      'it: each tree line is a definition you can cite. Depth-first, in SOURCE order (a call inside an `if` is shown ' +
      'where written, not where it runs). Without a symbol it traces the file\'s imports instead (see explore_dependencies). ' +
      'If a language server is missing the tree degrades silently to fewer resolved calls: run `doctor`. ' +
      'Example: {"file":"src/modules/auth/auth.controller.ts","symbol":"AuthController.register","depth":3}.',
    inputSchema: {
      file: z.string().describe('File containing the function, relative to root.'),
      symbol: z.string().describe('Function name, or `Class.method`.'),
      depth: z.number().int().min(1).max(10).optional().describe('Call depth (default 3, max 10).'),
      sameFileOnly: z.boolean().optional().describe('Stay inside the file (skip callees in other files).'),
      root: rootArg,
      context: contextArg,
    },
    async handler({ file, symbol, depth = 3, sameFileOnly, root, context }) {
      const target = resolveTarget({ root, file });
      const args = [
        'explore',
        `${target.file}:${symbol}`,
        '-c',
        context ?? '.',
        '-d',
        String(depth),
        ...(sameFileOnly ? ['--same-file-only'] : []),
        ...(includeGlobsFor(target.file).length ? ['-i', ...includeGlobsFor(target.file)] : []),
      ];
      const { data, stderr } = await runJson(args, { cwd: target.root });
      const tree = renderCallTree(data, target.root);
      return {
        symbol,
        entry: tree.entry,
        callsFound: tree.callCount,
        tree: tree.tree,
        ...(tree.truncated ? { truncated: 'tree cut at 150 lines: lower depth or trace a sub-call' } : {}),
        hint: 'Continue the story by calling trace_calls again on any callee shown in another layer.',
        ...(stderr ? { notes: [stderr] } : {}),
      };
    },
  },
  {
    name: 'explore_dependencies',
    title: 'What does this file import? (forward dependency graph + cycles)',
    description:
      'FORWARD dependency graph of a file: internal files it pulls in (transitively by default), third-party ' +
      'modules, unresolved imports, and circular dependencies. Use before a refactoring (move/extract/rename) ' +
      'or to check for cycles from an entry point: a non-empty `cycles` is the answer. ' +
      'Python and PHP entries are handled (their globs are added automatically). ' +
      'Example: {"file":"src/index.ts","transitive":true}.',
    inputSchema: {
      file: z.string().describe('Entry file, relative to root.'),
      transitive: z.boolean().optional().describe('Follow imports recursively (default true). false = direct imports only.'),
      root: rootArg,
      context: contextArg,
    },
    async handler({ file, transitive = true, root, context }) {
      const target = resolveTarget({ root, file });
      const args = [
        'explore',
        target.file,
        '-c',
        context ?? '.',
        ...(transitive ? [] : ['--no-transitive']),
        ...(includeGlobsFor(target.file).length ? ['-i', ...includeGlobsFor(target.file)] : []),
      ];
      const { data, stderr } = await runJson(args, { cwd: target.root });
      return { ...shapeDependencies(data, target.root), ...(stderr ? { notes: [stderr] } : {}) };
    },
  },
  {
    name: 'doctor',
    title: 'Check the environment (Node, CLI, language servers)',
    description:
      'Diagnose the environment: which launcher this server uses, and whether Node and the language servers ' +
      '(intelephense for PHP, pyright for Python, gopls for Go) are available. Call it when trace_calls returns ' +
      'fewer resolved calls than expected, or before a precision-sensitive PHP/Python/Go analysis. ' +
      'A missing language server only degrades `trace_calls`/`explore_dependencies`; `impact_*` never needs one. ' +
      'For Go also check that `go` is on PATH, otherwise gopls resolves almost nothing. Takes no arguments.',
    inputSchema: {},
    async handler() {
      const launcher = resolveLauncher();
      const { code, stdout, stderr } = await runCli(['doctor', '--json'], { launcher });
      let report;
      try {
        report = JSON.parse(stdout);
      } catch {
        report = { raw: stdout.trim() };
      }
      return {
        launcher: `${launcher.source}: ${[launcher.command, ...launcher.args].join(' ')}`,
        exitCode: code,
        report,
        ...(stderr ? { notes: [stderr] } : {}),
        reminder: 'Read the rows, not the exit code: doctor exits 0 even when an LSP is missing.',
      };
    },
  },
];
