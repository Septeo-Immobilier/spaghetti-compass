# Research — 8-agent-setup-skill-only

## Decision: Interactive prompt library

**Decision**: Use `@inquirer/prompts` (v7+) for interactive multi-select.

**Rationale**: 
- The project already uses `commander` for CLI argument parsing — `@inquirer/prompts` is the standard pairing for interactive prompts in Node.js CLIs.
- `@inquirer/prompts` v7+ supports ES modules natively, aligning with the project's `"type": "module"`.
- It provides a `checkbox` prompt which maps directly to the "multi-select" UX requirement.
- Lightweight: individual prompt types can be imported selectively (`@inquirer/prompts` or `@inquirer/checkbox`).

**Alternatives considered**:
- `enquirer`: Less active maintenance, smaller ecosystem.
- `prompts`: Simpler but less feature-rich for checkbox/multi-select.
- Custom stdin reader: Over-engineering for a standard UX pattern.

## Decision: Skill-only output (remove rules and commands)

**Decision**: The `getCursorArtifacts()` function returns only the SKILL.md artifact. The rule and command content are removed entirely.

**Rationale**:
- User explicitly requested skill-only output.
- The skill file already contains all the information from the rule (when to use, why, commands) — the rule was largely redundant.
- The command file (`/spaghetti-compass-explore`) duplicates what an agent can derive from the skill.

**Alternatives considered**:
- Keep rules/commands as optional: rejected — adds complexity for no clear benefit.

## Decision: Destination paths

**Decision**: The 3 standard destinations are:
1. `.claude/skills/<skill-name>/SKILL.md`
2. `.cursor/skills-cursor/<skill-name>/SKILL.md`
3. `.agents/skills/<skill-name>/SKILL.md`

**Rationale**: These are the conventional locations for skills in each tool's ecosystem. The skill name subdirectory (`spaghetti-compass-exploration/`) is preserved for all destinations.

**Alternatives considered**:
- Write at root of skills dir without subdirectory: rejected — doesn't follow conventions.
- Different file names per tool: rejected — skill content is identical, tools all read SKILL.md.

## Decision: Non-interactive mode via --dest flag

**Decision**: Accept repeatable `--dest` option (e.g. `--dest claude --dest agents`) using shorthand identifiers rather than raw paths.

**Rationale**: Shorthand identifiers are less error-prone and self-documenting. Valid values: `claude`, `cursor`, `agents`.

**Alternatives considered**:
- Raw paths: more flexible but more error-prone and verbose.
- Single comma-separated string: less idiomatic for commander.
