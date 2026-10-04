/**
 * AiHarnessMCPServer — exposes the AI harness as MCP tools.
 * `run_sandbox` is declared destructive in the manifest, so BaseMCPServer routes
 * it through the approval gate automatically — no per-tool approval code here.
 * Every tool emits an `ai_action` contribution.
 */

import {
  BaseMCPServer,
  type ManifestMCPTool,
  type SdkRuntime,
  type WorkspaceCredentialHandle,
} from '@techit/plugin-sdk';
import type { AiHarnessApi } from './ai-api.js';

export class AiHarnessMCPServer extends BaseMCPServer {
  constructor(runtime: SdkRuntime, toolSpecs: ManifestMCPTool[], private readonly api: AiHarnessApi, creds?: WorkspaceCredentialHandle) {
    super('ai', runtime, toolSpecs, creds);

    this.handle(
      'generate_code',
      async (p) => this.api.generateCode(String(p.prompt), p.language ? String(p.language) : undefined),
      'ai_action',
    );

    this.handle(
      'review_code',
      async (p) =>
        this.api.reviewCode(
          String(p.code),
          p.language ? String(p.language) : undefined,
          p.context ? String(p.context) : undefined,
        ),
      'ai_action',
    );

    this.handle(
      'deep_research',
      async (p) => this.api.deepResearch(String(p.query), p.depth ? String(p.depth) : undefined),
      'ai_action',
    );

    this.handle(
      'run_sandbox',
      async (p) => this.api.runSandbox(String(p.language), String(p.code)),
      'ai_action',
    );
  }
}
