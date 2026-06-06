import type { AIAgent } from '../../components/ai/AIAgentCard';
import { agentsFixture } from '../fixtures/agents';
import { delay, nextId } from './client';

let agents: AIAgent[] = agentsFixture.map((a) => ({ ...a }));

// GET /api/agents
export async function listAgents(): Promise<AIAgent[]> {
  await delay();
  return agents.map((a) => ({ ...a }));
}

// POST /api/agents/:id/toggle
export async function toggleAgent(id: string): Promise<AIAgent[]> {
  await delay();
  agents = agents.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a));
  return agents.map((a) => ({ ...a }));
}

// POST /api/agents
export async function addCustomAgent(input: { name: string; endpoint: string }): Promise<AIAgent[]> {
  await delay();
  agents = [
    ...agents,
    { id: nextId('agent'), name: input.name, description: 'Custom API-integrated agent', fullDescription: `Custom agent via ${input.endpoint}`, category: 'Builder', isPremium: false, icon: 'code', enabled: true },
  ];
  return agents.map((a) => ({ ...a }));
}
