/**
 * Agent definitions & permission types.
 *
 * Principle from the guide: agent permission minimisation. Agents declare an
 * explicit allow-list of tools (`<plugin>.<tool>`). Wildcards are forbidden —
 * the auth layer rejects any definition containing `*`.
 */

export type Role = 'viewer' | 'editor' | 'admin' | 'owner';

export type ActorKind = 'human' | 'agent';

export interface Actor {
  readonly id: string;
  readonly kind: ActorKind;
  readonly workspaceId: string;
  /** Human role (RBAC). Agents carry the role of their delegating principal. */
  readonly role: Role;
}

export interface AgentDefinition {
  readonly id: string;
  readonly name: string;
  readonly workspaceId: string;
  /**
   * Explicit allow-list of fully-qualified tool ids: `<plugin>.<tool>`.
   * No wildcards permitted.
   */
  readonly toolsAllowed: readonly string[];
  /** Maximum role the agent may act as on behalf of a principal. */
  readonly maxRole: Role;
}

export function qualifiedToolId(plugin: string, tool: string): string {
  return `${plugin}.${tool}`;
}

/** A definition is valid only if it has no wildcard entries. */
export function agentDefinitionIsValid(def: AgentDefinition): boolean {
  return def.toolsAllowed.every((t) => !t.includes('*'));
}
