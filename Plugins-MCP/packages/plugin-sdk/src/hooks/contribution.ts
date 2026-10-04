/** Emits a contribution event after a successful trackable action. */

import { makeContributionEvent, type ContributionKind } from '@techit/core';
import type { CallContext, IncubationContext } from '../contract/types.js';
import type { SdkRuntime } from '../runtime.js';

/** Drop undefined fields so attribution metadata stays clean and JSON-stable. */
function compact<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/**
 * The incubation coordinates to stamp onto a contribution event. Returns
 * undefined when there is nothing to attribute, so the event keeps its exact
 * previous shape for callers that run without a project context.
 */
export function incubationMetadata(incubation: IncubationContext | undefined): Record<string, unknown> | undefined {
  if (!incubation) return undefined;
  const clean = compact(incubation);
  return Object.keys(clean).length > 0 ? clean : undefined;
}

export async function emitContribution(
  runtime: SdkRuntime,
  ctx: CallContext,
  sourceTool: string,
  kind: ContributionKind,
  opts: { projectId?: string; artifactId?: string; weight?: number; metadata?: Record<string, unknown> } = {},
): Promise<void> {
  // WS-H: attribute the event to the incubation project so the hub (and every
  // downstream consumer: investor / organization / hackathon) reads one stream.
  const incubation = incubationMetadata(ctx.incubation);
  const event = makeContributionEvent({
    kind,
    actorId: ctx.actor.id,
    actorKind: ctx.actor.kind,
    sourceTool,
    workspaceId: ctx.actor.workspaceId,
    projectId: opts.projectId ?? ctx.incubation?.projectId,
    artifactId: opts.artifactId,
    weight: opts.weight,
    metadata: incubation ? { ...(opts.metadata ?? {}), incubation } : opts.metadata,
  });
  await runtime.contributions.emit(event);
}
