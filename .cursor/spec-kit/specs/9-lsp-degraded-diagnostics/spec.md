# Feature Specification: Signal Degraded LSP Mode and Diagnose PATH

**Feature Branch**: `9-lsp-degraded-diagnostics`
**Created**: 2026-07-04
**Status**: Draft
**Input**: User description: "Signaler le mode LSP dégradé et diagnostiquer le PATH — rendre visible quand l'analyse fonctionne sans le LSP externe attendu (PHP/Python/Go), sans polluer les sorties JSON, et fournir une commande `doctor` de diagnostic du PATH."

## Overview

`spaghetti-compass` uses a hybrid resolution architecture: TypeScript/JavaScript resolution is bundled (embedded TypeScript Language Service), while PHP, Python, and Go resolution is *enhanced* when an optional external LSP (`intelephense`, `pyright-langserver`, `gopls`) is present in the `PATH`. When an external LSP is missing, resolution silently falls back to a parser-only mode. This fallback is intentional and must never break analysis — but today the user is never told that precision has degraded, so they cannot correctly interpret results nor decide to install the missing tool.

This feature makes the degraded mode **visible** (a warning on `stderr`, never in JSON output) and adds a `doctor` command that reports the availability of every useful executable.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Warned when analysis runs in degraded mode (Priority: P1)

A user analyzes a PHP, Python, or Go file while the corresponding external LSP is not installed. The analysis still succeeds using the parser fallback, and the user receives one clear warning telling them precision may be reduced and how to improve it.

**Why this priority**: This is the core value of the feature — without it, users unknowingly trust degraded results. It is the minimum shippable increment and delivers standalone value even without the `doctor` command.

**Independent Test**: Run `spaghetti-compass explore file.php` (or `.py`, `.go`) on a machine where the matching LSP is absent; confirm a warning appears on `stderr`, the analysis completes, and the exit code is `0`.

**Acceptance Scenarios**:

1. **Given** `intelephense` is not in the `PATH`, **When** the user runs `spaghetti-compass explore file.php`, **Then** a warning naming `intelephense` and stating that parser fallback is used is written to `stderr`, the analysis output is produced, and the exit code is `0`.
2. **Given** `pyright-langserver` is not in the `PATH`, **When** the user runs `spaghetti-compass explore file.py`, **Then** a warning naming `pyright-langserver` is written to `stderr` and the analysis completes successfully.
3. **Given** `gopls` is not in the `PATH`, **When** the user runs `spaghetti-compass explore file.go`, **Then** a warning naming `gopls` and indicating the fallback is used is written to `stderr`.
4. **Given** the matching external LSP **is** available, **When** the user analyzes a file of that language, **Then** no degraded-mode warning is emitted.

---

### User Story 2 - JSON output stays clean and machine-parseable (Priority: P1)

A user pipes the JSON output of an analysis to a file or another tool while an external LSP is missing. The warning must not corrupt the JSON.

**Why this priority**: `spaghetti-compass` is consumed by AI agents and scripts that parse `stdout`. A warning leaking into `stdout` would break every downstream consumer, so this constraint ships together with the warning itself.

**Independent Test**: Run `spaghetti-compass explore file.py --json > graph.json` with the Python LSP absent; confirm `graph.json` parses as valid JSON and the warning appeared only on `stderr`.

**Acceptance Scenarios**:

1. **Given** an external LSP is missing and `--json` is set, **When** the user redirects `stdout` to a file, **Then** the file contains only valid, parseable JSON with no warning text.
2. **Given** an external LSP is missing and `--json` is set, **When** the command runs, **Then** the degraded-mode warning is present on `stderr`.
3. **Given** the analysis succeeds with fallback, **When** it finishes, **Then** the exit code is `0` regardless of `--json`.

---

### User Story 3 - Diagnose the environment with `doctor` (Priority: P2)

A user who wants maximum precision, or who is troubleshooting why results look imprecise, runs `spaghetti-compass doctor` to see, in one place, which runtime and LSP executables are available and how to install the missing ones.

**Why this priority**: High operational value for onboarding and troubleshooting, but the warnings of US1/US2 already cover the primary "am I degraded?" need, so this is P2.

**Independent Test**: Run `spaghetti-compass doctor` on any machine; confirm it lists `spaghetti-compass`, Node, bundled TypeScript, `intelephense`, `pyright-langserver`, and `gopls` with an availability status for each, and exits `0` as long as `spaghetti-compass` and Node are available.

**Acceptance Scenarios**:

1. **Given** any environment, **When** the user runs `spaghetti-compass doctor`, **Then** a human-readable report lists the runtime tools (`spaghetti-compass`, Node), bundled TypeScript, and the three optional LSP tools, each marked available (with its resolved path) or missing (with an install hint).
2. **Given** `spaghetti-compass` and Node are available, **When** `doctor` runs, **Then** the exit code is `0` even if some optional LSPs are missing.
3. **Given** the user runs `spaghetti-compass doctor --json`, **When** the command completes, **Then** `stdout` contains a stable, parseable JSON document describing runtime and per-language LSP status.
4. **Given** the report is displayed, **When** the user reads it, **Then** it includes a note clarifying that `spaghetti-compass` starts its own LSP processes and does not reuse VSCode/Cursor LSP sessions.

---

### Edge Cases

- **Multiple files of the same language traversed**: the degraded-mode warning MUST appear at most once per unavailable provider per command invocation (no spamming).
- **Multiple languages in one traversal**: if analysis crosses files of several optional-LSP languages that are all unavailable, at most one warning per language is emitted.
- **Python direct binary vs `npx` fallback**: the current behavior tolerates resolving `pyright-langserver` via `npx`; the `doctor` diagnostic MUST still distinguish whether the direct `pyright-langserver` binary is present in the `PATH`.
- **TypeScript/JavaScript files**: never emit a degraded-mode warning, because the TypeScript Language Service is bundled.
- **Analysis genuinely fails** (parse error, file not found, etc.): existing error messages and existing non-zero exit codes are preserved unchanged; the degraded-mode warning does not alter them.
- **`doctor` itself fails unexpectedly** (e.g., cannot inspect the environment): it exits with a non-zero code — this is the only case where `doctor` returns non-zero.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When `explore` (or any traversal command) analyzes a file whose language has an optional LSP provider that is unavailable, the system MUST write a clear degraded-mode warning to `stderr`.
- **FR-002**: The degraded-mode warning MUST name the expected executable (`intelephense`, `pyright-langserver`, or `gopls`) and state that analysis continues with a parser fallback whose precision may be reduced.
- **FR-003**: The system MUST NOT emit any degraded-mode warning for TypeScript/JavaScript files, because their resolution is bundled.
- **FR-004**: The system MUST write degraded-mode warnings only to `stderr`, never to `stdout`.
- **FR-005**: When `--json` is used, `stdout` MUST contain only valid, parseable JSON with no warning text mixed in.
- **FR-006**: The absence of an external LSP MUST NOT change the exit code when the analysis otherwise succeeds — the exit code MUST remain `0`.
- **FR-007**: Existing error conditions MUST keep their current exit codes and messages, unaffected by this feature.
- **FR-008**: For a single command invocation, the system MUST emit at most one degraded-mode warning per unavailable provider, even when many files of that language are traversed.
- **FR-009**: The system MUST provide a `doctor` CLI command that inspects and reports the availability of useful executables.
- **FR-010**: `doctor` MUST report, at minimum: `spaghetti-compass` itself, Node, bundled TypeScript, `intelephense`, `pyright-langserver`, and `gopls`.
- **FR-011**: For each available executable, `doctor` MUST show its resolved location (or `bundled` for TypeScript); for each missing optional LSP, it MUST show an install hint.
- **FR-012**: `doctor` MUST include a note stating that `spaghetti-compass` starts its own LSP processes and does not reuse VSCode/Cursor LSP sessions.
- **FR-013**: `doctor` MUST exit `0` when `spaghetti-compass` and Node are available, even if optional LSPs are missing.
- **FR-014**: `doctor` MUST exit non-zero only when the diagnostic itself fails unexpectedly.
- **FR-015**: `doctor` MUST support a `--json` option producing a stable, parseable JSON document describing runtime status and per-language (`typescript`, `php`, `python`, `go`) LSP status.
- **FR-016**: TypeScript/JavaScript MUST always be reported as available with mode `bundled`.
- **FR-017**: The Python diagnostic MUST distinguish whether the direct `pyright-langserver` binary is present in the `PATH`, independently of any `npx`-based fallback compatibility.
- **FR-018**: Detection of an optional LSP MUST be based on presence in the `PATH` (PHP: `intelephense`; Python: `pyright-langserver`; Go: `gopls`), and MAY additionally verify the tool responds (e.g. `gopls version`).
- **FR-019**: Executable-detection logic, user-facing messages, and install hints MUST be centralized in one shared component and reused across the provider factory, the language providers, and the `doctor` command (no duplicated detection logic).
- **FR-020**: The main graph contract of `explore` / `impact` MUST NOT change, and existing JSON outputs MUST NOT break.

### Key Entities *(include if feature involves data)*

- **LSP Provider Status**: describes the resolution state chosen for a language during a command — the language, the provider name, whether it is available, whether the mode is degraded, and an optional user-facing message.
- **Executable Availability**: describes one inspected tool — its logical name/command, whether it was found, its resolved path (when found), and its install hint (when relevant).
- **Doctor Report**: an aggregate of runtime availability (Node, `spaghetti-compass`) and per-language LSP availability, used for both the text and JSON renderings.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When an optional LSP is missing, a user analyzing that language sees exactly one warning explaining the degraded mode and how to fix it, on `stderr`, in 100% of such runs.
- **SC-002**: With `--json`, `stdout` is valid parseable JSON in 100% of runs whether or not an optional LSP is present (no regression against current JSON consumers).
- **SC-003**: A successful analysis returns exit code `0` in 100% of runs where the only difference is a missing optional LSP.
- **SC-004**: No degraded-mode warning is ever emitted for a TypeScript/JavaScript-only analysis (0 occurrences).
- **SC-005**: For a single command traversing N files of the same unavailable-LSP language, the number of degraded-mode warnings emitted for that provider is exactly 1 (never scales with N).
- **SC-006**: `spaghetti-compass doctor` reports the status of all six required entries and returns `0` whenever `spaghetti-compass` and Node are available, including when all optional LSPs are missing.
- **SC-007**: `spaghetti-compass doctor --json` output parses successfully and its top-level shape (`runtime`, `lsp`) is stable across runs on the same machine.
- **SC-008**: The full existing test suite continues to pass with no regressions.
