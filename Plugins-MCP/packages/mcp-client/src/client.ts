/**
 * MCP protocol client.
 *
 * The agent runtime IS the MCP client. It calls `client.invoke(plugin, tool,
 * params, ctx)`; the client looks up the server, binds the call context, and
 * delegates to the adapter — whose BaseMCPServer enforces permission/approval/
 * audit. Routing here stays thin so the guarantees live in one place (the SDK).
 */

import type { CallContext, Result } from '@techit/plugin-sdk';
import { err } from '@techit/plugin-sdk';
import type { MCPRegistry } from './registry.js';

export class MCPClient {
  constructor(private readonly registry: MCPRegistry) {}

  async invoke(
    plugin: string,
    tool: string,
    params: unknown,
    ctx: CallContext,
  ): Promise<Result> {
    const entry = this.registry.get(plugin);
    if (!entry) {
      return err('not_found', `no registered plugin: ${plugin}`);
    }
    return entry.server.bind(ctx).invoke(tool, params);
  }

  /** List every tool available to the runtime, flattened. */
  listTools() {
    return this.registry.catalogue();
  }
}
