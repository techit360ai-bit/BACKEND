/**
 * GitHub webhook parser → normalized TechIT events.
 *
 * The event bus is transport-agnostic: a webhook (here) and a poller (other
 * connectors) emit the SAME `TechitEvent` shape, so downstream consumers never
 * care how the event arrived.
 */

export interface TechitEvent {
  sourceTool: 'github';
  type: 'push' | 'pull_request' | 'workflow_run' | 'issues';
  externalId: string;
  action?: string;
  payload: Record<string, unknown>;
  receivedAt: string;
}

export class WebhookError extends Error {}

const SUPPORTED = new Set(['push', 'pull_request', 'workflow_run', 'issues']);

/** Parse a raw GitHub webhook (header event name + JSON body) into a TechitEvent. */
export function parseWebhook(eventName: string, body: Record<string, unknown>): TechitEvent {
  if (!SUPPORTED.has(eventName)) {
    throw new WebhookError(`unsupported github event: ${eventName}`);
  }
  const externalId = deriveExternalId(eventName, body);
  return {
    sourceTool: 'github',
    type: eventName as TechitEvent['type'],
    externalId,
    action: typeof body.action === 'string' ? body.action : undefined,
    payload: body,
    receivedAt: new Date().toISOString(),
  };
}

function deriveExternalId(eventName: string, body: Record<string, unknown>): string {
  const repo = (body.repository as { id?: number } | undefined)?.id;
  switch (eventName) {
    case 'pull_request':
      return `pr-${(body.pull_request as { number?: number } | undefined)?.number ?? '?'}`;
    case 'issues':
      return `issue-${(body.issue as { number?: number } | undefined)?.number ?? '?'}`;
    case 'workflow_run':
      return `run-${(body.workflow_run as { id?: number } | undefined)?.id ?? '?'}`;
    case 'push':
    default:
      return `repo-${repo ?? '?'}`;
  }
}
