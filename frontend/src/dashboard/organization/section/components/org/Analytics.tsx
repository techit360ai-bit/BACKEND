import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Clock,
  Award,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const keyMetrics = [
  {
    name: "Project Success Rate",
    value: "73%",
    change: "+8%",
    trend: "up",
    icon: Award,
  },
  {
    name: "Avg Time to Market",
    value: "8.2 weeks",
    change: "-12%",
    trend: "up",
    icon: Clock,
  },
  {
    name: "Cost Efficiency",
    value: "$12.4K",
    change: "-18%",
    trend: "up",
    icon: DollarSign,
  },
  {
    name: "Talent Performance",
    value: "89%",
    change: "+5%",
    trend: "up",
    icon: Users,
  },
];

const growthTrend = [
  { month: "Oct", projects: 95, revenue: 89, talent: 280 },
  { month: "Nov", projects: 103, revenue: 98, talent: 295 },
  { month: "Dec", projects: 112, revenue: 107, talent: 312 },
  { month: "Jan", projects: 118, revenue: 115, talent: 325 },
  { month: "Feb", projects: 121, revenue: 119, talent: 334 },
  { month: "Mar", projects: 127, revenue: 127, talent: 342 },
];

const projectLifecycle = [
  { stage: "Idea", count: 18, percentage: 14 },
  { stage: "Validation", count: 23, percentage: 18 },
  { stage: "Development", count: 42, percentage: 33 },
  { stage: "Testing", count: 24, percentage: 19 },
  { stage: "Market Ready", count: 20, percentage: 16 },
];

const velocityTrends = [
  { week: "W1", velocity: 72 },
  { week: "W2", velocity: 75 },
  { week: "W3", velocity: 78 },
  { week: "W4", velocity: 81 },
  { week: "W5", velocity: 79 },
  { week: "W6", velocity: 84 },
  { week: "W7", velocity: 86 },
  { week: "W8", velocity: 89 },
];

const revenueByCategory = [
  { name: "AI/ML", value: 3240, color: "#8b5cf6" },
  { name: "Web3", value: 2890, color: "#06b6d4" },
  { name: "SaaS", value: 2120, color: "#10b981" },
  { name: "FinTech", value: 1450, color: "#f59e0b" },
  { name: "Other", value: 980, color: "#6b7280" },
];

const aiImpact = [
  { metric: "Projects with AI", value: 89, total: 127 },
  { metric: "AI-Driven Success", value: 67, total: 89 },
  { metric: "Automation Rate", value: 67, total: 100 },
];

export function Analytics() {
  return (
    <div className="p-6 lg:p-8 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Analytics Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Deep insights into performance, growth, and efficiency
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {keyMetrics.map((metric) => {
          const Icon = metric.icon;
          const TrendIcon = metric.trend === "up" ? TrendingUp : TrendingDown;
          return (
            <div
              key={metric.name}
              className="bg-background rounded-xl shadow-sm p-6 border border-border"
            >
              <div className="flex items-center justify-between mb-3">
                <Icon className="w-6 h-6 text-indigo-600" />
                <div className="flex items-center gap-1 text-green-600">
                  <TrendIcon className="w-4 h-4" />
                  <span className="text-sm font-medium">{metric.change}</span>
                </div>
              </div>
              <p className="text-3xl font-bold text-foreground">{metric.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{metric.name}</p>
            </div>
          );
        })}
      </div>

      {/* Growth Trends */}
      <div className="bg-background rounded-xl shadow-sm border border-border p-6 mb-8">
        <h2 className="text-lg font-bold text-foreground mb-6">Growth Trends</h2>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={growthTrend}>
            <defs>
              <linearGradient id="colorProjects" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorTalent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey="projects"
              stroke="#6366f1"
              fillOpacity={1}
              fill="url(#colorProjects)"
              name="Projects"
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#10b981"
              fillOpacity={1}
              fill="url(#colorRevenue)"
              name="Revenue ($K)"
            />
            <Area
              type="monotone"
              dataKey="talent"
              stroke="#8b5cf6"
              fillOpacity={1}
              fill="url(#colorTalent)"
              name="Talent"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Middle Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Project Lifecycle Distribution */}
        <div className="bg-background rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-lg font-bold text-foreground mb-6">
            Project Lifecycle Distribution
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={projectLifecycle} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey="stage" type="category" tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Most Common</p>
              <p className="font-bold text-foreground">Development</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Total Projects</p>
              <p className="font-bold text-foreground">127</p>
            </div>
          </div>
        </div>

        {/* Execution Velocity */}
        <div className="bg-background rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-lg font-bold text-foreground mb-6">
            Execution Velocity Trends
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={velocityTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="velocity"
                stroke="#8b5cf6"
                strokeWidth={3}
                dot={{ fill: "#8b5cf6", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current Velocity</p>
              <p className="text-2xl font-bold text-foreground">89</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Trend</p>
              <div className="flex items-center gap-1 text-green-600">
                <TrendingUp className="w-4 h-4" />
                <span className="font-bold">+17%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue by Category */}
        <div className="lg:col-span-2 bg-background rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-lg font-bold text-foreground mb-6">
            Revenue by Category
          </h2>
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-full md:w-1/2">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={revenueByCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {revenueByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-1/2 space-y-3">
              {revenueByCategory.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-foreground">{item.name}</span>
                  </div>
                  <span className="text-sm font-bold text-foreground">
                    ${(item.value / 1000).toFixed(1)}K
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI Impact Metrics */}
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-200 p-6">
          <h2 className="text-lg font-bold text-foreground mb-6">AI Impact</h2>
          <div className="space-y-6">
            {aiImpact.map((item) => (
              <div key={item.metric}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-foreground">{item.metric}</span>
                  <span className="text-sm font-bold text-foreground">
                    {item.value}/{item.total}
                  </span>
                </div>
                <div className="h-3 bg-background rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-500"
                    style={{ width: `${(item.value / item.total) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {Math.round((item.value / item.total) * 100)}% effectiveness
                </p>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-purple-200">
            <p className="text-sm text-foreground">
              AI is driving <span className="font-bold text-purple-900">67%</span> of
              successful outcomes
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
