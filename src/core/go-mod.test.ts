/**
 * Unit tests for GoModResolver (T006).
 *
 * Builds a minimal Go module in memory on the temp disk, checks go.mod
 * resolution, the "nearest wins" logic for monorepos, internal import
 * resolution, stdlib classification, and the selection of the
 * representative non-test file.
 */

import { describe, it, expect, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';
import { GoModResolver } from './go-mod.js';
import type { GoModuleInfo } from './go-mod.js';
import { ImpactAnalyzer } from './impact.js';
import type { ContextInfo } from '../types/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const goFixtures = path.join(repoRoot, 'fixtures/go');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a file and all its parent directories.
 */
function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

// ---------------------------------------------------------------------------
// Main fixture
// ---------------------------------------------------------------------------

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'go-mod-test-'));

// Structure:
//   <tmpRoot>/go.mod
//   <tmpRoot>/internal/domain/invoice/entity.go
//   <tmpRoot>/internal/domain/invoice/entity_test.go
//   <tmpRoot>/cmd/service/main.go

writeFile(
  path.join(tmpRoot, 'go.mod'),
  'module github.com/example/app\n\ngo 1.25\n',
);

writeFile(
  path.join(tmpRoot, 'internal', 'domain', 'invoice', 'entity.go'),
  'package invoice\n\ntype Invoice struct{}\n',
);

writeFile(
  path.join(tmpRoot, 'internal', 'domain', 'invoice', 'entity_test.go'),
  'package invoice_test\n',
);

writeFile(
  path.join(tmpRoot, 'cmd', 'service', 'main.go'),
  'package main\n\nimport "github.com/example/app/internal/domain/invoice"\n\nfunc main() {}\n',
);

// Sub-module fixture (nearest-wins):
//   <tmpRoot>/sub/go.mod  (module github.com/example/sub)
//   <tmpRoot>/sub/pkg/handler.go

writeFile(
  path.join(tmpRoot, 'sub', 'go.mod'),
  'module github.com/example/sub\n\ngo 1.24\n',
);

writeFile(
  path.join(tmpRoot, 'sub', 'pkg', 'handler.go'),
  'package pkg\n\nfunc Handle() {}\n',
);

afterAll(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GoModResolver.findModule', () => {
  const resolver = new GoModResolver();

  it('finds the module for a file in cmd/service/', () => {
    const mainGo = path.join(tmpRoot, 'cmd', 'service', 'main.go');
    const info = resolver.findModule(mainGo);

    expect(info).not.toBeNull();
    const mod = info as GoModuleInfo;
    expect(mod.modulePath).toBe('github.com/example/app');
    expect(mod.moduleRoot).toBe(tmpRoot);
    expect(mod.goVersion).toBe('1.25');
    expect(mod.filePath).toBe(path.join(tmpRoot, 'go.mod'));
  });

  it('returns null for a file outside any Go module', () => {
    const outsideFile = path.join(os.tmpdir(), 'orphan.go');
    // Make sure the file is not inside tmpRoot
    const resolver2 = new GoModResolver();
    // Look up from a path that contains no go.mod
    // Use an OS directory that has no go.mod
    const info = resolver2.findModule('/nonexistent/path/to/file.go');
    expect(info).toBeNull();
    // Cleanup
    if (fs.existsSync(outsideFile)) fs.rmSync(outsideFile);
  });

  it('nearest-wins: a file under sub/ uses the sub module, not the root module', () => {
    const resolver2 = new GoModResolver();
    const handlerGo = path.join(tmpRoot, 'sub', 'pkg', 'handler.go');
    const info = resolver2.findModule(handlerGo);

    expect(info).not.toBeNull();
    const mod = info as GoModuleInfo;
    expect(mod.modulePath).toBe('github.com/example/sub');
    expect(mod.moduleRoot).toBe(path.join(tmpRoot, 'sub'));
    expect(mod.goVersion).toBe('1.24');
  });

  it('a file directly in tmpRoot uses the root module', () => {
    const goModPath = path.join(tmpRoot, 'go.mod');
    const info = resolver.findModule(goModPath);

    expect(info).not.toBeNull();
    const mod = info as GoModuleInfo;
    expect(mod.modulePath).toBe('github.com/example/app');
    expect(mod.moduleRoot).toBe(tmpRoot);
  });

  it('caches results (successive calls on the same file)', () => {
    const resolver2 = new GoModResolver();
    const mainGo = path.join(tmpRoot, 'cmd', 'service', 'main.go');
    const info1 = resolver2.findModule(mainGo);
    const info2 = resolver2.findModule(mainGo);
    expect(info1).toBe(info2); // Same object reference thanks to the cache
  });
});

describe('GoModResolver.resolveImport', () => {
  const resolver = new GoModResolver();
  const mainGo = path.join(tmpRoot, 'cmd', 'service', 'main.go');

  it('resolves an internal import to the representative non-test .go file', () => {
    const resolved = resolver.resolveImport(
      'github.com/example/app/internal/domain/invoice',
      mainGo,
    );

    expect(resolved).not.toBeNull();
    // Must point to entity.go (non-test), not entity_test.go
    expect(resolved).toBe(
      path.join(tmpRoot, 'internal', 'domain', 'invoice', 'entity.go'),
    );
  });

  it('returns null for a stdlib import (context)', () => {
    const resolved = resolver.resolveImport('context', mainGo);
    expect(resolved).toBeNull();
  });

  it('returns null for a third-party import (github.com/google/uuid)', () => {
    const resolved = resolver.resolveImport('github.com/google/uuid', mainGo);
    expect(resolved).toBeNull();
  });

  it('returns null if the internal package does not exist on disk', () => {
    const resolved = resolver.resolveImport(
      'github.com/example/app/internal/nonexistent',
      mainGo,
    );
    expect(resolved).toBeNull();
  });

  it('returns null for an import equal to the module path (no sub-package)', () => {
    // The module root directory contains a go.mod but not necessarily any .go file
    // Here tmpRoot only contains go.mod, no .go at the root
    const resolved = resolver.resolveImport('github.com/example/app', mainGo);
    expect(resolved).toBeNull();
  });

  it('caches results (identical successive calls)', () => {
    const resolver2 = new GoModResolver();
    const r1 = resolver2.resolveImport(
      'github.com/example/app/internal/domain/invoice',
      mainGo,
    );
    const r2 = resolver2.resolveImport(
      'github.com/example/app/internal/domain/invoice',
      mainGo,
    );
    expect(r1).toBe(r2);
  });
});

describe('GoModResolver - non-test file preference', () => {
  let tmpPkg: string;

  afterAll(() => {
    if (tmpPkg && fs.existsSync(tmpPkg)) {
      fs.rmSync(tmpPkg, { recursive: true, force: true });
    }
  });

  it('prefers the non-test file when both exist', () => {
    // The main fixture already has entity.go and entity_test.go
    const resolver = new GoModResolver();
    const mainGo = path.join(tmpRoot, 'cmd', 'service', 'main.go');
    const resolved = resolver.resolveImport(
      'github.com/example/app/internal/domain/invoice',
      mainGo,
    );
    expect(resolved).toBe(
      path.join(tmpRoot, 'internal', 'domain', 'invoice', 'entity.go'),
    );
  });

  it('falls back to the _test.go file if it is the only .go file', () => {
    // Create a temporary module with only a test file
    tmpPkg = fs.mkdtempSync(path.join(os.tmpdir(), 'go-mod-testonly-'));
    writeFile(path.join(tmpPkg, 'go.mod'), 'module github.com/test/only\n\ngo 1.21\n');
    writeFile(path.join(tmpPkg, 'mypkg', 'only_test.go'), 'package mypkg_test\n');
    writeFile(path.join(tmpPkg, 'caller', 'main.go'), 'package main\n');

    const resolver = new GoModResolver();
    const callerGo = path.join(tmpPkg, 'caller', 'main.go');
    const resolved = resolver.resolveImport('github.com/test/only/mypkg', callerGo);
    expect(resolved).toBe(path.join(tmpPkg, 'mypkg', 'only_test.go'));
  });
});

// ---------------------------------------------------------------------------
// T002 — GoModResolver.resolvePackageFiles (FR-001, FR-003, FR-009)
// ---------------------------------------------------------------------------

describe('GoModResolver.resolvePackageFiles', () => {
  it('returns every non-test .go file of a package, sorted', () => {
    const tmpMulti = fs.mkdtempSync(path.join(os.tmpdir(), 'go-mod-multifile-'));
    try {
      writeFile(
        path.join(tmpMulti, 'go.mod'),
        'module github.com/example/multi\n\ngo 1.25\n',
      );
      writeFile(
        path.join(tmpMulti, 'internal', 'notify', 'zeta.go'),
        'package notify\n',
      );
      writeFile(
        path.join(tmpMulti, 'internal', 'notify', 'alpha.go'),
        'package notify\n',
      );
      writeFile(
        path.join(tmpMulti, 'internal', 'notify', 'alpha_test.go'),
        'package notify_test\n',
      );
      writeFile(path.join(tmpMulti, 'caller', 'main.go'), 'package main\n');

      const resolver = new GoModResolver();
      const callerGo = path.join(tmpMulti, 'caller', 'main.go');
      const files = resolver.resolvePackageFiles(
        'github.com/example/multi/internal/notify',
        callerGo,
      );

      expect(files).toEqual([
        path.join(tmpMulti, 'internal', 'notify', 'alpha.go'),
        path.join(tmpMulti, 'internal', 'notify', 'zeta.go'),
      ]);
    } finally {
      fs.rmSync(tmpMulti, { recursive: true, force: true });
    }
  });

  it('falls back to every .go file (tests included) when the package holds no non-test file', () => {
    const tmpTestOnly = fs.mkdtempSync(path.join(os.tmpdir(), 'go-mod-testonly-all-'));
    try {
      writeFile(
        path.join(tmpTestOnly, 'go.mod'),
        'module github.com/example/testonly\n\ngo 1.25\n',
      );
      writeFile(
        path.join(tmpTestOnly, 'pkg', 'zeta_test.go'),
        'package pkg_test\n',
      );
      writeFile(
        path.join(tmpTestOnly, 'pkg', 'alpha_test.go'),
        'package pkg_test\n',
      );
      writeFile(path.join(tmpTestOnly, 'caller', 'main.go'), 'package main\n');

      const resolver = new GoModResolver();
      const callerGo = path.join(tmpTestOnly, 'caller', 'main.go');
      const files = resolver.resolvePackageFiles(
        'github.com/example/testonly/pkg',
        callerGo,
      );

      expect(files).toEqual([
        path.join(tmpTestOnly, 'pkg', 'alpha_test.go'),
        path.join(tmpTestOnly, 'pkg', 'zeta_test.go'),
      ]);
    } finally {
      fs.rmSync(tmpTestOnly, { recursive: true, force: true });
    }
  });

  it('excludes vendor/ and .gomodcache/ candidates', () => {
    const tmpVendor = fs.mkdtempSync(path.join(os.tmpdir(), 'go-mod-vendor-'));
    try {
      writeFile(
        path.join(tmpVendor, 'go.mod'),
        'module github.com/example/vendored\n\ngo 1.25\n',
      );
      // A package whose directory itself lives under vendor/ or .gomodcache/
      // must never surface as a candidate, even though its .go files are real.
      writeFile(
        path.join(tmpVendor, 'vendor', 'github.com', 'external', 'lib', 'lib.go'),
        'package lib\n',
      );
      writeFile(
        path.join(
          tmpVendor,
          '.gomodcache',
          'github.com',
          'external',
          'other',
          'other.go',
        ),
        'package other\n',
      );
      writeFile(path.join(tmpVendor, 'caller', 'main.go'), 'package main\n');

      const resolver = new GoModResolver();
      const callerGo = path.join(tmpVendor, 'caller', 'main.go');

      const vendored = resolver.resolvePackageFiles(
        'github.com/example/vendored/vendor/github.com/external/lib',
        callerGo,
      );
      const cached = resolver.resolvePackageFiles(
        'github.com/example/vendored/.gomodcache/github.com/external/other',
        callerGo,
      );

      expect(vendored).toEqual([]);
      expect(cached).toEqual([]);
    } finally {
      fs.rmSync(tmpVendor, { recursive: true, force: true });
    }
  });

  it('is invariant to a rename that flips the alphabetical winner', () => {
    const tmpRename = fs.mkdtempSync(path.join(os.tmpdir(), 'go-mod-rename-'));
    try {
      writeFile(
        path.join(tmpRename, 'go.mod'),
        'module github.com/example/renamed\n\ngo 1.25\n',
      );
      writeFile(
        path.join(tmpRename, 'internal', 'pkg', 'referenced.go'),
        'package pkg\n\nfunc Real() {}\n',
      );
      writeFile(
        path.join(tmpRename, 'internal', 'pkg', 'zzz-sibling.go'),
        'package pkg\n\n// sibling marker\n',
      );
      writeFile(path.join(tmpRename, 'caller', 'main.go'), 'package main\n');

      const readContents = (files: string[]): Set<string> =>
        new Set(files.map((f) => fs.readFileSync(f, 'utf-8')));

      const resolver = new GoModResolver();
      const callerGo = path.join(tmpRename, 'caller', 'main.go');
      const before = resolver.resolvePackageFiles(
        'github.com/example/renamed/internal/pkg',
        callerGo,
      );
      const contentsBefore = readContents(before);

      // Renaming the sibling so it now sorts before "referenced.go" flips
      // which file the old single-winner logic would have picked.
      fs.renameSync(
        path.join(tmpRename, 'internal', 'pkg', 'zzz-sibling.go'),
        path.join(tmpRename, 'internal', 'pkg', 'aaa-sibling.go'),
      );

      const resolver2 = new GoModResolver();
      const after = resolver2.resolvePackageFiles(
        'github.com/example/renamed/internal/pkg',
        callerGo,
      );
      const contentsAfter = readContents(after);

      expect(after.length).toBe(before.length);
      expect(contentsAfter).toEqual(contentsBefore);
    } finally {
      fs.rmSync(tmpRename, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// FR-003 / SC-002 — ImpactAnalyzer must walk every package file, not just the
// lexicographically-first one. This is a regression guard for a revert of
// ImpactAnalyzer.resolveInternalImports to the old PathResolver.resolve()
// (single-file) call: under that revert, only the package's alphabetically
// first non-test file (aaa_marker.go) would carry the reverse edge from
// cmd/notifier/main.go, leaving sender.go's dependent set empty.
// ---------------------------------------------------------------------------

describe('ImpactAnalyzer over fixtures/go (FR-003, SC-002)', () => {
  it('sender.go and aaa_marker.go report the same non-empty dependent set', () => {
    const context: ContextInfo = {
      rootPath: goFixtures,
      projectRoot: goFixtures,
      includePatterns: ['**/*.go'],
      excludePatterns: [],
    };
    const analyzer = new ImpactAnalyzer(context);
    const options = { routePatterns: ['**/main.go'] };

    const senderResult = analyzer.analyze(
      path.join(goFixtures, 'internal/notify/sender.go'),
      options,
    );
    const markerResult = analyzer.analyze(
      path.join(goFixtures, 'internal/notify/aaa_marker.go'),
      options,
    );

    expect(senderResult.dependents.length).toBeGreaterThan(0);
    expect(senderResult.dependents).toEqual(markerResult.dependents);
  });
});

describe('GoModResolver.isStandardLibrary', () => {
  const resolver = new GoModResolver();

  it('classifies `encoding/json` as stdlib', () => {
    expect(resolver.isStandardLibrary('encoding/json')).toBe(true);
  });

  it('classifies `context` as stdlib', () => {
    expect(resolver.isStandardLibrary('context')).toBe(true);
  });

  it('classifies `net/http` as stdlib', () => {
    expect(resolver.isStandardLibrary('net/http')).toBe(true);
  });

  it('classifies `time` as stdlib', () => {
    expect(resolver.isStandardLibrary('time')).toBe(true);
  });

  it('classifies `fmt` as stdlib', () => {
    expect(resolver.isStandardLibrary('fmt')).toBe(true);
  });

  it('classifies `github.com/google/uuid` as non-stdlib', () => {
    expect(resolver.isStandardLibrary('github.com/google/uuid')).toBe(false);
  });

  it('classifies `golang.org/x/net` as non-stdlib', () => {
    expect(resolver.isStandardLibrary('golang.org/x/net')).toBe(false);
  });

  it('classifies `go.uber.org/zap` as non-stdlib', () => {
    expect(resolver.isStandardLibrary('go.uber.org/zap')).toBe(false);
  });

  it('classifies `github.com/example/app/internal/domain` as non-stdlib', () => {
    expect(
      resolver.isStandardLibrary('github.com/example/app/internal/domain'),
    ).toBe(false);
  });
});

describe('GoModResolver - parsing go.mod', () => {
  let tmpMod: string;

  afterAll(() => {
    if (tmpMod && fs.existsSync(tmpMod)) {
      fs.rmSync(tmpMod, { recursive: true, force: true });
    }
  });

  it('parses a quoted module path (rare but valid form)', () => {
    tmpMod = fs.mkdtempSync(path.join(os.tmpdir(), 'go-mod-quoted-'));
    writeFile(
      path.join(tmpMod, 'go.mod'),
      'module "github.com/example/quoted"\n\ngo 1.22\n',
    );
    writeFile(path.join(tmpMod, 'main.go'), 'package main\n');

    const resolver = new GoModResolver();
    const info = resolver.findModule(path.join(tmpMod, 'main.go'));
    expect(info).not.toBeNull();
    expect(info?.modulePath).toBe('github.com/example/quoted');
    expect(info?.goVersion).toBe('1.22');
  });

  it('goVersion is null when the go line is absent', () => {
    tmpMod = fs.mkdtempSync(path.join(os.tmpdir(), 'go-mod-nover-'));
    writeFile(
      path.join(tmpMod, 'go.mod'),
      'module github.com/example/nover\n',
    );
    writeFile(path.join(tmpMod, 'main.go'), 'package main\n');

    const resolver = new GoModResolver();
    const info = resolver.findModule(path.join(tmpMod, 'main.go'));
    expect(info).not.toBeNull();
    expect(info?.modulePath).toBe('github.com/example/nover');
    expect(info?.goVersion).toBeNull();
  });

  it('ignores comments in go.mod', () => {
    tmpMod = fs.mkdtempSync(path.join(os.tmpdir(), 'go-mod-comment-'));
    writeFile(
      path.join(tmpMod, 'go.mod'),
      '// This is a comment\nmodule github.com/example/commented // inline comment\n\ngo 1.23 // another comment\n',
    );
    writeFile(path.join(tmpMod, 'main.go'), 'package main\n');

    const resolver = new GoModResolver();
    const info = resolver.findModule(path.join(tmpMod, 'main.go'));
    expect(info).not.toBeNull();
    expect(info?.modulePath).toBe('github.com/example/commented');
    expect(info?.goVersion).toBe('1.23');
  });
});
