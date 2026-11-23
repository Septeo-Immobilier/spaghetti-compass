#!/usr/bin/env node
/**
 * spaghetti-compass MCP server (stdio).
 *
 * A thin, LLM-oriented layer over the spaghetti-compass CLI: well-described
 * tools for the practical questions ("what breaks if I change this?",
 * "what does this function call?"), compact answers, no analysis logic of its own.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { tools } from './lib/tools.mjs';

const INSTRUCTIONS = `Semantic code navigation backed by language servers and parsers (not grep).
Pick the tool by question:
- "What breaks if I change/delete file X?" -> impact_of_file
- "Who uses symbol S defined in file X?"   -> impact_of_symbol
- "Review this branch/PR: what to re-test?" -> review_changed_files
- "What does function F call? Explain the flow" -> trace_calls
- "What does X import? Any cycles?"          -> explore_dependencies
- Results look thin or a language is PHP/Python/Go -> doctor
Paths are relative to \`root\` (default: the server's working directory). Supported: ts, tsx, js, jsx, mjs, cjs, py, php, go.
An empty answer is never absolute proof (unparsable files add no edges; Go is package-granular).`;

const server = new McpServer(
  { name: 'spaghetti-compass', version: '0.1.0' },
  { instructions: INSTRUCTIONS }
);

for (const tool of tools) {
  server.registerTool(
    tool.name,
    { title: tool.title, description: tool.description, inputSchema: tool.inputSchema },
    async (args) => {
      try {
        const result = await tool.handler(args);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: String(err instanceof Error ? err.message : err) }],
        };
      }
    }
  );
}

await server.connect(new StdioServerTransport());
