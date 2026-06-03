import {
  Users,
  FolderKanban,
  Rocket,
  GraduationCap,
  DollarSign,
  Activity,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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

const stats = [
  {
    name: "Active Projects",
    value: "127",
    change: "+12%",
    icon: FolderKanban,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    name: "Active Team Members",
    value: "342",
    change: "+8%",
    icon: Users,
    color: "text-green-600",
    bg: "bg-green-50",
  },
  {
    name: "AI Credits Used",
    value: "45.2K",
    change: "+23%",
    icon: Activity,
    color: "text-purple-600",
    bg: "bg-purple-50",
  },
  {
    name: "Market Ready Startups",
    value: "34",
    change: "+6",
    icon: Rocket,
    color: "text-orange-600",
    bg: "bg-orange-50",
  },
  {
    name: "Incubator Cohorts",
    value: "8",
    change: "+2",
    icon: GraduationCap,
    color: "text-indigo-600",
    bg: "bg-indigo-50",
  },
  {
    name: "Monthly Revenue",
    value: "$127K",
    change: "+18%",
    icon: DollarSign,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
];

const projectHealthData = [
  { name: "Progressing", value: 78, color: "#10b981" },
  { name: "Stalled", value: 14, color: "#ef4444" },
  { name: "Market Ready", value: 27, color: "#f59e0b" },
];

const talentActivityData = [
  { skill: "Engineering", count: 145 },
  { skill: "Product", count: 87 },
  { skill: "Design", count: 62 },
  { skill: "Marketing", count: 48 },
];

const aiOperationsData = [
  { month: "Jan", automated: 1240, manual: 3200 },
  { month: "Feb", automated: 1890, manual: 2850 },
  { month: "Mar", automated: 2340, manual: 2100 },
  { month: "Apr", automated: 2890, manual: 1450 },
];

const recentActivity = [
  {
    type: "success",
    message: "Project Alpha launched to market",
    time: "2 hours ago",
  },
  {
    type: "info",
    message: "New cohort Q2-2026 started with 12 startups",
    time: "4 hours ago",
  },
  {
    type: "success",
    message: "15 new contributors joined talent pool",
    time: "6 hours ago",
  },
  {
    type: "warning",
    message: "Project Beta needs attention - 7 days behind",
    time: "8 hours ago",
  },
];

export function Dashboard() {
  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">
          Organization Dashboard
        </h1>
        <p className="text-muted-foreground mt-2">
          Where Institutions Build, Manage, and Scale Innovation
        </p>
      </div>

      {/* Top Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.name}
              className="bg-background rounded-xl shadow-sm p-6 border border-border hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`${stat.bg} p-3 rounded-lg`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <span className="text-sm font-medium text-green-600">
                  {stat.change}
                </span>
              </div>
              <h3 className="text-2xl font-bold text-foreground">{stat.value}</h3>
              <p className="text-sm text-muted-foreground mt-1">{stat.name}</p>
            </div>
          );
        })}
      </div>

      {/* Middle Section - 3 Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Project Health Panel */}
        <div className="bg-background rounded-xl shadow-sm p-6 border border-border">
          <h2 className="text-lg font-bold text-foreground mb-6">
            Project Health
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={projectHealthData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {projectHealthData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-4">
            {projectHealthData.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-foreground">{item.name}</span>
                </div>
                <span className="text-sm font-medium text-foreground">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Talent Activity */}
        <div className="bg-background rounded-xl shadow-sm p-6 border border-border">
          <h2 className="text-lg font-bold text-foreground mb-6">
            Talent Activity
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={talentActivityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="skill" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Contributors</span>
              <span className="font-bold text-foreground">342</span>
            </div>
          </div>
        </div>

        {/* AI Operations Summary */}
        <div className="bg-background rounded-xl shadow-sm p-6 border border-border">
          <h2 className="text-lg font-bold text-foreground mb-6">
            AI Operations
          </h2>
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Tasks Automated</p>
              <p className="text-3xl font-bold text-foreground mt-1">7,360</p>
              <p className="text-xs text-green-600 mt-1">+34% vs last month</p>
            </div>
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">AI Actions Taken</p>
              <p className="text-3xl font-bold text-foreground mt-1">12.4K</p>
              <p className="text-xs text-green-600 mt-1">+28% vs last month</p>
            </div>
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Efficiency Gain</p>
              <p className="text-3xl font-bold text-foreground mt-1">67%</p>
              <p className="text-xs text-green-600 mt-1">+12% vs last month</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section - 2 Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI vs Manual Trend */}
        <div className="bg-background rounded-xl shadow-sm p-6 border border-border">
          <h2 className="text-lg font-bold text-foreground mb-6">
            Automation Trends
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={aiOperationsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="automated"
                stroke="#8b5cf6"
                strokeWidth={3}
                name="Automated Tasks"
              />
              <Line
                type="monotone"
                dataKey="manual"
                stroke="#94a3b8"
                strokeWidth={3}
                name="Manual Tasks"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Activity */}
        <div className="bg-background rounded-xl shadow-sm p-6 border border-border">
          <h2 className="text-lg font-bold text-foreground mb-6">
            Recent Activity
          </h2>
          <div className="space-y-4">
            {recentActivity.map((activity, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 pb-4 border-b border-border last:border-0"
              >
                {activity.type === "success" && (
                  <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                )}
                {activity.type === "info" && (
                  <Activity className="w-5 h-5 text-blue-500 mt-0.5" />
                )}
                {activity.type === "warning" && (
                  <AlertCircle className="w-5 h-5 text-orange-500 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="text-sm text-foreground">{activity.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
