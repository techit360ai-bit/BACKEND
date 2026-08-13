/**
 * AI-harness API surface used by the connector + MCP server.
 *
 * `FakeAiHarnessApi` is an in-memory, deterministic implementation — the default
 * for tests and investor demos. `RealAiHarnessApi` wraps the TechIT ai-router:
 * `review_code` maps to a real endpoint (`/api/v1/workspace/code/review`); the
 * others have no dedicated ai-router route yet, so they delegate to the fake
 * fallback. `runSandbox` is ALWAYS simulated — it never executes real code.
 */

export interface GenerateResult {
  language: string;
  code: string;
  explanation: string;
  model: string;
}

export interface ReviewIssue {
  severity: 'info' | 'warning' | 'error';
  message: string;
  line?: number;
}

export interface ReviewResult {
  summary: string;
  issues: ReviewIssue[];
  score: number;
  model: string;
}

export interface ResearchSource {
  title: string;
  url: string;
}

export interface ResearchResult {
  query: string;
  summary: string;
  sources: ResearchSource[];
  model: string;
}

export interface SandboxResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  simulated: boolean;
}

export interface AiHarnessApi {
  generateCode(prompt: string, language?: string): Promise<GenerateResult>;
  reviewCode(code: string, language?: string, context?: string): Promise<ReviewResult>;
  deepResearch(query: string, depth?: string): Promise<ResearchResult>;
  runSandbox(language: string, code: string): Promise<SandboxResult>;
}

export const AI_HARNESS_MODEL = 'techit-ai-harness/mvp';

/** Deterministic, network-free harness. Default for tests + demos. */
export class FakeAiHarnessApi implements AiHarnessApi {
  async generateCode(prompt: string, language = 'typescript'): Promise<GenerateResult> {
    const slug = prompt.trim().split(/\s+/).slice(0, 6).join(' ');
    return {
      language,
      code: `// generated for: ${slug}\nexport function main(): void {\n  // TODO: implement\n}\n`,
      explanation: `Scaffolded a ${language} entry point for "${slug}".`,
      model: AI_HARNESS_MODEL,
    };
  }

  async reviewCode(code: string, language = 'typescript', _context?: string): Promise<ReviewResult> {
    const issues: ReviewIssue[] = [];
    if (/\bany\b/.test(code)) {
      issues.push({ severity: 'warning', message: `Avoid \`any\` in ${language}; prefer a precise type.` });
    }
    if (/console\.log/.test(code)) {
      issues.push({ severity: 'info', message: 'Remove console.log before shipping.' });
    }
    const score = Math.max(0, 100 - issues.length * 10);
    return {
      summary: issues.length ? `${issues.length} issue(s) found.` : 'No blocking issues found.',
      issues,
      score,
      model: AI_HARNESS_MODEL,
    };
  }

  async deepResearch(query: string, depth = 'standard'): Promise<ResearchResult> {
    return {
      query,
      summary: `(${depth}) Synthesized overview for "${query}" from the reference corpus.`,
      sources: [
        { title: 'TechIT knowledge base', url: 'https://app.techit.network/kb' },
        { title: 'Primary reference', url: 'https://example.com/ref' },
      ],
      model: AI_HARNESS_MODEL,
    };
  }

  async runSandbox(language: string, code: string): Promise<SandboxResult> {
    // Simulated only: we report a plausible run without executing anything.
    const lines = code.split('\n').filter((l) => l.trim()).length;
    return {
      ok: true,
      stdout: `[simulated ${language} run] ${lines} line(s) evaluated; no runtime side effects.`,
      stderr: '',
      exitCode: 0,
      durationMs: 12,
      simulated: true,
    };
  }
}

/**
 * Live harness backed by the TechIT ai-router.
 *
 * Only `reviewCode` has a dedicated real route today
 * (`POST /api/v1/workspace/code/review`); the rest delegate to the deterministic
 * fallback so the connector stays fully functional. `runSandbox` NEVER hits the
 * network — sandbox execution is simulated for demo safety regardless of mode.
 */
export class RealAiHarnessApi implements AiHarnessApi {
  private readonly fallback = new FakeAiHarnessApi();

  constructor(
    private readonly baseUrl: string | (() => Promise<string>),
    private readonly token: string | (() => Promise<string>),
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async resolve(v: string | (() => Promise<string>)): Promise<string> {
    return typeof v === 'function' ? v() : v;
  }

  async generateCode(prompt: string, language?: string): Promise<GenerateResult> {
    // No dedicated ai-router route yet — deterministic fallback.
    return this.fallback.generateCode(prompt, language);
  }

  async reviewCode(code: string, language = 'typescript', context?: string): Promise<ReviewResult> {
    const base = (await this.resolve(this.baseUrl)).replace(/\/$/, '');
    const token = await this.resolve(this.token);
    const res = await this.fetchImpl(`${base}/api/v1/workspace/code/review`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code, language, context }),
    });
    if (!res.ok) {
      throw new Error(`ai-router review_code failed: ${res.status} ${res.statusText}`);
    }
    const body = (await res.json()) as Partial<ReviewResult> & { review?: string };
    return {
      summary: body.summary ?? body.review ?? 'Review complete.',
      issues: body.issues ?? [],
      score: typeof body.score === 'number' ? body.score : 0,
      model: body.model ?? 'ai-router/code-review',
    };
  }

  async deepResearch(query: string, depth?: string): Promise<ResearchResult> {
    // No dedicated ai-router route yet — deterministic fallback.
    return this.fallback.deepResearch(query, depth);
  }

  async runSandbox(language: string, code: string): Promise<SandboxResult> {
    // Always simulated — real code execution is intentionally not wired.
    return this.fallback.runSandbox(language, code);
  }
}
