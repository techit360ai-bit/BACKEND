import { useEffect, useState } from 'react';
import { Bot, Search } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { AIAgentCard } from '../components/ai/AIAgentCard';
import type { AIAgent } from '../components/ai/AIAgentCard';
import { listAgents, toggleAgent } from '../lib/api/agents';

export function Agents() {
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => { listAgents().then(setAgents); }, []);

  const handleToggle = async (id: string) => setAgents(await toggleAgent(id));

  const filtered = agents.filter((a) => a.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-[#2196F3]/10 rounded-lg"><Bot className="w-6 h-6 text-[#2196F3]" /></div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Agents</h1>
        </div>
        <Tabs defaultValue="catalog">
          <TabsList>
            <TabsTrigger value="catalog">Catalog</TabsTrigger>
            <TabsTrigger value="console">Console</TabsTrigger>
          </TabsList>

          <TabsContent value="catalog">
            <div className="relative mt-4 mb-6 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search agents..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-[#2196F3]" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-8">
              {filtered.map((a) => (<AIAgentCard key={a.id} agent={a} onToggle={handleToggle} />))}
            </div>
          </TabsContent>

          <TabsContent value="console">
            <div className="mt-4 text-sm text-gray-400">Console coming in the next task.</div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
