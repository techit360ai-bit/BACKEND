/** Emits a contribution event after a successful trackable action. */

import { makeContributionEvent, type ContributionKind } from '@techit/core';
import type { CallContext } from '../contract/types.js';
import type { SdkRuntime } from '../runtime.js';

export async function emitContribution(
  runtime: SdkRuntime,
  ctx: CallContext,
  sourceTool: string,
  kind: ContributionKind,
  opts: { artifactId?: string; weight?: number; metadata?: Record<string, unknown> } = {},
): Promise<void> {
  const event = makeContributionEvent({
    kind,
    actorId: ctx.actor.id,
    actorKind: ctx.actor.kind,
    sourceTool,
    workspaceId: ctx.actor.workspaceId,
    artifactId: opts.artifactId,
    weight: opts.weight,
    metadata: opts.metadata,
  });
  await runtime.contributions.emit(event);
}
