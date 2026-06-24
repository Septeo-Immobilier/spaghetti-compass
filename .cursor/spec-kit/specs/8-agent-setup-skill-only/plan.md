# Implementation Plan: Agent Setup — Skill-Only Output

**Branch**: `8-agent-setup-skill-only` | **Date**: 2026-06-24 | **Spec**: `spec.md`

## Summary

Refactor the `agent-setup` CLI command to output only a SKILL.md file (removing rules and commands output), and add interactive multi-select for choosing destination directories among the 3 standard skill locations (`.claude/skills/`, `.cursor/skills-cursor/`, `.agents/skills/`).

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js >=20  
**Primary Dependencies**: commander ^12.1.0 (existing), @inquirer/prompts (new)  
**Storage**: File system  
**Testing**: vitest ^4.0.18  
**Target Platform**: CLI (Node.js)  
**Project Type**: single  
**Constraints**: Must work in non-TTY environments via --dest flag

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| LSP-First | N/A | This feature is pure CLI, no LSP involvement |
| Architecture Modulaire | ✅ | Maintains separation: CLI layer only |
| Performance | ✅ | File writes only, no graph computation |

No violations.

## Project Structure

### Source Code (affected files)

```text
src/cli/
├── index.ts                          # CLI entry — update agent-setup command definition
└── agent-setup/
    ├── index.ts                      # Main orchestrator — rewrite for interactive flow
    ├── workflows.ts                  # Workflow registry — simplify to skill-only
    ├── path.ts                       # Path resolution — keep as-is
    ├── destinations.ts               # NEW: destination registry + prompt logic
    └── templates/
        └── cursor/
            └── index.ts              # Simplify: only export skill content
```

## Design Decisions

### 1. Destination Registry (`destinations.ts`)

New module that encapsulates:
- The 3 standard destination identifiers (`claude`, `cursor`, `agents`)
- Their corresponding relative paths
- The interactive prompt (using `@inquirer/prompts` checkbox)
- TTY detection for graceful fallback

```typescript
export type DestinationId = 'claude' | 'cursor' | 'agents';

export interface Destination {
  id: DestinationId;
  label: string;
  relativePath: string; // e.g. '.claude/skills'
}

export const DESTINATIONS: Destination[] = [
  { id: 'claude', label: '.claude/skills/', relativePath: '.claude/skills' },
  { id: 'cursor', label: '.cursor/skills-cursor/', relativePath: '.cursor/skills-cursor' },
  { id: 'agents', label: '.agents/skills/', relativePath: '.agents/skills' },
];
```

### 2. Updated Flow

```
agent-setup [path] [--dest id ...]
  │
  ├─ --dest provided? ──► validate ids ──► write skill to each dest
  │
  └─ no --dest? ──► is TTY?
                      ├─ yes ──► show checkbox prompt ──► write
                      └─ no  ──► error: "use --dest in non-interactive mode"
```

### 3. Simplified Template

The template module only exports the skill content string and the skill directory name:

```typescript
export const SKILL_DIR_NAME = 'spaghetti-compass-exploration';
export const SKILL_CONTENT = `...`; // existing SKILL_SPAGHETTI_COMPASS_EXPLORATION content
```

### 4. Commander Integration

The `--workflow` option is removed (no longer needed since output is always a skill). Replace with:

```
agent-setup [path] --dest <id...>
```

Where `--dest` is repeatable and accepts `claude`, `cursor`, `agents`.

## Complexity Tracking

No constitution violations. No extra complexity beyond the new dependency (`@inquirer/prompts`).
