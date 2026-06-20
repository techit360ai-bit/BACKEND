/**
 * Contribution / execution-intelligence events.
 *
 * Emitted after any successful trackable action so the dashboard can measure
 * velocity by tool, project and actor without manual reporting.
 */

export type ContributionKind =
  | 'code_commit'
  | 'pull_request'
  | 'design_update'
  | 'document_update'
  | 'workflow_run'
  | 'review'
  | 'meeting'
  | 'ai_action';

export interface ContributionEvent {
  readonly id: string;
  readonly kind: ContributionKind;
  readonly actorId: string;
  readonly actorKind: 'human' | 'agent';
  readonly sourceTool: string;
  readonly workspaceId: string;
  readonly projectId?: string;
  readonly artifactId?: string;
  readonly weight: number;
  readonly metadata: Record<string, unknown>;
  readonly timestamp: string;
}

export interface ContributionInput {
  kind: ContributionKind;
  actorId: string;
  actorKind: 'human' | 'agent';
  sourceTool: string;
  workspaceId: string;
  projectId?: string;
  artifactId?: string;
  weight?: number;
  metadata?: Record<string, unknown>;
}

let seq = 0;

export function makeContributionEvent(input: ContributionInput): ContributionEvent {
  seq += 1;
  return {
    id: `contrib-${Date.now()}-${seq}`,
    kind: input.kind,
    actorId: input.actorId,
    actorKind: input.actorKind,
    sourceTool: input.sourceTool,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    artifactId: input.artifactId,
    weight: input.weight ?? 1,
    metadata: input.metadata ?? {},
    timestamp: new Date().toISOString(),
  };
}

/** Sink that contribution events are pushed to (dashboard, event bus, ...). */
export interface ContributionSink {
  emit(event: ContributionEvent): void | Promise<void>;
}

/** Default in-memory sink; production wires this to the event bus. */
export class InMemoryContributionSink implements ContributionSink {
  readonly events: ContributionEvent[] = [];
  emit(event: ContributionEvent): void {
    this.events.push(event);
  }
}
