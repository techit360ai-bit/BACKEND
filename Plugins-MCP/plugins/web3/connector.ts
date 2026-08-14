/**
 * Web3Connector — read-only EVM (Sepolia) connector via BaseConnector hooks.
 * No destructive actions (testnet reads + SIWE verification only), so it is
 * safe to demo live. All audit/permission plumbing is inherited.
 */

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
import type { Web3Api } from './web3-api.js';
import { resolveToken } from './auth.js';

export class Web3Connector extends BaseConnector {
  constructor(
    runtime: SdkRuntime,
    private readonly secrets: ScopedSecrets,
    private readonly api: Web3Api,
    private readonly workspaceId: string,
  ) {
    super('web3', runtime);
  }

  protected override authenticateImpl(): Promise<AuthToken> {
    return resolveToken(this.secrets);
  }

  protected override async listResourcesImpl(): Promise<Resource[]> {
    return [];
  }

  protected override async readResourceImpl(id: string): Promise<Resource> {
    const balance = await this.api.getBalance(id);
    return { id, type: 'address', title: id, data: { ...balance } };
  }

  protected override async writeResourceImpl(): Promise<void> {
    throw new Error('web3: writeResource is not supported (read-only connector)');
  }

  protected override async executeActionImpl(action: string): Promise<Result> {
    throw new Error(`web3: unknown action ${action}`);
  }

  protected override policyFor(): ActionPolicy {
    return { requiredRole: 'viewer', destructive: false };
  }

  workspaceScope(): string {
    return this.workspaceId;
  }
}
