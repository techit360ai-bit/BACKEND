/**
 * MCP Inspector — lists every registered server/tool and allows manual
 * invocation BEFORE any agent uses them (guide §MCP step 5).
 *
 *   npm run mcp:inspect                      # list all tools
 *   npm run mcp:inspect github read_file '{"repo":"havitec/techit","path":"README.md"}'
 *
 * Plugins are imported dynamically so this dev tool does not create a static
 * dependency cycle between mcp-client and the plugins.
 */

import type { Actor } from '@techit/core';
import { createRuntime } from '@techit/plugin-sdk';
import { MCPRegistry } from './registry.js';
import { MCPClient } from './client.js';

const WORKSPACE = 'ws-inspector';

async function loadPlugins(runtime: ReturnType<typeof createRuntime>, registry: MCPRegistry) {
  // Add new connectors here as they land.
  const { registerGithubPlugin } = await import('@techit/plugin-github');
  await registerGithubPlugin({ runtime, registry, workspaceId: WORKSPACE });
}

async function main(): Promise<void> {
  const runtime = createRuntime();
  const registry = new MCPRegistry();
  await loadPlugins(runtime, registry);
  const client = new MCPClient(registry);

  const [, , plugin, tool, rawParams] = process.argv;

  if (!plugin) {
    console.log('Registered MCP tools:\n');
    for (const { plugin: p, tool: t } of client.listTools()) {
      const flag = t.destructive ? ' [destructive → approval gate]' : '';
      console.log(`  ${p}.${t.name}${flag}\n      ${t.description}`);
    }
    console.log('\nInvoke:  npm run mcp:inspect <plugin> <tool> \'<json params>\'');
    return;
  }

  if (!tool) {
    console.error('error: provide a tool name to invoke');
    process.exitCode = 1;
    return;
  }

  const params = rawParams ? JSON.parse(rawParams) : {};
  // Inspector acts as an owner-level human so it can exercise any tool.
  const actor: Actor = { id: 'inspector', kind: 'human', workspaceId: WORKSPACE, role: 'owner' };
  const result = await client.invoke(plugin, tool, params, {
    actor,
    resourceWorkspaceId: WORKSPACE,
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
