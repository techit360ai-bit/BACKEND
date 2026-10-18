import { describe, it, expect } from 'vitest';
import { parseManifest, ManifestError } from '@techit/plugin-sdk';

const VALID = `
name: demo
version: 0.1.0
displayName: Demo
auth: { kind: api_key }
capabilities: { read: true }
resources:
  - type: thing
mcp: { enabled: true }
`;

describe('Strategy 1 — manifest validation', () => {
  it('accepts a well-formed manifest', () => {
    const m = parseManifest(VALID);
    expect(m.name).toBe('demo');
    expect(m.resources).toHaveLength(1);
  });

  it('accepts organization training and software resource metadata', () => {
    const extended = VALID.replace(
      '  - type: thing',
      '  - type: course\n    resourceKind: training\n    externalId: partner-course-1\n    audiencePolicy: public_free\n    completionMode: webhook\n    completionEvent: training.completed\n    expiresAt: 2027-01-01T00:00:00.000Z',
    );
    const m = parseManifest(extended);
    expect(m.resources[0].resourceKind).toBe('training');
    expect(m.resources[0].completionMode).toBe('webhook');
  });

  it('rejects a manifest missing auth', () => {
    const bad = VALID.replace('auth: { kind: api_key }', '');
    expect(() => parseManifest(bad)).toThrow(ManifestError);
  });

  it('rejects a manifest with no resources', () => {
    const bad = VALID.replace(/resources:\n  - type: thing/, 'resources: []');
    try {
      parseManifest(bad);
      throw new Error('expected parseManifest to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(ManifestError);
      expect((e as ManifestError).issues.join('\n')).toMatch(/at least one resource/);
    }
  });

  it('rejects a manifest missing mcp', () => {
    const bad = VALID.replace('mcp: { enabled: true }', '');
    expect(() => parseManifest(bad)).toThrow(ManifestError);
  });

  it('rejects a non-kebab-case name', () => {
    const bad = VALID.replace('name: demo', 'name: Demo_Plugin');
    expect(() => parseManifest(bad)).toThrow(ManifestError);
  });
});
