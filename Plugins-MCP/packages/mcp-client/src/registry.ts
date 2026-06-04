/**
 * MCP server registry.
 *
 * Plugins call `register(name, server)` from their index.ts. The registry
 * validates each `describeTools()` entry (non-empty name, description, object
 * input_schema, unique within the server) before indexing by plugin name.
 * Adding a tool = adding/registering an MCP server only.
 */

import type { BaseMCPServer, MCPTool } from '@techit/plugin-sdk';

export interface RegisteredServer {
  readonly name: string;
  readonly server: BaseMCPServer;
  readonly tools: readonly MCPTool[];
}

export class RegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegistryError';
  }
}

export class MCPRegistry {
  private readonly servers = new Map<string, RegisteredServer>();

  register(name: string, server: BaseMCPServer): void {
    if (this.servers.has(name)) {
      throw new RegistryError(`plugin '${name}' is already registered`);
    }
    const tools = server.describeTools();
    validateTools(name, tools);
    this.servers.set(name, { name, server, tools });
  }

  get(name: string): RegisteredServer | undefined {
    return this.servers.get(name);
  }

  list(): RegisteredServer[] {
    return [...this.servers.values()];
  }

  /** Flattened catalogue of `<plugin>.<tool>` for the inspector & agent runtime. */
  catalogue(): { plugin: string; tool: MCPTool }[] {
    return this.list().flatMap((s) => s.tools.map((tool) => ({ plugin: s.name, tool })));
  }
}

function validateTools(plugin: string, tools: readonly MCPTool[]): void {
  const seen = new Set<string>();
  for (const t of tools) {
    if (!t.name) throw new RegistryError(`${plugin}: a tool is missing 'name'`);
    if (!t.description) throw new RegistryError(`${plugin}.${t.name}: missing 'description'`);
    if (typeof t.input_schema !== 'object' || t.input_schema === null) {
      throw new RegistryError(`${plugin}.${t.name}: 'input_schema' must be an object`);
    }
    if (seen.has(t.name)) throw new RegistryError(`${plugin}: duplicate tool '${t.name}'`);
    seen.add(t.name);
  }
}
