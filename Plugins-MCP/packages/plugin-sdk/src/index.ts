// Contract
export * from './contract/types.js';
export type { Connector } from './contract/connector.js';
export type { MCPAdapter } from './contract/mcp-adapter.js';

// Manifest
export * from './manifest/schema.js';
export * from './manifest/load.js';

// Base classes
export * from './base/base-plugin.js';
export * from './base/base-connector.js';
export * from './base/base-mcp-server.js';

// Hooks (exported for advanced use / testing)
export { recordAudit } from './hooks/audit.js';
export { checkPermission } from './hooks/permission.js';
export { requestApproval, isApproved } from './hooks/approval.js';
export { emitContribution } from './hooks/contribution.js';

// Runtime
export * from './runtime.js';
