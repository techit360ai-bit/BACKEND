/**
 * Parse + validate a `techit.plugin.yaml`. Fails fast with a readable error
 * listing exactly which required fields are missing or malformed.
 */

import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { PluginManifestSchema, type PluginManifest } from './schema.js';

export class ManifestError extends Error {
  constructor(
    message: string,
    readonly issues: string[],
  ) {
    super(message);
    this.name = 'ManifestError';
  }
}

export function parseManifest(raw: string): PluginManifest {
  let doc: unknown;
  try {
    doc = parseYaml(raw);
  } catch (e) {
    throw new ManifestError('manifest is not valid YAML', [(e as Error).message]);
  }

  const result = PluginManifestSchema.safeParse(doc);
  if (!result.success) {
    const issues = result.error.issues.map(
      (i) => `${i.path.join('.') || '(root)'}: ${i.message}`,
    );
    throw new ManifestError('invalid techit.plugin.yaml', issues);
  }
  return result.data;
}

export function loadManifest(path: string): PluginManifest {
  const raw = readFileSync(path, 'utf8');
  return parseManifest(raw);
}
