/**
 * Minimal Figma API surface used by the connector + MCP server.
 *
 * `FigmaApi` is what production wires to `https://api.figma.com/v1` (via fetch +
 * the personal access token in the `X-Figma-Token` header). `FakeFigmaApi` is an
 * in-memory implementation for local/dev/tests + sandbox demos.
 */

export interface FigmaFrame {
  id: string;
  name: string;
}

export interface FigmaPage {
  id: string;
  name: string;
  frames: FigmaFrame[];
}

export interface FigmaFileInfo {
  key: string;
  name: string;
  lastModified: string;
  pages: FigmaPage[];
}

export interface FigmaComment {
  id: string;
  message: string;
  user: string;
  createdAt: string;
  nodeId?: string;
}

export interface FigmaApi {
  getFile(fileKey: string): Promise<FigmaFileInfo>;
  exportFrame(fileKey: string, nodeId: string): Promise<{ nodeId: string; imageUrl: string }>;
  listComments(fileKey: string): Promise<FigmaComment[]>;
  postComment(fileKey: string, message: string, nodeId?: string): Promise<FigmaComment>;
}

/** Deterministic in-memory Figma. Default for local/dev/tests + sandbox demos. */
export class FakeFigmaApi implements FigmaApi {
  private commentSeq = 300;
  readonly created: { comments: FigmaComment[] } = { comments: [] };

  async getFile(fileKey: string): Promise<FigmaFileInfo> {
    return {
      key: fileKey,
      name: 'Founder Dashboard',
      lastModified: '2026-08-01T10:00:00.000Z',
      pages: [
        {
          id: '0:1',
          name: 'Onboarding',
          frames: [
            { id: '1:2', name: 'Welcome' },
            { id: '1:3', name: 'Connect Wallet' },
          ],
        },
      ],
    };
  }

  async exportFrame(fileKey: string, nodeId: string): Promise<{ nodeId: string; imageUrl: string }> {
    return { nodeId, imageUrl: `https://figma-export.local/${fileKey}/${encodeURIComponent(nodeId)}.png` };
  }

  async listComments(_fileKey: string): Promise<FigmaComment[]> {
    return [
      { id: 'c-1', message: 'Improve onboarding completion', user: 'design-lead', createdAt: '2026-08-02T09:00:00.000Z' },
      ...this.created.comments,
    ];
  }

  async postComment(_fileKey: string, message: string, nodeId?: string): Promise<FigmaComment> {
    this.commentSeq += 1;
    const comment: FigmaComment = {
      id: `c-${this.commentSeq}`,
      message,
      user: 'you',
      createdAt: new Date().toISOString(),
      nodeId,
    };
    this.created.comments.push(comment);
    return comment;
  }
}

/** Real Figma API over global fetch. Selected when a PAT is present. */
export class RealFigmaApi implements FigmaApi {
  private static readonly BASE = 'https://api.figma.com/v1';

  constructor(private readonly token: string | (() => Promise<string>)) {}

  private async headerToken(): Promise<string> {
    return typeof this.token === 'function' ? await this.token() : this.token;
  }

  private async request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
    const res = await fetch(`${RealFigmaApi.BASE}${path}`, {
      method: init?.method ?? 'GET',
      headers: {
        'X-Figma-Token': await this.headerToken(),
        'Content-Type': 'application/json',
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`figma api ${res.status}: ${detail.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  }

  async getFile(fileKey: string): Promise<FigmaFileInfo> {
    const data = await this.request<{
      name: string;
      lastModified: string;
      document: { children?: { id: string; name: string; children?: { id: string; name: string }[] }[] };
    }>(`/files/${fileKey}?depth=2`);
    const pages: FigmaPage[] = (data.document.children ?? []).map((pg) => ({
      id: pg.id,
      name: pg.name,
      frames: (pg.children ?? []).map((f) => ({ id: f.id, name: f.name })),
    }));
    return { key: fileKey, name: data.name, lastModified: data.lastModified, pages };
  }

  async exportFrame(fileKey: string, nodeId: string): Promise<{ nodeId: string; imageUrl: string }> {
    const data = await this.request<{ images: Record<string, string> }>(
      `/images/${fileKey}?ids=${encodeURIComponent(nodeId)}&format=png`,
    );
    return { nodeId, imageUrl: data.images[nodeId] ?? '' };
  }

  async listComments(fileKey: string): Promise<FigmaComment[]> {
    const data = await this.request<{
      comments: { id: string; message: string; user?: { handle?: string }; created_at: string; client_meta?: { node_id?: string } }[];
    }>(`/files/${fileKey}/comments`);
    return (data.comments ?? []).map((c) => ({
      id: c.id,
      message: c.message,
      user: c.user?.handle ?? 'unknown',
      createdAt: c.created_at,
      nodeId: c.client_meta?.node_id,
    }));
  }

  async postComment(fileKey: string, message: string, nodeId?: string): Promise<FigmaComment> {
    const body: Record<string, unknown> = { message };
    if (nodeId) body.client_meta = { node_id: nodeId };
    const c = await this.request<{ id: string; message: string; user?: { handle?: string }; created_at: string }>(
      `/files/${fileKey}/comments`,
      { method: 'POST', body },
    );
    return { id: c.id, message: c.message, user: c.user?.handle ?? 'you', createdAt: c.created_at, nodeId };
  }
}
