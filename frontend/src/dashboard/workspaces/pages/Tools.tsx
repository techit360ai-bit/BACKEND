import { Wrench, Code, Database, Cloud, Terminal, Zap } from 'lucide-react';

export function Tools() {
  const tools = [
    { name: 'Code Editor', icon: Code, color: 'text-blue-500', bg: 'bg-blue-50' },
    { name: 'Database Manager', icon: Database, color: 'text-green-500', bg: 'bg-green-50' },
    { name: 'Cloud Services', icon: Cloud, color: 'text-purple-500', bg: 'bg-purple-50' },
    { name: 'Terminal', icon: Terminal, color: 'text-foreground', bg: 'bg-background' },
    { name: 'API Testing', icon: Zap, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { name: 'Build Tools', icon: Wrench, color: 'text-red-500', bg: 'bg-red-50' },
  ];

  return (
    <div className="h-full bg-background">
      <div className="bg-background border-b border-border px-6 py-4">
        <h1 className="text-2xl font-semibold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Development Tools
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Access your complete development toolkit
        </p>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool, idx) => (
            <div
              key={idx}
              className="bg-background p-6 rounded-xl shadow-sm border border-border hover:shadow-md transition-all cursor-pointer group"
            >
              <div className={`w-12 h-12 ${tool.bg} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <tool.icon className={`w-6 h-6 ${tool.color}`} />
              </div>
              <h3 className="font-semibold mb-2">{tool.name}</h3>
              <p className="text-sm text-muted-foreground">Access powerful {tool.name.toLowerCase()} features</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
