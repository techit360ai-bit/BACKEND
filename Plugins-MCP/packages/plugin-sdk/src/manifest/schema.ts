/**
 * Zod schema for `techit.plugin.yaml`.
 *
 * A manifest missing `auth`, `capabilities`, `resources`, or `mcp` is rejected
 * at load time — the plugin refuses to register.
 */

import { z } from 'zod';

/**
 * Auth taxonomy — kept in lockstep with the credential descriptors in
 * `server/techit-service.ts`. `rpc_url` was added because web3 uses a provider
 * URL, not an API key, and `none` marks connectors that work with no credential
 * at all. Drift between a manifest and the credential descriptor is a bug: it
 * misleads a generic "Connect" UI (report F6).
 */
export const AuthKind = z.enum(['oauth2', 'api_key', 'rpc_url', 'none']);

export const AuthSpec = z.object({
  kind: AuthKind,
  scopes: z.array(z.string()).default([]),
});

export const CapabilitySpec = z.object({
  read: z.boolean().default(false),
  write: z.boolean().default(false),
  execute: z.boolean().default(false),
});

export const ResourceSpec = z.object({
  type: z.string().min(1),
  /** Maps a TechIT artifact type for linkage. */
  artifactType: z
    .enum(['code', 'design', 'document', 'workflow', 'dataset', 'contract', 'meeting'])
    .optional(),
});

export const EventSpec = z.object({
  /** How events arrive: native webhooks or a polling fallback. */
  transport: z.enum(['webhook', 'poller']),
  /** For pollers: interval in seconds. */
  pollIntervalSeconds: z.number().int().positive().optional(),
  types: z.array(z.string()).default([]),
});

export const MCPToolSpec = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  input_schema: z.record(z.string(), z.unknown()).default({}),
  destructive: z.boolean().default(false),
  /** Minimum human role required to invoke. */
  requiredRole: z.enum(['viewer', 'editor', 'admin', 'owner']).default('editor'),
});

export const MCPSpec = z.object({
  enabled: z.boolean(),
  tools: z.array(MCPToolSpec).default([]),
});

export const PluginManifestSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'name must be kebab-case, no slashes'),
  version: z.string().min(1),
  displayName: z.string().min(1),
  auth: AuthSpec,
  capabilities: CapabilitySpec,
  resources: z.array(ResourceSpec).min(1, 'at least one resource required'),
  events: EventSpec.optional(),
  mcp: MCPSpec,
});

export type PluginManifest = z.infer<typeof PluginManifestSchema>;
export type ManifestMCPTool = z.infer<typeof MCPToolSpec>;
