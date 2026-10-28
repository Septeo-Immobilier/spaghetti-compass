import { describe, it, expect } from 'vitest';
import { resolveSpawnCommand } from './spawn-command.js';

const files = (...present: string[]) => {
  const set = new Set(present);
  return (p: string) => set.has(p);
};

describe('resolveSpawnCommand', () => {
  it('returns the command unchanged on non-win32 platforms', () => {
    const result = resolveSpawnCommand('npx', ['pyright-langserver', '--stdio'], {
      platform: 'linux',
      env: {},
      exists: () => {
        throw new Error('must not touch the filesystem');
      },
    });
    expect(result).toEqual({
      command: 'npx',
      args: ['pyright-langserver', '--stdio'],
      shell: false,
    });
  });

  it('resolves a .exe to its full path without a shell', () => {
    const result = resolveSpawnCommand('gopls', ['serve'], {
      platform: 'win32',
      env: { PATH: 'C:\\a;C:\\bin', PATHEXT: '.COM;.EXE;.CMD' },
      exists: files('C:\\bin\\gopls.EXE'),
    });
    expect(result).toEqual({ command: 'C:\\bin\\gopls.EXE', args: ['serve'], shell: false });
  });

  it('resolves a .cmd shim to a quoted command line run through the shell', () => {
    const result = resolveSpawnCommand('pyright-langserver', ['--stdio'], {
      platform: 'win32',
      env: { PATH: 'C:\\Users\\me\\AppData\\Roaming\\npm', PATHEXT: '.EXE;.CMD' },
      exists: files('C:\\Users\\me\\AppData\\Roaming\\npm\\pyright-langserver.CMD'),
    });
    expect(result).toEqual({
      command: '"C:\\Users\\me\\AppData\\Roaming\\npm\\pyright-langserver.CMD" "--stdio"',
      args: [],
      shell: true,
    });
  });

  it('respects PATHEXT order', () => {
    const exists = files('C:\\bin\\tool.CMD', 'C:\\bin\\tool.EXE');
    const exeFirst = resolveSpawnCommand('tool', [], {
      platform: 'win32',
      env: { PATH: 'C:\\bin', PATHEXT: '.EXE;.CMD' },
      exists,
    });
    expect(exeFirst.shell).toBe(false);
    expect(exeFirst.command).toBe('C:\\bin\\tool.EXE');

    const cmdFirst = resolveSpawnCommand('tool', [], {
      platform: 'win32',
      env: { PATH: 'C:\\bin', PATHEXT: '.CMD;.EXE' },
      exists,
    });
    expect(cmdFirst.shell).toBe(true);
  });

  it('defaults PATHEXT when absent', () => {
    const result = resolveSpawnCommand('npx', [], {
      platform: 'win32',
      env: { PATH: 'C:\\node' },
      exists: files('C:\\node\\npx.CMD'),
    });
    expect(result.shell).toBe(true);
  });

  it('reads the Path key as well as PATH', () => {
    const result = resolveSpawnCommand('tool', [], {
      platform: 'win32',
      env: { Path: 'C:\\bin', PATHEXT: '.EXE' },
      exists: files('C:\\bin\\tool.EXE'),
    });
    expect(result.command).toBe('C:\\bin\\tool.EXE');
  });

  it('checks a command with an extension or a directory directly', () => {
    const withExt = resolveSpawnCommand('C:\\x\\srv.exe', [], {
      platform: 'win32',
      env: { PATH: '' },
      exists: files('C:\\x\\srv.exe'),
    });
    expect(withExt).toEqual({ command: 'C:\\x\\srv.exe', args: [], shell: false });

    const withDir = resolveSpawnCommand('C:\\x\\srv', [], {
      platform: 'win32',
      env: { PATH: '', PATHEXT: '.EXE' },
      exists: files('C:\\x\\srv.EXE'),
    });
    expect(withDir.command).toBe('C:\\x\\srv.EXE');
  });

  it('returns the command unchanged when not found', () => {
    const result = resolveSpawnCommand('nope', ['--stdio'], {
      platform: 'win32',
      env: { PATH: 'C:\\bin', PATHEXT: '.EXE;.CMD' },
      exists: () => false,
    });
    expect(result).toEqual({ command: 'nope', args: ['--stdio'], shell: false });
  });

  it.each(['a"b', '100%', 'a&b', 'a|b', 'a^b', 'a<b', 'a>b', '!x', 'a\nb'])(
    'throws for an unsafe batch-file argument %j',
    (arg) => {
      expect(() =>
        resolveSpawnCommand('tool', [arg], {
          platform: 'win32',
          env: { PATH: 'C:\\bin', PATHEXT: '.CMD' },
          exists: files('C:\\bin\\tool.CMD'),
        })
      ).toThrow();
    }
  );

  it('does not reject metacharacters for a direct .exe (no shell)', () => {
    const result = resolveSpawnCommand('tool', ['a&b'], {
      platform: 'win32',
      env: { PATH: 'C:\\bin', PATHEXT: '.EXE' },
      exists: files('C:\\bin\\tool.EXE'),
    });
    expect(result.shell).toBe(false);
  });
});
