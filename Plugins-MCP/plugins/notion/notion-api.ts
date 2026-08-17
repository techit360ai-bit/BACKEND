/**
 * Minimal Notion API surface used by the connector + MCP server.
 *
 * `NotionApi` is what production wires to `https://api.notion.com/v1` (via fetch
 * + the integration token). `FakeNotionApi` is an in-memory implementation so
 * the connector and its tests run without network access. `RealNotionApi` is
 * selected at registration time when a token is present (hybrid execution).
 */

export interface NotionPage {
  id: string;
  title: string;
  url: string;
}

export interface NotionSearchResult {
  id: string;
  type: 'page' | 'database';
  title: string;
  url: string;
}

export interface NotionBlock {
  type: string;
  text: string;
}

export interface NotionApi {
  search(query?: string): Promise<NotionSearchResult[]>;
  getPage(pageId: string): Promise<{ page: NotionPage; blocks: NotionBlock[] }>;
  createPage(input: { parentId: string; title: string; content?: string }): Promise<NotionPage>;
  appendBlocks(pageId: string, blocks: NotionBlock[]): Promise<{ appended: number }>;
}

/** Deterministic in-memory Notion. Default for local/dev/tests + sandbox demos. */
export class FakeNotionApi implements NotionApi {
  private pageSeq = 200;
  readonly created: { pages: NotionPage[]; appended: { pageId: string; blocks: NotionBlock[] }[] } = {
    pages: [],
    appended: [],
  };

  private readonly seed: NotionSearchResult[] = [
    { id: 'page-welcome', type: 'page', title: 'Welcome to AgroChain AI', url: 'https://notion.so/page-welcome' },
    { id: 'db-roadmap', type: 'database', title: 'Product Roadmap', url: 'https://notion.so/db-roadmap' },
  ];

  async search(query?: string): Promise<NotionSearchResult[]> {
    if (!query) return this.seed.slice();
    const q = query.toLowerCase();
    return this.seed.filter((r) => r.title.toLowerCase().includes(q));
  }

  async getPage(pageId: string): Promise<{ page: NotionPage; blocks: NotionBlock[] }> {
    const found = this.seed.find((r) => r.id === pageId) ?? this.created.pages.find((p) => p.id === pageId);
    const title = found?.title ?? 'Untitled';
    const url = 'url' in (found ?? {}) ? (found as { url: string }).url : `https://notion.so/${pageId}`;
    return {
      page: { id: pageId, title, url },
      blocks: [
        { type: 'heading_1', text: title },
        { type: 'paragraph', text: 'Seeded page body for the sandbox connector.' },
      ],
    };
  }

  async createPage(input: { parentId: string; title: string; content?: string }): Promise<NotionPage> {
    this.pageSeq += 1;
    const page: NotionPage = {
      id: `page-${this.pageSeq}`,
      title: input.title,
      url: `https://notion.so/page-${this.pageSeq}`,
    };
    this.created.pages.push(page);
    return page;
  }

  async appendBlocks(pageId: string, blocks: NotionBlock[]): Promise<{ appended: number }> {
    this.created.appended.push({ pageId, blocks });
    return { appended: blocks.length };
  }
}

/** Real Notion API over global fetch. Selected when an integration token exists. */
export class RealNotionApi implements NotionApi {
  private static readonly BASE = 'https://api.notion.com/v1';
  private static readonly VERSION = '2022-06-28';

  constructor(private readonly token: string | (() => Promise<string>)) {}

  private async authHeader(): Promise<string> {
    const t = typeof this.token === 'function' ? await this.token() : this.token;
    return `Bearer ${t}`;
  }

  private async request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
    const res = await fetch(`${RealNotionApi.BASE}${path}`, {
      method: init?.method ?? 'GET',
      headers: {
        Authorization: await this.authHeader(),
        'Notion-Version': RealNotionApi.VERSION,
        'Content-Type': 'application/json',
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`notion api ${res.status}: ${detail.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  }

  private static titleOf(obj: Record<string, unknown>): string {
    // Notion titles live in different shapes for pages vs databases; be defensive.
    const props = (obj.properties ?? {}) as Record<string, { title?: { plain_text?: string }[] }>;
    for (const key of Object.keys(props)) {
      const t = props[key]?.title?.[0]?.plain_text;
      if (t) return t;
    }
    const dbTitle = (obj.title as { plain_text?: string }[] | undefined)?.[0]?.plain_text;
    return dbTitle ?? 'Untitled';
  }

  async search(query?: string): Promise<NotionSearchResult[]> {
    const data = await this.request<{ results: Record<string, unknown>[] }>(`/search`, {
      method: 'POST',
      body: query ? { query } : {},
    });
    return (data.results ?? []).map((r) => ({
      id: String(r.id),
      type: r.object === 'database' ? 'database' : 'page',
      title: RealNotionApi.titleOf(r),
      url: String(r.url ?? ''),
    }));
  }

  async getPage(pageId: string): Promise<{ page: NotionPage; blocks: NotionBlock[] }> {
    const page = await this.request<Record<string, unknown>>(`/pages/${pageId}`);
    const children = await this.request<{ results: Record<string, unknown>[] }>(
      `/blocks/${pageId}/children?page_size=25`,
    );
    const blocks: NotionBlock[] = (children.results ?? []).map((b) => {
      const type = String(b.type ?? 'unsupported');
      const rich = (b[type] as { rich_text?: { plain_text?: string }[] } | undefined)?.rich_text;
      return { type, text: rich?.map((x) => x.plain_text ?? '').join('') ?? '' };
    });
    return {
      page: { id: pageId, title: RealNotionApi.titleOf(page), url: String(page.url ?? '') },
      blocks,
    };
  }

  async createPage(input: { parentId: string; title: string; content?: string }): Promise<NotionPage> {
    const body = {
      parent: { page_id: input.parentId },
      properties: { title: { title: [{ text: { content: input.title } }] } },
      children: input.content
        ? [{ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ text: { content: input.content } }] } }]
        : [],
    };
    const page = await this.request<Record<string, unknown>>(`/pages`, { method: 'POST', body });
    return { id: String(page.id), title: input.title, url: String(page.url ?? '') };
  }

  async appendBlocks(pageId: string, blocks: NotionBlock[]): Promise<{ appended: number }> {
    const children = blocks.map((b) => ({
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: [{ text: { content: b.text } }] },
    }));
    await this.request(`/blocks/${pageId}/children`, { method: 'PATCH', body: { children } });
    return { appended: blocks.length };
  }
}
