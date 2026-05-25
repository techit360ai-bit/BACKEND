import {
  Plug,
  Check,
  ExternalLink,
  Settings,
  Shield,
  Zap,
  Code,
  Database,
} from "lucide-react";

const integrations = [
  {
    name: "GitHub",
    category: "Development",
    description: "Connect repositories and automate workflows",
    icon: "GH",
    connected: true,
    color: "bg-gray-900",
    repos: 45,
  },
  {
    name: "Slack",
    category: "Communication",
    description: "Real-time notifications and team collaboration",
    icon: "SL",
    connected: true,
    color: "bg-purple-600",
    channels: 12,
  },
  {
    name: "Notion",
    category: "Documentation",
    description: "Sync project documentation and knowledge base",
    icon: "NT",
    connected: false,
    color: "bg-black",
  },
  {
    name: "Figma",
    category: "Design",
    description: "Import designs and collaborate on prototypes",
    icon: "FG",
    connected: true,
    color: "bg-pink-500",
    files: 23,
  },
  {
    name: "Jira",
    category: "Project Management",
    description: "Sync tasks and sprint planning",
    icon: "JR",
    connected: false,
    color: "bg-blue-600",
  },
  {
    name: "Stripe",
    category: "Payments",
    description: "Billing and payment processing",
    icon: "ST",
    connected: true,
    color: "bg-indigo-600",
    transactions: 127,
  },
  {
    name: "Google Analytics",
    category: "Analytics",
    description: "Track user behavior and engagement",
    icon: "GA",
    connected: false,
    color: "bg-orange-500",
  },
  {
    name: "AWS",
    category: "Cloud Infrastructure",
    description: "Deploy and manage cloud resources",
    icon: "AWS",
    connected: true,
    color: "bg-yellow-600",
    services: 8,
  },
];

const webhooks = [
  {
    name: "Project Created",
    endpoint: "https://api.techit.io/webhooks/project-created",
    events: 234,
    status: "Active",
  },
  {
    name: "Market Ready Alert",
    endpoint: "https://api.techit.io/webhooks/market-ready",
    events: 45,
    status: "Active",
  },
  {
    name: "Team Member Added",
    endpoint: "https://api.techit.io/webhooks/team-added",
    events: 89,
    status: "Paused",
  },
];

const apiKeys = [
  {
    name: "Production API Key",
    key: "tk_prod_**********************",
    created: "Mar 15, 2026",
    lastUsed: "2 hours ago",
  },
  {
    name: "Development API Key",
    key: "tk_dev_**********************",
    created: "Feb 1, 2026",
    lastUsed: "1 day ago",
  },
];

export function Integrations() {
  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Integrations Hub</h1>
        <p className="text-gray-600 mt-2">
          Connect your tools, automate workflows, and extend TechIT
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <Plug className="w-6 h-6 text-blue-600 mb-3" />
          <p className="text-3xl font-bold text-gray-900">
            {integrations.filter((i) => i.connected).length}
          </p>
          <p className="text-sm text-gray-600 mt-1">Connected</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <Zap className="w-6 h-6 text-yellow-600 mb-3" />
          <p className="text-3xl font-bold text-gray-900">368</p>
          <p className="text-sm text-gray-600 mt-1">Active Webhooks</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <Code className="w-6 h-6 text-purple-600 mb-3" />
          <p className="text-3xl font-bold text-gray-900">2</p>
          <p className="text-sm text-gray-600 mt-1">API Keys</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <Database className="w-6 h-6 text-green-600 mb-3" />
          <p className="text-3xl font-bold text-gray-900">45.2K</p>
          <p className="text-sm text-gray-600 mt-1">API Calls Today</p>
        </div>
      </div>

      {/* Available Integrations */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Available Integrations
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {integrations.map((integration) => (
            <div
              key={integration.name}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className={`${integration.color} w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-sm`}
                >
                  {integration.icon}
                </div>
                {integration.connected && (
                  <div className="bg-green-50 p-1.5 rounded-full">
                    <Check className="w-4 h-4 text-green-600" />
                  </div>
                )}
              </div>

              <h3 className="font-bold text-gray-900 mb-1">
                {integration.name}
              </h3>
              <p className="text-xs text-gray-600 mb-3">
                {integration.category}
              </p>
              <p className="text-sm text-gray-700 mb-4">
                {integration.description}
              </p>

              {integration.connected && (
                <div className="mb-4 p-2 bg-gray-50 rounded text-xs text-gray-600">
                  {integration.repos && `${integration.repos} repositories`}
                  {integration.channels && `${integration.channels} channels`}
                  {integration.files && `${integration.files} files synced`}
                  {integration.transactions &&
                    `${integration.transactions} transactions`}
                  {integration.services && `${integration.services} services`}
                </div>
              )}

              <button
                className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  integration.connected
                    ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
                }`}
              >
                {integration.connected ? "Manage" : "Connect"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Webhooks */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">Webhooks</h2>
            <button className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-medium hover:bg-indigo-100">
              Add Webhook
            </button>
          </div>
          <div className="space-y-4">
            {webhooks.map((webhook, idx) => (
              <div
                key={idx}
                className="pb-4 border-b border-gray-100 last:border-0"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-medium text-gray-900">{webhook.name}</h4>
                    <p className="text-xs text-gray-600 mt-1 font-mono">
                      {webhook.endpoint}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      webhook.status === "Active"
                        ? "bg-green-50 text-green-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {webhook.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">
                    {webhook.events} events triggered
                  </span>
                  <button className="text-xs text-indigo-600 hover:text-indigo-700">
                    Configure
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* API Keys */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">API Keys</h2>
            <button className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-medium hover:bg-indigo-100">
              Generate Key
            </button>
          </div>
          <div className="space-y-4">
            {apiKeys.map((key, idx) => (
              <div
                key={idx}
                className="bg-gray-50 rounded-lg p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-gray-900">{key.name}</h4>
                    <p className="text-xs text-gray-600 mt-1 font-mono">
                      {key.key}
                    </p>
                  </div>
                  <button className="p-1 hover:bg-gray-200 rounded">
                    <Settings className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>Created {key.created}</span>
                  <span>Last used {key.lastUsed}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SDK Support */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-6">
        <div className="flex items-start gap-4">
          <div className="bg-white p-3 rounded-lg">
            <Code className="w-6 h-6 text-indigo-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 mb-2">SDK & Developer Tools</h3>
            <p className="text-sm text-gray-700 mb-4">
              Build custom plugins, extend TechIT functionality, and connect your
              internal tools using our comprehensive API and SDK.
            </p>
            <div className="flex gap-3">
              <button className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
                <ExternalLink className="w-4 h-4" />
                API Documentation
              </button>
              <button className="inline-flex items-center gap-2 px-4 py-2 border border-indigo-300 text-indigo-700 rounded-lg hover:bg-white transition-colors text-sm font-medium">
                <Shield className="w-4 h-4" />
                Security Guide
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
