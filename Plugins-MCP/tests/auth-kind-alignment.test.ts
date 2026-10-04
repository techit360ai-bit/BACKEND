/**
 * Drift guard (report F6): a manifest's `auth.kind` must agree with the
 * credential descriptor the connect API uses. When they disagree, anyone
 * building a generic "Connect" UI from the manifest is misled.
 */

import { describe, expect, test } from 'vitest';
import { fileURLToPath } from 'node:url';
import { loadManifest } from '@techit/plugin-sdk';
import { CONNECTOR_CREDENTIALS } from '../server/techit-service.js';

const MANIFESTS: Record<string, string> = {
  github: '../plugins/github/techit.plugin.yaml',
  notion: '../plugins/notion/techit.plugin.yaml',
  figma: '../plugins/figma/techit.plugin.yaml',
  web3: '../plugins/web3/techit.plugin.yaml',
  ai: '../plugins/ai/techit.plugin.yaml',
  gitlab: '../plugins/git-host/gitlab.plugin.yaml',
  bitbucket: '../plugins/git-host/bitbucket.plugin.yaml',
};

const EXPECTED: Record<string, string> = {
  oauth_token: 'oauth2',
  api_key: 'api_key',
  rpc_url: 'rpc_url',
};

describe('manifest auth.kind ↔ credential descriptor', () => {
  for (const [connector, rel] of Object.entries(MANIFESTS)) {
    test(`${connector} declares the same auth kind as its descriptor`, () => {
      const manifest = loadManifest(fileURLToPath(new URL(rel, import.meta.url)));
      const credentialKind = CONNECTOR_CREDENTIALS[connector as keyof typeof CONNECTOR_CREDENTIALS].kind;
      expect(manifest.auth.kind).toBe(EXPECTED[credentialKind]);
    });
  }
});
