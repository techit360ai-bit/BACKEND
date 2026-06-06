// Domain model for the Workspace MCP/plugin/SDK layer.
// Mirrors the backend Plugin Contract (see docs/techit-integration-guide.md).

// --- Connectors / MCP ---
export type ConnectorId = 'github' | 'figma' | 'notion' | 'ml' | 'web3';
export type Capability = 'read' | 'write' | 'execute';
export type ConnectorStatus = 'connected' | 'disconnected' | 'error' | 'pending';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, { type: string; required?: boolean }>;
  destructive?: boolean;
}

export interface Connector {
  id: ConnectorId;
  name: string;
  category: string;
  status: ConnectorStatus;
  authType: 'oauth2' | 'api_key' | 'service_account';
  capabilities: Capability[];
  tools: MCPTool[];
  resources: string[];
  deepLink?: string;
  lastSync?: string;
}

export interface ActivityEvent {
  id: string;
  connectorId: ConnectorId;
  kind: 'webhook' | 'agent_action' | 'sync' | 'approval';
  summary: string;
  at: string;
}

// --- Artifacts ---
export type ArtifactType = 'code' | 'design' | 'doc' | 'model';
export interface Artifact {
  id: string;
  type: ArtifactType;
  sourceTool: ConnectorId;
  externalId: string;
  version: number;
}

// --- Agents / Console ---
export type AgentTaskStatus =
  | 'queued' | 'running' | 'needs_approval' | 'done' | 'failed' | 'cancelled';

export type TaskEventType =
  | 'message' | 'tool_call' | 'tool_result'
  | 'approval_request' | 'approval_resolved' | 'error' | 'status';

export interface ApprovalRequest {
  id: string;
  action: string;
  connectorId: ConnectorId;
  summary: string;
  resolved?: 'approved' | 'rejected';
}

export interface TaskEvent {
  id: string;
  type: TaskEventType;
  at: string;
  text?: string;
  tool?: { connectorId: ConnectorId; name: string; params: unknown };
  result?: { ok: boolean; detail: unknown };
  approval?: ApprovalRequest;
}

export interface AgentTask {
  id: string;
  agentId: string;
  prompt: string;
  status: AgentTaskStatus;
  createdAt: string;
  events: TaskEvent[];
}
