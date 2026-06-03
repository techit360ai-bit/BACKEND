import { useState } from 'react';
import { Search, Code2, Terminal, Database, Cpu, Network, FileCode, Boxes } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

interface Tool {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  tags: string[];
  color: string;
}

export function DevTools() {
  const [searchQuery, setSearchQuery] = useState('');

  const tools: Tool[] = [
    {
      id: '1',
      name: 'API Explorer',
      category: 'Development',
      description: 'Test and explore REST APIs with an interactive interface',
      icon: 'network',
      tags: ['api', 'rest', 'testing'],
      color: 'bg-blue-500',
    },
    {
      id: '2',
      name: 'Database Manager',
      category: 'Data',
      description: 'Manage databases, run queries, and visualize data',
      icon: 'database',
      tags: ['database', 'sql', 'data'],
      color: 'bg-green-500',
    },
    {
      id: '3',
      name: 'Code Formatter',
      category: 'Development',
      description: 'Format and beautify code in multiple languages',
      icon: 'code',
      tags: ['formatter', 'code', 'prettier'],
      color: 'bg-purple-500',
    },
    {
      id: '4',
      name: 'Terminal',
      category: 'System',
      description: 'Built-in terminal with SSH support',
      icon: 'terminal',
      tags: ['terminal', 'ssh', 'shell'],
      color: 'bg-card',
    },
    {
      id: '5',
      name: 'Performance Monitor',
      category: 'Monitoring',
      description: 'Monitor application performance and resource usage',
      icon: 'cpu',
      tags: ['performance', 'monitoring', 'metrics'],
      color: 'bg-orange-500',
    },
    {
      id: '6',
      name: 'JSON Validator',
      category: 'Utilities',
      description: 'Validate and format JSON data',
      icon: 'file',
      tags: ['json', 'validator', 'formatter'],
      color: 'bg-yellow-500',
    },
    {
      id: '7',
      name: 'Component Library',
      category: 'UI',
      description: 'Browse and use pre-built UI components',
      icon: 'boxes',
      tags: ['ui', 'components', 'library'],
      color: 'bg-pink-500',
    },
    {
      id: '8',
      name: 'Code Snippets',
      category: 'Development',
      description: 'Save and manage reusable code snippets',
      icon: 'code',
      tags: ['snippets', 'code', 'reusable'],
      color: 'bg-indigo-500',
    },
  ];

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'network':
        return <Network className="w-6 h-6" />;
      case 'database':
        return <Database className="w-6 h-6" />;
      case 'code':
        return <Code2 className="w-6 h-6" />;
      case 'terminal':
        return <Terminal className="w-6 h-6" />;
      case 'cpu':
        return <Cpu className="w-6 h-6" />;
      case 'file':
        return <FileCode className="w-6 h-6" />;
      case 'boxes':
        return <Boxes className="w-6 h-6" />;
      default:
        return <Code2 className="w-6 h-6" />;
    }
  };

  const filteredTools = tools.filter(
    tool =>
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const categories = ['All', ...Array.from(new Set(tools.map(t => t.category)))];
  const [selectedCategory, setSelectedCategory] = useState('All');

  const displayedTools =
    selectedCategory === 'All'
      ? filteredTools
      : filteredTools.filter(t => t.category === selectedCategory);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="bg-background border-b border-border px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#2196F3]/10 rounded-lg">
              <Code2 className="w-6 h-6 text-[#2196F3]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Developer Tools
              </h1>
              <p className="text-sm text-muted-foreground">{displayedTools.length} tools available</p>
            </div>
          </div>
          <Button className="bg-[#2196F3] hover:bg-[#1976D2]">
            <Code2 className="w-4 h-4 mr-2" />
            Add Custom Tool
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/70" />
          <Input
            placeholder="Search tools by name, description, or tags..."
            className="pl-10"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-8 py-6">
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="mb-6">
            {categories.map(cat => (
              <TabsTrigger key={cat} value={cat}>
                {cat}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedTools.map(tool => (
              <div
                key={tool.id}
                className="bg-background border border-border rounded-lg p-6 hover:shadow-lg transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-lg ${tool.color} text-white group-hover:scale-110 transition-transform`}>
                    {getIcon(tool.icon)}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {tool.category}
                  </Badge>
                </div>
                <h3 className="font-semibold text-lg mb-2">{tool.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">{tool.description}</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {tool.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <Button className="w-full bg-[#2196F3] hover:bg-[#1976D2]">
                  Open Tool
                </Button>
              </div>
            ))}
          </div>

          {displayedTools.length === 0 && (
            <div className="text-center py-12">
              <Search className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground/70 mb-2">No tools found</h3>
              <p className="text-sm text-muted-foreground/70">
                Try searching with different keywords or browse all categories
              </p>
            </div>
          )}
        </Tabs>
      </div>
    </div>
  );
}
