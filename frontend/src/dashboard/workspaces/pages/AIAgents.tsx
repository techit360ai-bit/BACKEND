import { useState } from 'react';
import { AIAgentCard } from '../components/ai/AIAgentCard';
import type { AIAgent } from '../components/ai/AIAgentCard';
import { Search, Filter, Plus, Code2, Plug } from 'lucide-react';
import { CursorPresence } from '../components/ui/cursor-presence';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

const initialAgents: AIAgent[] = [
  {
    id: 'openclaw',
    name: 'OpenClaws',
    description: 'Advanced autonomous coding agent',
    fullDescription: 'OpenClaws is a state-of-the-art autonomous coding agent that can understand complex requirements, write production-ready code, and refactor existing codebases. Features include multi-file editing, intelligent code generation, and architectural suggestions.',
    category: 'Builder',
    isPremium: true,
    icon: 'code',
    enabled: true,
  },
  {
    id: '1',
    name: 'Claude Code',
    description: 'AI pair programmer from Anthropic',
    fullDescription: 'Claude Code is an advanced AI assistant designed for software development. It excels at code review, debugging, architecture discussions, and writing high-quality code across multiple languages.',
    category: 'Builder',
    isPremium: true,
    icon: 'code',
    enabled: true,
  },
  {
    id: '2',
    name: 'Project Planner',
    description: 'AI-driven project planning and estimation',
    fullDescription: 'Advanced project planning agent that uses machine learning to estimate timelines, identify dependencies, and optimize resource allocation. Integrates with your existing tools.',
    category: 'Core',
    isPremium: true,
    icon: 'calendar',
    enabled: true,
  },
  {
    id: '3',
    name: 'Documentation Writer',
    description: 'Auto-generates technical documentation',
    fullDescription: 'Automatically generates comprehensive technical documentation from your code, including API references, user guides, and inline comments. Supports multiple output formats.',
    category: 'Builder',
    isPremium: false,
    icon: 'file',
    enabled: false,
  },
  {
    id: '4',
    name: 'Security Auditor',
    description: 'Scans for vulnerabilities and security issues',
    fullDescription: 'Premium security agent that performs deep security audits, identifies vulnerabilities, suggests fixes, and monitors for compliance with industry standards like OWASP and GDPR.',
    category: 'Security',
    isPremium: true,
    icon: 'shield',
    enabled: true,
  },
  {
    id: '5',
    name: 'Analytics Insights',
    description: 'Provides data-driven insights',
    fullDescription: 'Analyzes project metrics and user behavior to provide actionable insights. Includes predictive analytics, trend detection, and automated reporting capabilities.',
    category: 'Growth',
    isPremium: true,
    icon: 'chart',
    enabled: false,
  },
  {
    id: '6',
    name: 'Bug Tracker',
    description: 'Automatically categorizes and prioritizes bugs',
    fullDescription: 'Intelligent bug tracking system that automatically categorizes issues, suggests priorities, identifies duplicates, and recommends potential fixes based on historical data.',
    category: 'Core',
    isPremium: false,
    icon: 'bug',
    enabled: true,
  },
  {
    id: '7',
    name: 'Meeting Summarizer',
    description: 'Creates summaries of team meetings',
    fullDescription: 'Records and transcribes meetings, generates comprehensive summaries with action items, and automatically updates your task board based on discussed topics.',
    category: 'Core',
    isPremium: false,
    icon: 'mic',
    enabled: false,
  },
  {
    id: '8',
    name: 'Financial Advisor',
    description: 'Budget tracking and financial planning',
    fullDescription: 'Premium financial agent that tracks project budgets, forecasts costs, manages invoices, and provides detailed financial reports with predictive analytics.',
    category: 'Finance',
    isPremium: true,
    icon: 'dollar',
    enabled: false,
  },
  {
    id: '9',
    name: 'Compliance Monitor',
    description: 'Ensures regulatory compliance',
    fullDescription: 'Monitors your project for compliance with various regulations (GDPR, HIPAA, SOC2), provides alerts for potential issues, and generates compliance reports.',
    category: 'Governance',
    isPremium: true,
    icon: 'check',
    enabled: true,
  },
  {
    id: '10',
    name: 'Copilot X',
    description: 'GitHub\'s AI-powered development assistant',
    fullDescription: 'Copilot X provides AI-powered code completions, chat-based assistance, and pull request analysis. Integrates seamlessly with your GitHub workflow.',
    category: 'Builder',
    isPremium: true,
    icon: 'code',
    enabled: false,
  },
  {
    id: '11',
    name: 'Cursor AI',
    description: 'Context-aware code editor assistant',
    fullDescription: 'Cursor AI understands your entire codebase context and provides intelligent suggestions, refactorings, and code generation based on your project structure.',
    category: 'Builder',
    isPremium: false,
    icon: 'code',
    enabled: false,
  },
];

const categories = ['All', 'Core', 'Builder', 'Governance', 'Finance', 'Security', 'Growth'];

export function AIAgents() {
  const [agents, setAgents] = useState(initialAgents);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentApiKey, setNewAgentApiKey] = useState('');
  const [newAgentEndpoint, setNewAgentEndpoint] = useState('');

  const handleToggle = (id: string) => {
    setAgents(prev =>
      prev.map(agent =>
        agent.id === id ? { ...agent, enabled: !agent.enabled } : agent
      )
    );
  };

  const handleAddCustomAgent = () => {
    if (!newAgentName || !newAgentApiKey || !newAgentEndpoint) return;

    const newAgent: AIAgent = {
      id: `custom-${Date.now()}`,
      name: newAgentName,
      description: 'Custom API-integrated agent',
      fullDescription: `Custom agent integrated via API endpoint: ${newAgentEndpoint}`,
      category: 'Builder',
      isPremium: false,
      icon: 'code',
      enabled: true,
    };

    setAgents(prev => [...prev, newAgent]);
    setIsAddDialogOpen(false);
    setNewAgentName('');
    setNewAgentApiKey('');
    setNewAgentEndpoint('');
  };

  const filteredAgents = agents.filter(agent => {
    const matchesCategory = selectedCategory === 'All' || agent.category === selectedCategory;
    const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          agent.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const enabledCount = agents.filter(a => a.enabled).length;
  const premiumCount = agents.filter(a => a.isPremium && a.enabled).length;

  return (
    <div className="h-full flex bg-gray-50">
      {/* Left: Category Filter Sidebar */}
      <div className="w-[200px] bg-white border-r border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">
          Categories
        </h3>
        <div className="space-y-1">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedCategory === category
                  ? 'bg-[#2196F3] text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="mt-8 p-4 bg-gradient-to-br from-[#2196F3]/10 to-purple-500/10 rounded-lg border border-[#2196F3]/20">
          <div className="text-sm font-medium mb-1">Active Agents</div>
          <div className="text-2xl font-bold text-[#2196F3]">{enabledCount}</div>
          <div className="text-xs text-gray-600 mt-2">
            {premiumCount} Premium • {enabledCount - premiumCount} Basic
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Page Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-semibold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                AI Agents Hub
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Automate your workflow with intelligent AI agents
              </p>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#2196F3] hover:bg-[#1976D2]">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Agent
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[525px]">
                <DialogHeader>
                  <DialogTitle>Add Custom AI Agent</DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="api">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="api">API Integration</TabsTrigger>
                    <TabsTrigger value="plugin">Plugin</TabsTrigger>
                  </TabsList>
                  <TabsContent value="api" className="space-y-4">
                    <div>
                      <Label htmlFor="agent-name">Agent Name</Label>
                      <Input
                        id="agent-name"
                        placeholder="My Custom Agent"
                        value={newAgentName}
                        onChange={e => setNewAgentName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="api-endpoint">API Endpoint</Label>
                      <Input
                        id="api-endpoint"
                        placeholder="https://api.example.com/v1/agent"
                        value={newAgentEndpoint}
                        onChange={e => setNewAgentEndpoint(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="api-key">API Key</Label>
                      <Input
                        id="api-key"
                        type="password"
                        placeholder="sk-..."
                        value={newAgentApiKey}
                        onChange={e => setNewAgentApiKey(e.target.value)}
                      />
                    </div>
                    <Button
                      className="w-full bg-[#2196F3] hover:bg-[#1976D2]"
                      onClick={handleAddCustomAgent}
                    >
                      <Plug className="w-4 h-4 mr-2" />
                      Connect Agent
                    </Button>
                  </TabsContent>
                  <TabsContent value="plugin" className="space-y-4">
                    <div className="text-center py-8">
                      <Code2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <h3 className="font-semibold mb-2">Install via Plugin</h3>
                      <p className="text-sm text-gray-500 mb-4">
                        Upload a plugin package or install from marketplace
                      </p>
                      <Button variant="outline" className="w-full">
                        Browse Marketplace
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:border-[#2196F3] focus:ring-1 focus:ring-[#2196F3] outline-none"
            />
          </div>
        </div>

        {/* Agent Grid */}
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAgents.map((agent) => (
              <AIAgentCard key={agent.id} agent={agent} onToggle={handleToggle} />
            ))}
          </div>

          {filteredAgents.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <Filter className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-lg">No agents found</p>
              <p className="text-sm">Try adjusting your filters or search query</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}