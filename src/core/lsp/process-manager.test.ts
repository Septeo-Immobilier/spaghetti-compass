import { describe, it, expect, afterEach, vi } from 'vitest';
import * as cp from 'node:child_process';
import { LspProcessManager } from './process-manager.js';

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return { ...actual, spawn: vi.fn(actual.spawn) };
});

const spawnSpy = vi.mocked(cp.spawn);

/** Tiny LSP server: answers `initialize` with Content-Length framing. */
const FAKE_SERVER = `
let buf = '';
process.stdin.on('data', (d) => {
  buf += d.toString();
  for (;;) {
    const m = /Content-Length: (\\d+)\\r\\n\\r\\n/.exec(buf);
    if (!m) return;
    const start = m.index + m[0].length;
    const len = Number(m[1]);
    if (Buffer.byteLength(buf.slice(start)) < len) return;
    const body = JSON.parse(buf.slice(start, start + len));
    buf = buf.slice(start + len);
    if (body.method === 'initialize') {
      const out = JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { capabilities: {} } });
      process.stdout.write('Content-Length: ' + Buffer.byteLength(out) + '\\r\\n\\r\\n' + out);
    }
  }
});
`;

describe('LspProcessManager', () => {
  const managers: LspProcessManager[] = [];
  const make = () => {
    const m = new LspProcessManager({ timeout: 1500 });
    managers.push(m);
    return m;
  };

  afterEach(async () => {
    await Promise.all(managers.splice(0).map((m) => m.shutdownAll()));
    spawnSpy.mockClear();
  });

  it('returns null for a missing command without an unhandled error, and does not retry', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (e: unknown) => unhandled.push(e);
    process.on('unhandledRejection', onUnhandled);
    process.on('uncaughtException', onUnhandled);

    try {
      const manager = make();
      const first = await manager.getOrCreateProcess(
        'test:missing',
        'definitely-not-a-real-lsp-xyz',
        ['--stdio'],
        process.cwd()
      );
      expect(first).toBeNull();
      expect(spawnSpy).toHaveBeenCalledTimes(1);

      const second = await manager.getOrCreateProcess(
        'test:missing',
        'definitely-not-a-real-lsp-xyz',
        ['--stdio'],
        process.cwd()
      );
      expect(second).toBeNull();
      expect(spawnSpy).toHaveBeenCalledTimes(1);

      await new Promise((r) => setTimeout(r, 50));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
      process.off('uncaughtException', onUnhandled);
    }
  });

  it('initializes against a real spawned process', async () => {
    const manager = make();
    const lsp = await manager.getOrCreateProcess(
      'test:fake',
      process.execPath,
      ['-e', FAKE_SERVER],
      process.cwd()
    );
    expect(lsp).not.toBeNull();
    expect(lsp?.initialized).toBe(true);
  });
});
