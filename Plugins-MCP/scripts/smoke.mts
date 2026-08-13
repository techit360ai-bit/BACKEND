import { getTechitService } from '../server/techit-service.ts';

const svc = await getTechitService();
const tools = svc.listTools();
const byPlugin: Record<string, number> = {};
for (const t of tools) byPlugin[t.plugin] = (byPlugin[t.plugin] ?? 0) + 1;

console.log('plugins:', Object.keys(byPlugin).sort().join(', '));
console.log('tool counts:', JSON.stringify(byPlugin));
console.log('total tools:', tools.length);
console.log('audit rows seeded:', svc.audit().length);
console.log('contributions seeded:', svc.contributions().length);
console.log('sample catalogue entry:', JSON.stringify(tools[0]));
console.log('destructive tools:', tools.filter((t) => (t.tool as { destructive?: boolean }).destructive).map((t) => `${t.plugin}.${(t.tool as { name: string }).name}`).join(', '));

// Live invoke one tool per connector (read-only) to prove the end-to-end path.
const probes: [string, string, Record<string, unknown>][] = [
  ['github', 'list_repositories', {}],
  ['notion', 'search', { query: 'x' }],
  ['figma', 'get_file', { file_key: 'k' }],
  ['web3', 'get_balance', { address: '0x1234567890abcdef1234567890abcdef12345678' }],
  ['ai', 'generate_code', { prompt: 'hello' }],
];
for (const [plugin, tool, params] of probes) {
  const res = await svc.invoke(plugin, tool, params, { id: 'founder', kind: 'human', role: 'owner' });
  console.log(`invoke ${plugin}.${tool}:`, res.ok ? 'OK' : `ERR ${res.error.code}`);
}
