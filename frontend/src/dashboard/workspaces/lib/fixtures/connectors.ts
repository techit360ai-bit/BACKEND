import type { Connector } from '../types';

export const connectorsFixture: Connector[] = [
  {
    id: 'github', name: 'GitHub', category: 'Code', status: 'connected',
    authType: 'oauth2', capabilities: ['read', 'write', 'execute'],
    resources: ['repository', 'pull_request', 'issue', 'workflow'],
    deepLink: '/workspaces/github', lastSync: '2026-06-05T09:12:00Z',
    tools: [
      { name: 'list_repositories', description: 'List all linked repositories.', inputSchema: {} },
      { name: 'read_file', description: 'Read a file from a repo.', inputSchema: { repo: { type: 'string', required: true }, path: { type: 'string', required: true } } },
      { name: 'create_pull_request', description: 'Open a PR from a branch.', inputSchema: { repo: { type: 'string', required: true }, branch: { type: 'string', required: true }, title: { type: 'string', required: true } }, destructive: true },
      { name: 'get_pr_status', description: 'Get CI/review status of a PR.', inputSchema: { repo: { type: 'string', required: true }, number: { type: 'number', required: true } } },
      { name: 'list_issues', description: 'List issues in a repo.', inputSchema: { repo: { type: 'string', required: true } } },
      { name: 'run_workflow', description: 'Trigger a GitHub Actions workflow.', inputSchema: { repo: { type: 'string', required: true }, workflow: { type: 'string', required: true } }, destructive: true },
    ],
  },
  {
    id: 'figma', name: 'Figma', category: 'Design', status: 'connected',
    authType: 'oauth2', capabilities: ['read'],
    resources: ['file', 'component', 'style'], lastSync: '2026-06-05T08:40:00Z',
    tools: [
      { name: 'read_design_file', description: 'Fetch a Figma file content.', inputSchema: { file_id: { type: 'string', required: true } } },
      { name: 'extract_design_tokens', description: 'Extract colors, spacing, typography.', inputSchema: { file_id: { type: 'string', required: true } } },
      { name: 'list_components', description: 'List components by frame and page.', inputSchema: { file_id: { type: 'string', required: true } } },
      { name: 'detect_design_changes', description: 'Diff a file against its last version.', inputSchema: { file_id: { type: 'string', required: true } } },
      { name: 'add_comment', description: 'Comment on a Figma file.', inputSchema: { file_id: { type: 'string', required: true }, text: { type: 'string', required: true } }, destructive: true },
    ],
  },
  {
    id: 'notion', name: 'Notion', category: 'Docs', status: 'disconnected',
    authType: 'oauth2', capabilities: ['read', 'write'],
    resources: ['page', 'database'],
    tools: [
      { name: 'read_page', description: 'Read a Notion page.', inputSchema: { block_id: { type: 'string', required: true } } },
      { name: 'search_docs', description: 'Search pages and databases.', inputSchema: { query: { type: 'string', required: true } } },
      { name: 'create_page', description: 'Create a new page.', inputSchema: { parent: { type: 'string', required: true }, title: { type: 'string', required: true } }, destructive: true },
      { name: 'update_page', description: 'Append/update page content.', inputSchema: { block_id: { type: 'string', required: true } }, destructive: true },
      { name: 'list_databases', description: 'List accessible databases.', inputSchema: {} },
    ],
  },
  {
    id: 'ml', name: 'ML Tools', category: 'ML', status: 'error',
    authType: 'api_key', capabilities: ['read', 'execute'],
    resources: ['model', 'run'],
    tools: [
      { name: 'list_models', description: 'List models in the registry.', inputSchema: {} },
      { name: 'get_model_metrics', description: 'Fetch metrics for a model.', inputSchema: { model_id: { type: 'string', required: true } } },
      { name: 'deploy_model', description: 'Deploy a model to an environment.', inputSchema: { model_id: { type: 'string', required: true }, environment: { type: 'string', required: true } }, destructive: true },
      { name: 'rollback_model', description: 'Roll back a deployment.', inputSchema: { model_id: { type: 'string', required: true } }, destructive: true },
    ],
  },
  {
    id: 'web3', name: 'Web3', category: 'Blockchain', status: 'pending',
    authType: 'service_account', capabilities: ['read', 'execute'],
    resources: ['wallet', 'contract', 'dao'],
    tools: [
      { name: 'read_wallet', description: 'Read a wallet balance and holdings.', inputSchema: { address: { type: 'string', required: true } } },
      { name: 'call_contract', description: 'Call a read-only contract method.', inputSchema: { contract: { type: 'string', required: true }, method: { type: 'string', required: true } } },
      { name: 'submit_transaction', description: 'Submit a signed transaction.', inputSchema: { contract: { type: 'string', required: true }, method: { type: 'string', required: true } }, destructive: true },
    ],
  },
];
