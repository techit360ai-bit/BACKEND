/**
 * FigmaMCPServer — exposes Figma capabilities as MCP tools.
 * post_comment is declared destructive in the manifest, so BaseMCPServer routes
 * it through the approval gate automatically.
 */

import {
  BaseMCPServer,
  type ManifestMCPTool,
  type SdkRuntime,
} from '@techit/plugin-sdk';
import type { FigmaApi } from './figma-api.js';

export class FigmaMCPServer extends BaseMCPServer {
  constructor(runtime: SdkRuntime, toolSpecs: ManifestMCPTool[], private readonly api: FigmaApi) {
    super('figma', runtime, toolSpecs);

    this.handle('get_file', async (p) => this.api.getFile(String(p.file_key)));

    this.handle('export_frame', async (p) => this.api.exportFrame(String(p.file_key), String(p.node_id)));

    this.handle('list_comments', async (p) => this.api.listComments(String(p.file_key)));

    this.handle(
      'post_comment',
      async (p) =>
        this.api.postComment(String(p.file_key), String(p.message), p.node_id ? String(p.node_id) : undefined),
      'design_update',
    );
  }
}
