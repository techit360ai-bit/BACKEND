/**
 * The MCPAdapter contract (frozen — from the guide).
 *
 * Implemented by extending `BaseMCPServer`. `invoke()` never throws — all
 * outcomes are structured `Result`s.
 */

import type { MCPTool, Result } from './types.js';

export interface MCPAdapter {
  describeTools(): MCPTool[];
  invoke(tool: string, params: unknown): Promise<Result>;
}
