# Requirements Quality Checklist: Signal Degraded LSP Mode and Diagnose PATH

**Purpose**: Validate that the specification is complete, unambiguous, and testable before planning.
**Created**: 2026-07-04
**Feature**: [spec.md](../spec.md)

## Requirement Completeness

- [x] CHK001 - Functional requirements defined for all primary user journeys (degraded warning, clean JSON, doctor). [Completeness]
- [x] CHK002 - Non-functional requirements specified (no JSON pollution, no exit-code change, single-warning constraint, no duplicated logic). [Completeness]
- [x] CHK003 - Edge cases and error scenarios identified (multi-file, multi-language, npx fallback, TS-skip, genuine failure, doctor failure). [Coverage]

## Requirement Clarity

- [x] CHK004 - Vague terms quantified with measurable criteria (exactly one warning, exit 0, valid JSON in 100% of runs). [Clarity]
- [x] CHK005 - Acceptance criteria objectively verifiable (each scenario is runnable and observable on stdout/stderr/exit code). [Measurability]
- [x] CHK006 - Terminology consistent across sections (degraded mode, parser fallback, optional LSP, doctor). [Consistency]

## Scenario Coverage

- [x] CHK007 - Primary happy-path scenarios defined (warning shown, analysis succeeds, doctor reports). [Coverage]
- [x] CHK008 - Alternative scenarios documented (LSP present → no warning; TS → no warning). [Coverage]
- [x] CHK009 - Exception/error scenarios specified (genuine analysis failure preserves codes; doctor self-failure returns non-zero). [Edge Cases]
- [x] CHK010 - Recovery/guidance scenarios defined (install hints in warning and doctor). [Coverage]

## Dependencies & Assumptions

- [x] CHK011 - External dependencies identified (`intelephense`, `pyright-langserver`, `gopls`, Node, bundled TypeScript). [Dependencies]
- [x] CHK012 - Assumptions explicitly documented (fallback is intentional; external LSPs stay optional; not auto-installed; not reusing editor LSP sessions). [Assumptions]
- [x] CHK013 - Constraints clearly defined (JSON contract unchanged, warnings stderr-only, one warning per provider per invocation). [Constraints]

## Notes

- No `[NEEDS CLARIFICATION]` markers remain — the input spec was highly detailed with explicit acceptance criteria; informed defaults covered the few open points (short branch name, shared component boundary).
