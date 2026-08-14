/**
 * NotionConnector — implements the Connector contract via BaseConnector hooks.
 * All audit/permission/approval/contribution plumbing is inherited; this file
 * only contains Notion domain logic + the per-action policy.
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
import type { NotionApi, NotionBlock } from './notion-api.js';
import { resolveToken } from './auth.js';

export class NotionConnector extends BaseConnector {
  constructor(
    runtime: SdkRuntime,
    private readonly secrets: ScopedSecrets,
    private readonly api: NotionApi,
    private readonly workspaceId: string,
  ) {
    super('notion', runtime);
  }

  protected override authenticateImpl(): Promise<AuthToken> {
    return resolveToken(this.secrets);
  }

  protected override async listResourcesImpl(): Promise<Resource[]> {
    const results = await this.api.search();
    return results.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      data: { url: r.url },
    }));
  }

  protected override async readResourceImpl(id: string): Promise<Resource> {
    const { page } = await this.api.getPage(id);
    return { id, type: 'page', title: page.title, data: { url: page.url } };
  }

  protected override async writeResourceImpl(): Promise<void> {
    throw new Error('notion: writeResource is not supported; use executeAction');
  }

  protected override async executeActionImpl(action: string, params: unknown): Promise<Result> {
    const p = (params ?? {}) as Record<string, unknown>;
    switch (action) {
      case 'create_page': {
        const page = await this.api.createPage({
          parentId: String(p.parent_id),
          title: String(p.title),
          content: p.content ? String(p.content) : undefined,
        });
        return ok(page);
      }
      case 'append_blocks': {
        const blocks = Array.isArray(p.blocks) ? (p.blocks as NotionBlock[]) : [];
        const res = await this.api.appendBlocks(String(p.page_id), blocks);
        return ok(res);
      }
      default:
        throw new Error(`notion: unknown action ${action}`);
    }
  }

  protected override policyFor(action: string): ActionPolicy {
    switch (action) {
      case 'create_page':
        return { requiredRole: 'editor', destructive: true, contribution: 'document_update' };
      case 'append_blocks':
        return { requiredRole: 'editor', destructive: true, contribution: 'document_update' };
      default:
        return { requiredRole: 'editor', destructive: false };
    }
  }

  /** Link a Notion page as a TechIT artifact (type='document'). */
  linkPageArtifact(pageId: string, title: string): Artifact {
    return createArtifact({
      type: 'document',
      sourceTool: 'notion',
      externalId: pageId,
      title,
      workspaceId: this.workspaceId,
      metadata: { artifactId: artifactId('notion', pageId) },
    });
  }
}
