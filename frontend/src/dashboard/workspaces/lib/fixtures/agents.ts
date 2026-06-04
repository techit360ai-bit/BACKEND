import type { AIAgent } from '../../components/ai/AIAgentCard';

export const agentsFixture: AIAgent[] = [
  { id: 'openclaw', name: 'OpenClaws', description: 'Advanced autonomous coding agent', fullDescription: 'OpenClaws is a state-of-the-art autonomous coding agent that can understand complex requirements, write production-ready code, and refactor existing codebases.', category: 'Builder', isPremium: true, icon: 'code', enabled: true },
  { id: '1', name: 'Claude Code', description: 'AI pair programmer from Anthropic', fullDescription: 'Claude Code is an advanced AI assistant designed for software development. It excels at code review, debugging, architecture discussions, and writing high-quality code.', category: 'Builder', isPremium: true, icon: 'code', enabled: true },
  { id: '2', name: 'Project Planner', description: 'AI-driven project planning and estimation', fullDescription: 'Advanced project planning agent that estimates timelines, identifies dependencies, and optimizes resource allocation.', category: 'Core', isPremium: true, icon: 'calendar', enabled: true },
  { id: '3', name: 'Documentation Writer', description: 'Auto-generates technical documentation', fullDescription: 'Automatically generates comprehensive technical documentation from your code.', category: 'Builder', isPremium: false, icon: 'file', enabled: false },
  { id: '4', name: 'Security Auditor', description: 'Scans for vulnerabilities and security issues', fullDescription: 'Premium security agent that performs deep security audits and suggests fixes.', category: 'Security', isPremium: true, icon: 'shield', enabled: true },
  { id: '5', name: 'Analytics Insights', description: 'Provides data-driven insights', fullDescription: 'Analyzes project metrics and user behavior to provide actionable insights.', category: 'Growth', isPremium: true, icon: 'chart', enabled: false },
  { id: '6', name: 'Bug Tracker', description: 'Automatically categorizes and prioritizes bugs', fullDescription: 'Intelligent bug tracking that categorizes issues, suggests priorities, and recommends fixes.', category: 'Core', isPremium: false, icon: 'bug', enabled: true },
];
