/**
 * Copies non-TypeScript template assets (e.g. SKILL Markdown files) from `src/`
 * to `dist/`, preserving their relative structure. `tsc` only emits `.js`/`.d.ts`,
 * so these assets would otherwise be missing at runtime and from the npm package.
 */

import { cpSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');

const ASSET_EXTENSIONS = ['.md'];

/** Recursively yields absolute paths of asset files under a directory. */
function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      yield* walk(full);
    } else if (ASSET_EXTENSIONS.some((ext) => full.endsWith(ext))) {
      yield full;
    }
  }
}

let count = 0;
for (const srcFile of walk(SRC)) {
  const dest = join(DIST, relative(SRC, srcFile));
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(srcFile, dest);
  count += 1;
}

console.log(`Copied ${count} template asset(s) to dist/`);
