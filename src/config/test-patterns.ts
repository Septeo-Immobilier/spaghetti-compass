/**
 * Default globs identifying TEST files, per supported language.
 *
 * `impact` uses these to split its reverse-dependency set in two:
 *
 *   - `dependents` / `directDependents` / `routes` — production code only.
 *     A test file is never part of a blast radius: changing the target cannot
 *     break a test in the sense that matters (a user-visible entry point), and
 *     counting tests inflates the answer past the point of being actionable.
 *   - `coveringTests` — the test files that transitively reach the target.
 *     That is the "what already exercises this change?" question, and it is
 *     only answerable because these files are scanned rather than excluded.
 *
 * Why this list and not the context's `--exclude`: excluding a test file at
 * scan time destroys the information before it can be classified. The split
 * happens after the graph is built, so both answers stay available.
 *
 * Go's `_test.go` suffix is a toolchain rule, not a convention — `go test`
 * itself keys off it — so that entry is exact rather than heuristic. The
 * others are the dominant conventions of their ecosystems; a project that
 * names tests differently overrides the whole list with `--tests`.
 */
export const DEFAULT_TEST_PATTERNS: readonly string[] = [
  // Go — enforced by the toolchain.
  '**/*_test.go',
  // JavaScript / TypeScript — Jest, Vitest, Mocha.
  '**/*.test.*',
  '**/*.spec.*',
  '**/__tests__/**',
  // Python — pytest and unittest discovery.
  '**/test_*.py',
  '**/*_test.py',
  // PHP — PHPUnit.
  '**/*Test.php',
  // Shared across ecosystems.
  '**/tests/**',
  '**/testdata/**',
];
