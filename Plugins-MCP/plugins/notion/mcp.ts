/**
 * NotionMCPServer — exposes Notion capabilities as MCP tools.
 * Destructive tools (create_page, append_blocks) are declared destructive in the
 * manifest, so BaseMCPServer routes them through the approval gate automatically.
 */

import {
  BaseMCPServer,
  type ManifestMCPTool,
  type SdkRuntime,
} from '@techit/plugin-sdk';
import type { NotionApi, NotionBlock } from './notion-api.js';

export class NotionMCPServer extends BaseMCPServer {
  constructor(runtime: SdkRuntime, toolSpecs: ManifestMCPTool[], private readonly api: NotionApi) {
    super('notion', runtime, toolSpecs);

    this.handle('search', async (p) => this.api.search(p.query ? String(p.query) : undefined));

    this.handle('get_page', async (p) => this.api.getPage(String(p.page_id)));

    this.handle(
      'create_page',
      async (p) =>
        this.api.createPage({
          parentId: String(p.parent_id),
          title: String(p.title),
          content: p.content ? String(p.content) : undefined,
        }),
      'document_update',
    );

    this.handle(
      'append_blocks',
      async (p) => this.api.appendBlocks(String(p.page_id), (p.blocks as NotionBlock[]) ?? []),
      'document_update',
    );
  }
}
