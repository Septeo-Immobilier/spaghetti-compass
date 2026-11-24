# spaghetti-compass MCP server

A thin MCP layer over the `spaghetti-compass` CLI. It owns no analysis logic: each tool shells out
to the CLI with `--json` and reshapes the answer into something an LLM can act on (compact lists,
`path:line` references, explicit caveats). The skill in `../skills/spaghetti-compass` stays valid and
documents the same CLI; the MCP is the easier way for an agent to call it.

## Tools

| Question | Tool |
|----------|------|
| What breaks if I change / delete file X? | `impact_of_file` |
| Who uses symbol S defined in file X? | `impact_of_symbol` (file impact narrowed to dependents that mention S — a text heuristic, labelled as such) |
| Review a branch/PR: which routes to re-test, which tests to run? | `review_changed_files` |
| What does function F call? Narrate the flow. | `trace_calls` |
| What does file X import? Any cycles? | `explore_dependencies` |
| Results look thin, or PHP / Python / Go? | `doctor` |

Every tool takes an optional `root` (project directory, default: the server's working directory) and
`context` (scanned directory, default `.`). Paths in answers are relative to `context`.

## Install

```bash
cd mcp && npm install
```

Run from a checkout (build the CLI first with `npm run build` at the repo root), or let the server
find the CLI itself. Launcher resolution order:

1. `SPAGHETTI_COMPASS_BIN` (e.g. `node /path/to/bin/spaghetti-compass.js`)
2. the repo build next to this folder
3. `spaghetti-compass` on `PATH` (`npm i -g @septeo-immo/spaghetti-compass`)
4. `npx -y @septeo-immo/spaghetti-compass`

## Register it

Easiest: the Claude Code plugin built by CI (`.github/workflows/publish-plugin.yml`, `scripts/plugin/`):

```
/plugin marketplace add https://github.com/Septeo-Immobilier/spaghetti-compass.git#dist
/plugin install spaghetti-compass@spaghetti-compass
```

The plugin ships a single-file bundle of this server (SDK inlined, no `npm install`). Manually:

Claude Code:

```bash
claude mcp add spaghetti-compass -- node /absolute/path/to/spaghetti-compass/mcp/server.mjs
```

Any MCP client (Cursor, Claude Desktop…):

```json
{
  "mcpServers": {
    "spaghetti-compass": {
      "command": "node",
      "args": ["/absolute/path/to/spaghetti-compass/mcp/server.mjs"]
    }
  }
}
```

The server analyses the directory it is started in unless a tool call passes `root`.

## Tests

```bash
cd mcp && npm test
```

Unit tests cover the reshaping; the end-to-end tests spawn the real server over stdio against this
repository (skipped when the CLI is not built).
