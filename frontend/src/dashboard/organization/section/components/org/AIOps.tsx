import {
  Brain,
  Zap,
  Settings,
  TrendingUp,
  Activity,
  CheckCircle2,
  Clock,
  BarChart3,
  Code,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const aiMetrics = [
  { name: "Tasks Automated", value: "7,360", change: "+34%", icon: CheckCircle2 },
  { name: "AI Actions", value: "12.4K", change: "+28%", icon: Zap },
  { name: "Efficiency Gain", value: "67%", change: "+12%", icon: TrendingUp },
  { name: "Time Saved", value: "1,240h", change: "+45%", icon: Clock },
];

const agentActivity = [
  {
    name: "Research Agent",
    status: "Active",
    tasksCompleted: 234,
    performance: 96,
    lastAction: "Market analysis completed",
    time: "5 min ago",
  },
  {
    name: "Code Review Agent",
    status: "Active",
    tasksCompleted: 189,
    performance: 94,
    lastAction: "Pull request reviewed",
    time: "12 min ago",
  },
  {
    name: "Testing Agent",
    status: "Active",
    tasksCompleted: 312,
    performance: 98,
    lastAction: "Test suite executed",
    time: "3 min ago",
  },
  {
    name: "Documentation Agent",
    status: "Idle",
    tasksCompleted: 156,
    performance: 91,
    lastAction: "API docs generated",
    time: "1 hour ago",
  },
  {
    name: "Analytics Agent",
    status: "Active",
    tasksCompleted: 278,
    performance: 95,
    lastAction: "Data report generated",
    time: "8 min ago",
  },
];

const automationData = [
  { month: "Jan", automated: 1240, manual: 3200, efficiency: 28 },
  { month: "Feb", automated: 1890, manual: 2850, efficiency: 40 },
  { month: "Mar", automated: 2340, manual: 2100, efficiency: 53 },
  { month: "Apr", automated: 2890, manual: 1450, efficiency: 67 },
];

const taskBreakdown = [
  { category: "Code Generation", count: 2340, percentage: 32 },
  { category: "Testing & QA", count: 1890, percentage: 26 },
  { category: "Documentation", count: 1560, percentage: 21 },
  { category: "Analysis", count: 980, percentage: 13 },
  { category: "Other", count: 590, percentage: 8 },
];

const customPrompts = [
  {
    name: "Project Initialization",
    description: "Auto-setup new project structure",
    executions: 45,
    successRate: 98,
  },
  {
    name: "Code Refactoring",
    description: "Optimize and clean codebase",
    executions: 89,
    successRate: 94,
  },
  {
    name: "Bug Detection",
    description: "Identify and flag potential issues",
    executions: 156,
    successRate: 96,
  },
];

export function AIOps() {
  return (
    <div className="p-6 lg:p-8 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">AI Operations</h1>
          <p className="text-gray-600 mt-2">
            Control center for AI agents, automation, and custom workflows
          </p>
        </div>
        <button className="mt-4 sm:mt-0 inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all">
          <Settings className="w-5 h-5" />
          Configure AI
        </button>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {aiMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.name}
              className="bg-gradient-to-br from-white to-purple-50 rounded-xl shadow-sm p-6 border border-purple-100"
            >
              <div className="flex items-center justify-between mb-3">
                <Icon className="w-6 h-6 text-purple-600" />
                <span className="text-sm font-medium text-green-600">
                  {metric.change}
                </span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{metric.value}</p>
              <p className="text-sm text-gray-600 mt-1">{metric.name}</p>
            </div>
          );
        })}
      </div>

      {/* AI Agents Running */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Active AI Agents</h2>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm text-gray-600">
              {agentActivity.filter((a) => a.status === "Active").length} agents
              running
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {agentActivity.map((agent) => (
            <div
              key={agent.name}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                  <div className="bg-gradient-to-br from-purple-500 to-indigo-500 p-2 rounded-lg">
                    <Brain className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{agent.name}</h3>
                    <p className="text-xs text-gray-600 mt-1">
                      {agent.tasksCompleted} tasks completed
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    agent.status === "Active"
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {agent.status}
                </span>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-gray-600">Performance</span>
                  <span className="font-medium text-gray-900">
                    {agent.performance}%
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-500"
                    style={{ width: `${agent.performance}%` }}
                  />
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Activity className="w-4 h-4 text-blue-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{agent.lastAction}</p>
                    <p className="text-xs text-gray-500 mt-1">{agent.time}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Automation Trends */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6">
            Automation vs Manual Tasks
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={automationData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="automated"
                stroke="#8b5cf6"
                strokeWidth={3}
                name="Automated"
              />
              <Line
                type="monotone"
                dataKey="manual"
                stroke="#94a3b8"
                strokeWidth={3}
                name="Manual"
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Current Efficiency</span>
              <span className="text-2xl font-bold text-purple-600">67%</span>
            </div>
          </div>
        </div>

        {/* Task Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6">
            AI Task Distribution
          </h2>
          <div className="space-y-4">
            {taskBreakdown.map((task) => (
              <div key={task.category}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-700">{task.category}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">{task.count}</span>
                    <span className="text-sm font-bold text-gray-900">
                      {task.percentage}%
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                    style={{ width: `${task.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Total AI Tasks:{" "}
              <span className="font-bold text-gray-900">7,360</span>
            </p>
          </div>
        </div>
      </div>

      {/* Prompt Logic Control */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Custom Prompt Workflows
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Organization-specific AI automation logic
            </p>
          </div>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium">
            <Code className="w-4 h-4" />
            Create Workflow
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {customPrompts.map((prompt) => (
            <div
              key={prompt.name}
              className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-medium text-gray-900">{prompt.name}</h3>
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              </div>
              <p className="text-xs text-gray-600 mb-3">{prompt.description}</p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">
                  {prompt.executions} executions
                </span>
                <span className="font-medium text-green-600">
                  {prompt.successRate}% success
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Efficiency Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-white p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Cost Savings</p>
              <p className="text-2xl font-bold text-gray-900">$89,400</p>
            </div>
          </div>
          <p className="text-xs text-gray-700">
            vs. manual processing this quarter
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-white p-3 rounded-lg">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Time Saved</p>
              <p className="text-2xl font-bold text-gray-900">1,240 hrs</p>
            </div>
          </div>
          <p className="text-xs text-gray-700">Equivalent to 31 work weeks</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-white p-3 rounded-lg">
              <BarChart3 className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Productivity Boost</p>
              <p className="text-2xl font-bold text-gray-900">3.2x</p>
            </div>
          </div>
          <p className="text-xs text-gray-700">Faster project completion</p>
        </div>
      </div>
    </div>
  );
}
