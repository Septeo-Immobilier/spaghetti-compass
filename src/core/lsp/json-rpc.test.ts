import { describe, it, expect } from 'vitest';
import { uriToPath } from './json-rpc.js';

describe('uriToPath', () => {
  it('decodes an encoded drive colon and uppercases the drive letter', () => {
    expect(uriToPath('file:///c%3A/Users/x/a.py')).toBe('C:/Users/x/a.py');
  });

  it('keeps an already uppercase, unencoded drive path', () => {
    expect(uriToPath('file:///C:/Users/x/a.py')).toBe('C:/Users/x/a.py');
  });

  it('decodes percent sequences in POSIX paths', () => {
    expect(uriToPath('file:///home/a%20b/x.py')).toBe('/home/a b/x.py');
  });

  it('does not throw on a malformed percent sequence', () => {
    expect(() => uriToPath('file:///home/100%/x.py')).not.toThrow();
    expect(uriToPath('file:///home/100%/x.py')).toBe('/home/100%/x.py');
  });
});
