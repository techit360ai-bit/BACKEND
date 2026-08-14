/**
 * FigmaConnector — implements the Connector contract via BaseConnector hooks.
 * All audit/permission/approval/contribution plumbing is inherited; this file
 * only contains Figma domain logic + the per-action policy.
 */

import { artifactId, createArtifact, type Artifact } from '@techit/core';
import {
  BaseConnector,
  type ActionPolicy,
  type AuthToken,
  type Resource,
  type Result,
  type SdkRuntime,
  ok,
} from '@techit/plugin-sdk';
import type { ScopedSecrets } from '@techit/infra-secrets';
import type { FigmaApi } from './figma-api.js';
import { resolveToken } from './auth.js';

export class FigmaConnector extends BaseConnector {
  constructor(
    runtime: SdkRuntime,
    private readonly secrets: ScopedSecrets,
    private readonly api: FigmaApi,
    private readonly workspaceId: string,
  ) {
    super('figma', runtime);
  }

  protected override authenticateImpl(): Promise<AuthToken> {
    return resolveToken(this.secrets);
  }

  protected override async listResourcesImpl(): Promise<Resource[]> {
    // Figma has no "list all files" endpoint without a project id; expose the
    // seed/known file as a single resource for the MVP.
    return [];
  }

  protected override async readResourceImpl(id: string): Promise<Resource> {
    const file = await this.api.getFile(id);
    return { id, type: 'file', title: file.name, data: { lastModified: file.lastModified, pages: file.pages } };
  }

  protected override async writeResourceImpl(): Promise<void> {
    throw new Error('figma: writeResource is not supported; use executeAction');
  }

  protected override async executeActionImpl(action: string, params: unknown): Promise<Result> {
    const p = (params ?? {}) as Record<string, unknown>;
    switch (action) {
      case 'post_comment': {
        const comment = await this.api.postComment(
          String(p.file_key),
          String(p.message),
          p.node_id ? String(p.node_id) : undefined,
        );
        return ok(comment);
      }
      default:
        throw new Error(`figma: unknown action ${action}`);
    }
  }

  protected override policyFor(action: string): ActionPolicy {
    switch (action) {
      case 'post_comment':
        return { requiredRole: 'editor', destructive: true, contribution: 'design_update' };
      default:
        return { requiredRole: 'editor', destructive: false };
    }
  }

  /** Link a Figma file as a TechIT artifact (type='design'). */
  linkFileArtifact(fileKey: string, name: string): Artifact {
    return createArtifact({
      type: 'design',
      sourceTool: 'figma',
      externalId: fileKey,
      title: name,
      workspaceId: this.workspaceId,
      metadata: { artifactId: artifactId('figma', fileKey) },
    });
  }
}
