/**
 * Tests unitaires pour GoModResolver (T006).
 *
 * Construit un module Go minimal en memoire sur le disque temporaire,
 * verifie la resolution de go.mod, la logique "nearest wins" pour les monorepos,
 * la resolution d'import interne, la classification stdlib et la selection
 * du fichier representatif non-test.
 */

import { describe, it, expect, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { GoModResolver } from './go-mod.js';
import type { GoModuleInfo } from './go-mod.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Cree un fichier et tous ses repertoires parents.
 */
function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

// ---------------------------------------------------------------------------
// Fixture principale
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

// Fixture sub-module (nearest-wins):
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

  it('trouve le module pour un fichier dans cmd/service/', () => {
    const mainGo = path.join(tmpRoot, 'cmd', 'service', 'main.go');
    const info = resolver.findModule(mainGo);

    expect(info).not.toBeNull();
    const mod = info as GoModuleInfo;
    expect(mod.modulePath).toBe('github.com/example/app');
    expect(mod.moduleRoot).toBe(tmpRoot);
    expect(mod.goVersion).toBe('1.25');
    expect(mod.filePath).toBe(path.join(tmpRoot, 'go.mod'));
  });

  it('retourne null pour un fichier hors de tout module Go', () => {
    const outsideFile = path.join(os.tmpdir(), 'orphan.go');
    // S'assurer que le fichier n'est pas dans tmpRoot
    const resolver2 = new GoModResolver();
    // On cherche depuis un chemin qui ne contient pas de go.mod
    // On utilise un repertoire de l'OS qui n'a pas de go.mod
    const info = resolver2.findModule('/nonexistent/path/to/file.go');
    expect(info).toBeNull();
    // Nettoyage
    if (fs.existsSync(outsideFile)) fs.rmSync(outsideFile);
  });

  it('nearest-wins: un fichier sous sub/ utilise le module sub, pas le module racine', () => {
    const resolver2 = new GoModResolver();
    const handlerGo = path.join(tmpRoot, 'sub', 'pkg', 'handler.go');
    const info = resolver2.findModule(handlerGo);

    expect(info).not.toBeNull();
    const mod = info as GoModuleInfo;
    expect(mod.modulePath).toBe('github.com/example/sub');
    expect(mod.moduleRoot).toBe(path.join(tmpRoot, 'sub'));
    expect(mod.goVersion).toBe('1.24');
  });

  it('un fichier directement dans tmpRoot utilise le module racine', () => {
    const goModPath = path.join(tmpRoot, 'go.mod');
    const info = resolver.findModule(goModPath);

    expect(info).not.toBeNull();
    const mod = info as GoModuleInfo;
    expect(mod.modulePath).toBe('github.com/example/app');
    expect(mod.moduleRoot).toBe(tmpRoot);
  });

  it('met les resultats en cache (appels successifs sur le meme fichier)', () => {
    const resolver2 = new GoModResolver();
    const mainGo = path.join(tmpRoot, 'cmd', 'service', 'main.go');
    const info1 = resolver2.findModule(mainGo);
    const info2 = resolver2.findModule(mainGo);
    expect(info1).toBe(info2); // Meme reference d'objet grace au cache
  });
});

describe('GoModResolver.resolveImport', () => {
  const resolver = new GoModResolver();
  const mainGo = path.join(tmpRoot, 'cmd', 'service', 'main.go');

  it('resout un import interne vers le fichier .go non-test representatif', () => {
    const resolved = resolver.resolveImport(
      'github.com/example/app/internal/domain/invoice',
      mainGo,
    );

    expect(resolved).not.toBeNull();
    // Doit pointer vers entity.go (non-test), pas entity_test.go
    expect(resolved).toBe(
      path.join(tmpRoot, 'internal', 'domain', 'invoice', 'entity.go'),
    );
  });

  it('retourne null pour un import stdlib (context)', () => {
    const resolved = resolver.resolveImport('context', mainGo);
    expect(resolved).toBeNull();
  });

  it('retourne null pour un import tiers (github.com/google/uuid)', () => {
    const resolved = resolver.resolveImport('github.com/google/uuid', mainGo);
    expect(resolved).toBeNull();
  });

  it('retourne null si le package interne n\'existe pas sur le disque', () => {
    const resolved = resolver.resolveImport(
      'github.com/example/app/internal/nonexistent',
      mainGo,
    );
    expect(resolved).toBeNull();
  });

  it('retourne null pour un import egal au module path (pas de sous-package)', () => {
    // Le repertoire racine du module contient un go.mod mais pas forcement de .go
    // Ici tmpRoot ne contient que go.mod, pas de .go a la racine
    const resolved = resolver.resolveImport('github.com/example/app', mainGo);
    expect(resolved).toBeNull();
  });

  it('met les resultats en cache (appels successifs identiques)', () => {
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

describe('GoModResolver - preference fichier non-test', () => {
  let tmpPkg: string;

  afterAll(() => {
    if (tmpPkg && fs.existsSync(tmpPkg)) {
      fs.rmSync(tmpPkg, { recursive: true, force: true });
    }
  });

  it('prefere le fichier non-test quand les deux existent', () => {
    // La fixture principale possede deja entity.go et entity_test.go
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

  it('utilise le fichier _test.go en fallback si c\'est le seul fichier .go', () => {
    // Creer un module temporaire avec uniquement un fichier test
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

describe('GoModResolver.isStandardLibrary', () => {
  const resolver = new GoModResolver();

  it('classifie `encoding/json` comme stdlib', () => {
    expect(resolver.isStandardLibrary('encoding/json')).toBe(true);
  });

  it('classifie `context` comme stdlib', () => {
    expect(resolver.isStandardLibrary('context')).toBe(true);
  });

  it('classifie `net/http` comme stdlib', () => {
    expect(resolver.isStandardLibrary('net/http')).toBe(true);
  });

  it('classifie `time` comme stdlib', () => {
    expect(resolver.isStandardLibrary('time')).toBe(true);
  });

  it('classifie `fmt` comme stdlib', () => {
    expect(resolver.isStandardLibrary('fmt')).toBe(true);
  });

  it('classifie `github.com/google/uuid` comme non-stdlib', () => {
    expect(resolver.isStandardLibrary('github.com/google/uuid')).toBe(false);
  });

  it('classifie `golang.org/x/net` comme non-stdlib', () => {
    expect(resolver.isStandardLibrary('golang.org/x/net')).toBe(false);
  });

  it('classifie `go.uber.org/zap` comme non-stdlib', () => {
    expect(resolver.isStandardLibrary('go.uber.org/zap')).toBe(false);
  });

  it('classifie `github.com/example/app/internal/domain` comme non-stdlib', () => {
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

  it('parse un module path entre guillemets (forme rare mais valide)', () => {
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

  it('goVersion est null si la ligne go est absente', () => {
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

  it('ignore les commentaires dans go.mod', () => {
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
