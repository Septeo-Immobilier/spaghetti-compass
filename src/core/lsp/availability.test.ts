/**
 * Unit tests for availability module.
 * Tests detection logic with mocked execSync to verify behavior without system LSPs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as childProcess from 'node:child_process';
import {
  checkExecutable,
  checkLspForLanguage,
  degradedMessage,
  LSP_COMMANDS,
} from './availability.js';

// Mock execSync
vi.mock('node:child_process');

describe('availability module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkExecutable', () => {
    it('returns available=true with path when command is found', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockExecSync = vi.mocked(childProcess.execSync) as any;
      mockExecSync.mockReturnValue('/usr/local/bin/gopls\n');

      const result = checkExecutable('gopls');

      expect(result.command).toBe('gopls');
      expect(result.available).toBe(true);
      expect(result.path).toBe('/usr/local/bin/gopls');
    });

    it('returns available=false when command not found (throws)', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockExecSync = vi.mocked(childProcess.execSync) as any;
      mockExecSync.mockImplementation(() => {
        throw new Error('command not found');
      });

      const result = checkExecutable('gopls');

      expect(result.command).toBe('gopls');
      expect(result.available).toBe(false);
      expect(result.path).toBeUndefined();
    });

    it('handles multiple paths by taking the first line', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockExecSync = vi.mocked(childProcess.execSync) as any;
      mockExecSync.mockReturnValue('/usr/local/bin/gopls\n/opt/gopls\n');

      const result = checkExecutable('gopls');

      expect(result.path).toBe('/usr/local/bin/gopls');
    });

    it('trims whitespace from path', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockExecSync = vi.mocked(childProcess.execSync) as any;
      mockExecSync.mockReturnValue('  /usr/local/bin/gopls  \n');

      const result = checkExecutable('gopls');

      expect(result.path).toBe('/usr/local/bin/gopls');
    });

    it('never throws, even on unexpected errors', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockExecSync = vi.mocked(childProcess.execSync) as any;
      mockExecSync.mockImplementation(() => {
        throw new Error('Something unexpected');
      });

      expect(() => checkExecutable('gopls')).not.toThrow();
    });
  });

  describe('checkLspForLanguage', () => {
    it('returns availability with installHint for php', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockExecSync = vi.mocked(childProcess.execSync) as any;
      mockExecSync.mockImplementation(() => {
        throw new Error('not found');
      });

      const result = checkLspForLanguage('php');

      expect(result.command).toBe('intelephense');
      expect(result.available).toBe(false);
      expect(result.installHint).toBe(LSP_COMMANDS.php.installHint);
    });

    it('returns availability with installHint for python', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockExecSync = vi.mocked(childProcess.execSync) as any;
      mockExecSync.mockImplementation(() => {
        throw new Error('not found');
      });

      const result = checkLspForLanguage('python');

      expect(result.command).toBe('pyright-langserver');
      expect(result.available).toBe(false);
      expect(result.installHint).toBe(LSP_COMMANDS.python.installHint);
    });

    it('returns availability with installHint for go', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockExecSync = vi.mocked(childProcess.execSync) as any;
      mockExecSync.mockImplementation(() => {
        throw new Error('not found');
      });

      const result = checkLspForLanguage('go');

      expect(result.command).toBe('gopls');
      expect(result.available).toBe(false);
      expect(result.installHint).toBe(LSP_COMMANDS.go.installHint);
    });

    it('returns path when LSP is available', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockExecSync = vi.mocked(childProcess.execSync) as any;
      mockExecSync.mockReturnValue('/usr/local/bin/gopls\n');

      const result = checkLspForLanguage('go');

      expect(result.available).toBe(true);
      expect(result.path).toBe('/usr/local/bin/gopls');
      expect(result.installHint).toBe(LSP_COMMANDS.go.installHint);
    });
  });

  describe('degradedMessage', () => {
    it('returns exact PHP degraded-mode message', () => {
      const msg = degradedMessage('php');

      expect(msg).toBe(
        'Warning: PHP LSP unavailable: `intelephense` was not found in PATH. Continuing with parser fallback; symbol resolution may be less precise.'
      );
    });

    it('returns exact Python degraded-mode message', () => {
      const msg = degradedMessage('python');

      expect(msg).toBe(
        'Warning: Python LSP unavailable: `pyright-langserver` was not found in PATH. Continuing with parser fallback; symbol resolution may be less precise.'
      );
    });

    it('returns exact Go degraded-mode message', () => {
      const msg = degradedMessage('go');

      expect(msg).toBe(
        'Warning: Go LSP unavailable: `gopls` was not found in PATH. Continuing with parser fallback; symbol positions may be less precise.'
      );
    });
  });

  describe('LSP_COMMANDS map', () => {
    it('contains all three required languages', () => {
      expect(LSP_COMMANDS).toHaveProperty('php');
      expect(LSP_COMMANDS).toHaveProperty('python');
      expect(LSP_COMMANDS).toHaveProperty('go');
    });

    it('each entry has command and installHint', () => {
      for (const [, config] of Object.entries(LSP_COMMANDS)) {
        expect(config).toHaveProperty('command');
        expect(config).toHaveProperty('installHint');
        expect(typeof config.command).toBe('string');
        expect(typeof config.installHint).toBe('string');
        expect(config.command.length).toBeGreaterThan(0);
        expect(config.installHint.length).toBeGreaterThan(0);
      }
    });
  });
});
