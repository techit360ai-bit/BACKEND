/**
 * Artifact model — the unit of execution context in TechIT.
 *
 * Every external resource a connector links (a repo, a Figma file, a Notion page)
 * becomes an Artifact so that PRs, design changes, meetings and AI actions can all
 * point at the same canonical object. Versioning is monotonic per artifact.
 */

export type ArtifactType =
  | 'code'
  | 'design'
  | 'document'
  | 'workflow'
  | 'dataset'
  | 'contract' // smart contract / web3
  | 'meeting';

export interface Artifact {
  /** Stable internal id (`<source_tool>:<external_id>`). */
  readonly id: string;
  readonly type: ArtifactType;
  /** Originating connector, e.g. 'github', 'figma', 'notion'. */
  readonly sourceTool: string;
  /** Id of the resource in the external system. */
  readonly externalId: string;
  readonly title: string;
  /** Workspace/project this artifact belongs to (isolation boundary). */
  readonly workspaceId: string;
  readonly projectId?: string;
  /** Monotonic version, bumped on every recorded change. */
  readonly version: number;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateArtifactInput {
  type: ArtifactType;
  sourceTool: string;
  externalId: string;
  title: string;
  workspaceId: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
}

function now(): string {
  return new Date().toISOString();
}

export function artifactId(sourceTool: string, externalId: string): string {
  return `${sourceTool}:${externalId}`;
}

export function createArtifact(input: CreateArtifactInput): Artifact {
  const ts = now();
  return {
    id: artifactId(input.sourceTool, input.externalId),
    type: input.type,
    sourceTool: input.sourceTool,
    externalId: input.externalId,
    title: input.title,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    version: 1,
    metadata: input.metadata ?? {},
    createdAt: ts,
    updatedAt: ts,
  };
}

/** Returns a new Artifact with version bumped and metadata merged. */
export function bumpArtifactVersion(
  artifact: Artifact,
  changes: { title?: string; metadata?: Record<string, unknown> } = {},
): Artifact {
  return {
    ...artifact,
    title: changes.title ?? artifact.title,
    version: artifact.version + 1,
    metadata: { ...artifact.metadata, ...(changes.metadata ?? {}) },
    updatedAt: now(),
  };
}
