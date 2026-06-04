/**
 * The Connector contract (frozen — from the guide).
 *
 * Connector authors do NOT implement this directly; they extend `BaseConnector`,
 * which wraps each method with audit + permission + approval + contribution
 * plumbing and delegates to the protected `*Impl` hooks.
 */

import type { AuthToken, Resource, Result } from './types.js';

export interface Connector {
  authenticate(): Promise<AuthToken>;
  listResources(): Promise<Resource[]>;
  readResource(id: string): Promise<Resource>;
  writeResource(id: string, payload: unknown): Promise<void>;
  executeAction(action: string, params: unknown): Promise<Result>;
}
