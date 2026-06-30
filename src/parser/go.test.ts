/**
 * Tests unitaires pour GoParser
 */

import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { GoParser } from './go.js';

// Helper: écrire un fichier temporaire et retourner son chemin absolu
function writeTmp(content: string, ext = '.go'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'go-parser-test-'));
  const filePath = path.join(dir, `test${ext}`);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

const tmpFiles: string[] = [];

function writeTmpTracked(content: string, ext = '.go'): string {
  const filePath = writeTmp(content, ext);
  tmpFiles.push(path.dirname(filePath));
  return filePath;
}

afterEach(() => {
  for (const dir of tmpFiles.splice(0)) {
    try {
      fs.rmSync(dir, { recursive: true });
    } catch {
      // ignore cleanup errors
    }
  }
});

const parser = new GoParser();

// ---------------------------------------------------------------------------
// Parser metadata
// ---------------------------------------------------------------------------

describe('GoParser - metadata', () => {
  it('has name "go"', () => {
    expect(parser.name).toBe('go');
  });

  it('supports .go extension', () => {
    expect(parser.supportedExtensions).toContain('.go');
  });

  it('isSupported returns true for .go files', () => {
    expect(parser.isSupported('/any/path/file.go')).toBe(true);
  });

  it('isSupported returns false for non-Go files', () => {
    expect(parser.isSupported('/any/path/file.ts')).toBe(false);
    expect(parser.isSupported('/any/path/file.php')).toBe(false);
  });

  it('returns error for non-existent file', () => {
    const result = parser.parse('/does/not/exist.go');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/File not found/);
  });
});

// ---------------------------------------------------------------------------
// Imports — single form
// ---------------------------------------------------------------------------

describe('GoParser - single import', () => {
  it('extracts a bare single import', () => {
    const filePath = writeTmpTracked(`package main\n\nimport "fmt"\n\nfunc main() {}\n`);
    const result = parser.parse(filePath);

    expect(result.errors).toHaveLength(0);
    expect(result.imports).toHaveLength(1);
    const imp = result.imports[0];
    expect(imp.moduleSpecifier).toBe('fmt');
    expect(imp.type).toBe('import-static');
    expect(imp.resolved).toBe(false);
    expect(imp.importedNames).toEqual([]);
  });

  it('extracts a single import with alias', () => {
    const filePath = writeTmpTracked(`package main\n\nimport myctx "context"\n`);
    const result = parser.parse(filePath);

    expect(result.errors).toHaveLength(0);
    expect(result.imports).toHaveLength(1);
    const imp = result.imports[0];
    expect(imp.moduleSpecifier).toBe('context');
    expect(imp.importedNames).toEqual(['myctx']);
  });

  it('extracts a blank import', () => {
    const filePath = writeTmpTracked(`package main\n\nimport _ "database/sql/driver"\n`);
    const result = parser.parse(filePath);

    expect(result.errors).toHaveLength(0);
    expect(result.imports).toHaveLength(1);
    expect(result.imports[0].moduleSpecifier).toBe('database/sql/driver');
    expect(result.imports[0].importedNames).toEqual([]);
  });

  it('extracts a dot import', () => {
    const filePath = writeTmpTracked(`package main\n\nimport . "testing"\n`);
    const result = parser.parse(filePath);

    expect(result.errors).toHaveLength(0);
    expect(result.imports).toHaveLength(1);
    expect(result.imports[0].moduleSpecifier).toBe('testing');
    expect(result.imports[0].importedNames).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Imports — grouped form
// ---------------------------------------------------------------------------

describe('GoParser - grouped imports', () => {
  const src = `package main

import (
  "context"
  "fmt"
  foo "github.com/example/app/internal/domain/invoice"
  _ "github.com/some/driver"
  . "github.com/some/dot"
)

func main() {}
`;

  it('extracts all imports from a grouped block', () => {
    const filePath = writeTmpTracked(src);
    const result = parser.parse(filePath);

    expect(result.errors).toHaveLength(0);
    expect(result.imports).toHaveLength(5);

    const specifiers = result.imports.map(i => i.moduleSpecifier);
    expect(specifiers).toContain('context');
    expect(specifiers).toContain('fmt');
    expect(specifiers).toContain('github.com/example/app/internal/domain/invoice');
    expect(specifiers).toContain('github.com/some/driver');
    expect(specifiers).toContain('github.com/some/dot');
  });

  it('all grouped imports have type import-static', () => {
    const filePath = writeTmpTracked(src);
    const result = parser.parse(filePath);
    for (const imp of result.imports) {
      expect(imp.type).toBe('import-static');
    }
  });

  it('all grouped imports have resolved: false', () => {
    const filePath = writeTmpTracked(src);
    const result = parser.parse(filePath);
    for (const imp of result.imports) {
      expect(imp.resolved).toBe(false);
    }
  });

  it('named alias has importedNames set', () => {
    const filePath = writeTmpTracked(src);
    const result = parser.parse(filePath);
    const aliasedImp = result.imports.find(i => i.moduleSpecifier === 'github.com/example/app/internal/domain/invoice');
    expect(aliasedImp).toBeDefined();
    expect(aliasedImp!.importedNames).toEqual(['foo']);
  });

  it('blank import has empty importedNames', () => {
    const filePath = writeTmpTracked(src);
    const result = parser.parse(filePath);
    const blankImp = result.imports.find(i => i.moduleSpecifier === 'github.com/some/driver');
    expect(blankImp).toBeDefined();
    expect(blankImp!.importedNames).toEqual([]);
  });

  it('dot import has empty importedNames', () => {
    const filePath = writeTmpTracked(src);
    const result = parser.parse(filePath);
    const dotImp = result.imports.find(i => i.moduleSpecifier === 'github.com/some/dot');
    expect(dotImp).toBeDefined();
    expect(dotImp!.importedNames).toEqual([]);
  });

  it('records correct 1-indexed line numbers', () => {
    const filePath = writeTmpTracked(src);
    const result = parser.parse(filePath);
    const ctxImp = result.imports.find(i => i.moduleSpecifier === 'context');
    // "context" is on line 4 in the source above
    expect(ctxImp).toBeDefined();
    expect(ctxImp!.line).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

describe('GoParser - exports', () => {
  const src = `package app

import "fmt"

// Top-level function
func ComputeTotal(items []Item) float64 {
  return 0
}

// Method with value receiver
func (r Invoice) Validate() error {
  return nil
}

// Method with pointer receiver
func (uc *ReceiveInvoice) Execute(ctx context.Context) error {
  return nil
}

// Struct type
type Invoice struct {
  ID string
}

// Interface type
type InvoiceRepository interface {
  Find(id string) (*Invoice, error)
}

// Type alias
type InvoiceID = string

var _ = fmt.Sprintf
`;

  it('extracts top-level function', () => {
    const filePath = writeTmpTracked(src);
    const result = parser.parse(filePath);
    const exp = result.exports.find(e => e.name === 'ComputeTotal');
    expect(exp).toBeDefined();
    expect(exp!.kind).toBe('function');
  });

  it('extracts value-receiver method as ReceiverType.Method', () => {
    const filePath = writeTmpTracked(src);
    const result = parser.parse(filePath);
    const exp = result.exports.find(e => e.name === 'Invoice.Validate');
    expect(exp).toBeDefined();
    expect(exp!.kind).toBe('function');
  });

  it('extracts pointer-receiver method using receiver TYPE (not var name)', () => {
    const filePath = writeTmpTracked(src);
    const result = parser.parse(filePath);
    const exp = result.exports.find(e => e.name === 'ReceiveInvoice.Execute');
    expect(exp).toBeDefined();
    expect(exp!.kind).toBe('function');
  });

  it('extracts struct type as kind "class"', () => {
    const filePath = writeTmpTracked(src);
    const result = parser.parse(filePath);
    const exp = result.exports.find(e => e.name === 'Invoice' && e.kind === 'class');
    expect(exp).toBeDefined();
  });

  it('extracts interface type as kind "class"', () => {
    const filePath = writeTmpTracked(src);
    const result = parser.parse(filePath);
    const exp = result.exports.find(e => e.name === 'InvoiceRepository');
    expect(exp).toBeDefined();
    expect(exp!.kind).toBe('class');
  });

  it('extracts type alias as kind "class"', () => {
    const filePath = writeTmpTracked(src);
    const result = parser.parse(filePath);
    const exp = result.exports.find(e => e.name === 'InvoiceID');
    expect(exp).toBeDefined();
    expect(exp!.kind).toBe('class');
  });

  it('records correct 1-indexed line for functions', () => {
    const filePath = writeTmpTracked(src);
    const result = parser.parse(filePath);
    const exp = result.exports.find(e => e.name === 'ComputeTotal');
    expect(exp).toBeDefined();
    // Line 6 in the source above
    expect(exp!.line).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// Functions + calls
// ---------------------------------------------------------------------------

describe('GoParser - functions and calls', () => {
  const src = `package usecases

import (
  "context"
  reception "github.com/example/app/internal/reception"
  "github.com/example/app/internal/domain/invoice"
)

func (uc *ReceiveInvoice) Execute(ctx context.Context) error {
  doc := normalizeDocument(ctx)
  inv := reception.NewInboundDocument(doc)
  _ = invoice.Validate(inv)
  return nil
}
`;

  it('does not throw and has no errors', () => {
    const filePath = writeTmpTracked(src);
    const result = parser.parse(filePath, { extractFunctions: true });
    expect(result.errors).toHaveLength(0);
  });

  it('extracts the method as ReceiveInvoice.Execute', () => {
    const filePath = writeTmpTracked(src);
    const result = parser.parse(filePath, { extractFunctions: true });
    const fn = result.functions.find(f => f.name === 'ReceiveInvoice.Execute');
    expect(fn).toBeDefined();
  });

  it('function is marked exported', () => {
    const filePath = writeTmpTracked(src);
    const result = parser.parse(filePath, { extractFunctions: true });
    const fn = result.functions.find(f => f.name === 'ReceiveInvoice.Execute');
    expect(fn!.exported).toBe(true);
  });

  it('extracts local call normalizeDocument', () => {
    const filePath = writeTmpTracked(src);
    const result = parser.parse(filePath, { extractFunctions: true });
    const fn = result.functions.find(f => f.name === 'ReceiveInvoice.Execute')!;
    const call = fn.calls.find(c => c.name === 'normalizeDocument');
    expect(call).toBeDefined();
  });

  it('extracts selector call reception.NewInboundDocument with fromModule set', () => {
    const filePath = writeTmpTracked(src);
    const result = parser.parse(filePath, { extractFunctions: true });
    const fn = result.functions.find(f => f.name === 'ReceiveInvoice.Execute')!;
    const call = fn.calls.find(c => c.name === 'reception.NewInboundDocument');
    expect(call).toBeDefined();
    expect(call!.fromModule).toBe('github.com/example/app/internal/reception');
  });

  it('extracts selector call invoice.Validate with fromModule set', () => {
    const filePath = writeTmpTracked(src);
    const result = parser.parse(filePath, { extractFunctions: true });
    const fn = result.functions.find(f => f.name === 'ReceiveInvoice.Execute')!;
    const call = fn.calls.find(c => c.name === 'invoice.Validate');
    expect(call).toBeDefined();
    expect(call!.fromModule).toBe('github.com/example/app/internal/domain/invoice');
  });

  it('does not extract Go keywords as calls', () => {
    const src2 = `package main

func DoWork() {
  if true {
    for i := 0; i < 10; i++ {
      go func() {}()
      defer cleanup()
    }
  }
}
`;
    const filePath = writeTmpTracked(src2);
    const result = parser.parse(filePath, { extractFunctions: true });
    const fn = result.functions.find(f => f.name === 'DoWork')!;
    const callNames = fn.calls.map(c => c.name);
    expect(callNames).not.toContain('if');
    expect(callNames).not.toContain('for');
    expect(callNames).not.toContain('go');
  });

  it('does not extract Go builtins as calls', () => {
    const src3 = `package main

func Process(data []byte) []byte {
  result := make([]byte, len(data))
  copy(result, data)
  return append(result, 0)
}
`;
    const filePath = writeTmpTracked(src3);
    const result = parser.parse(filePath, { extractFunctions: true });
    const fn = result.functions.find(f => f.name === 'Process')!;
    const callNames = fn.calls.map(c => c.name);
    expect(callNames).not.toContain('make');
    expect(callNames).not.toContain('len');
    expect(callNames).not.toContain('copy');
    expect(callNames).not.toContain('append');
  });

  it('extracts NewX constructor as a plain call', () => {
    const src4 = `package main

import svc "github.com/example/app/internal/service"

func Bootstrap() {
  mgr := svc.NewManager()
  _ = mgr
}
`;
    const filePath = writeTmpTracked(src4);
    const result = parser.parse(filePath, { extractFunctions: true });
    const fn = result.functions.find(f => f.name === 'Bootstrap')!;
    const call = fn.calls.find(c => c.name === 'svc.NewManager');
    expect(call).toBeDefined();
    expect(call!.fromModule).toBe('github.com/example/app/internal/service');
  });

  it('deduplicates repeated calls within a function body', () => {
    const src5 = `package main

func Repeat() {
  doWork()
  doWork()
  doWork()
}
`;
    const filePath = writeTmpTracked(src5);
    const result = parser.parse(filePath, { extractFunctions: true });
    const fn = result.functions.find(f => f.name === 'Repeat')!;
    const workCalls = fn.calls.filter(c => c.name === 'doWork');
    expect(workCalls).toHaveLength(1);
  });

  it('does not populate functions when extractFunctions is false', () => {
    const src6 = `package main\n\nfunc Foo() {}\n`;
    const filePath = writeTmpTracked(src6);
    const result = parser.parse(filePath);
    expect(result.functions).toHaveLength(0);
  });

  it('records correct 1-indexed line for extracted function', () => {
    const filePath = writeTmpTracked(src);
    const result = parser.parse(filePath, { extractFunctions: true });
    const fn = result.functions.find(f => f.name === 'ReceiveInvoice.Execute')!;
    // func declaration is on line 9 in src
    expect(fn.line).toBe(9);
  });
});

// ---------------------------------------------------------------------------
// Top-level functions
// ---------------------------------------------------------------------------

describe('GoParser - top-level function extraction', () => {
  it('extracts a simple top-level function', () => {
    const src = `package main\n\nfunc Hello() string {\n  return "hello"\n}\n`;
    const filePath = writeTmpTracked(src);
    const result = parser.parse(filePath, { extractFunctions: true });
    const fn = result.functions.find(f => f.name === 'Hello');
    expect(fn).toBeDefined();
    expect(fn!.exported).toBe(true);
  });

  it('handles multiple top-level functions', () => {
    const src = `package main

func Foo() {}

func Bar() {}

func Baz() {}
`;
    const filePath = writeTmpTracked(src);
    const result = parser.parse(filePath, { extractFunctions: true });
    const names = result.functions.map(f => f.name);
    expect(names).toContain('Foo');
    expect(names).toContain('Bar');
    expect(names).toContain('Baz');
  });
});

// ---------------------------------------------------------------------------
// CRLF normalisation
// ---------------------------------------------------------------------------

describe('GoParser - CRLF normalisation', () => {
  it('parses files with Windows line endings', () => {
    const content = 'package main\r\n\r\nimport "fmt"\r\n\r\nfunc main() {\r\n\tfmt.Println("hi")\r\n}\r\n';
    const filePath = writeTmpTracked(content);
    const result = parser.parse(filePath);
    expect(result.errors).toHaveLength(0);
    expect(result.imports).toHaveLength(1);
    expect(result.imports[0].moduleSpecifier).toBe('fmt');
  });
});
