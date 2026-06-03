import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  TrendingUp,
  Clock,
  AlertCircle,
  Rocket,
  Users,
} from "lucide-react";

const projects = [
  {
    id: 1,
    name: "Project Alpha",
    category: "AI Platform",
    team: "Engineering",
    stage: "Development",
    progress: 75,
    status: "on-track",
    members: 12,
    aiLevel: "High",
    marketReadyScore: 68,
    lastUpdate: "2 hours ago",
  },
  {
    id: 2,
    name: "Beta Commerce",
    category: "E-commerce",
    team: "Product",
    stage: "Testing",
    progress: 92,
    status: "on-track",
    members: 8,
    aiLevel: "Medium",
    marketReadyScore: 87,
    lastUpdate: "5 hours ago",
  },
  {
    id: 3,
    name: "Gamma Analytics",
    category: "Data Analytics",
    team: "Engineering",
    stage: "Market Ready",
    progress: 98,
    status: "completed",
    members: 15,
    aiLevel: "High",
    marketReadyScore: 95,
    lastUpdate: "1 day ago",
  },
  {
    id: 4,
    name: "Delta Health",
    category: "HealthTech",
    team: "Research",
    stage: "Validation",
    progress: 45,
    status: "at-risk",
    members: 10,
    aiLevel: "Medium",
    marketReadyScore: 42,
    lastUpdate: "12 hours ago",
  },
  {
    id: 5,
    name: "Epsilon Finance",
    category: "FinTech",
    team: "Product",
    stage: "Development",
    progress: 65,
    status: "on-track",
    members: 14,
    aiLevel: "High",
    marketReadyScore: 61,
    lastUpdate: "3 hours ago",
  },
  {
    id: 6,
    name: "Zeta Learning",
    category: "EdTech",
    team: "Growth",
    stage: "Idea",
    progress: 18,
    status: "on-track",
    members: 6,
    aiLevel: "Low",
    marketReadyScore: 15,
    lastUpdate: "8 hours ago",
  },
];

const stages = ["Idea", "Validation", "Development", "Testing", "Market Ready"];

const statusConfig = {
  "on-track": {
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
    label: "On Track",
  },
  "at-risk": {
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    label: "At Risk",
  },
  completed: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    label: "Completed",
  },
};

export function Projects() {
  return (
    <div className="p-6 lg:p-8 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Projects Management
          </h1>
          <p className="text-muted-foreground mt-2">
            Create, track, and scale your innovation portfolio
          </p>
        </div>
        <button className="mt-4 sm:mt-0 inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
          <Plus className="w-5 h-5" />
          Create Project
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-background rounded-xl shadow-sm p-6 border border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Total Projects</p>
            <TrendingUp className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-foreground">127</p>
          <p className="text-sm text-green-600 mt-1">+12 this month</p>
        </div>
        <div className="bg-background rounded-xl shadow-sm p-6 border border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">In Progress</p>
            <Clock className="w-5 h-5 text-orange-500" />
          </div>
          <p className="text-3xl font-bold text-foreground">89</p>
          <p className="text-sm text-muted-foreground mt-1">70% of total</p>
        </div>
        <div className="bg-background rounded-xl shadow-sm p-6 border border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Market Ready</p>
            <Rocket className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-foreground">34</p>
          <p className="text-sm text-green-600 mt-1">+6 this month</p>
        </div>
        <div className="bg-background rounded-xl shadow-sm p-6 border border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">At Risk</p>
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-3xl font-bold text-foreground">4</p>
          <p className="text-sm text-muted-foreground mt-1">Need attention</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-background rounded-xl shadow-sm border border-border p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/70" />
            <input
              type="text"
              placeholder="Search projects..."
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-background transition-colors">
            <Filter className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Filters</span>
          </button>
        </div>
      </div>

      {/* Stage Pipeline */}
      <div className="bg-background rounded-xl shadow-sm border border-border p-6 mb-6">
        <h2 className="text-lg font-bold text-foreground mb-4">
          Project Pipeline
        </h2>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {stages.map((stage, idx) => (
            <div key={stage} className="flex items-center gap-2">
              <div className="bg-indigo-50 px-4 py-2 rounded-lg border-2 border-indigo-200 whitespace-nowrap">
                <p className="text-sm font-medium text-indigo-900">{stage}</p>
                <p className="text-xs text-indigo-600 mt-1">
                  {
                    projects.filter((p) => p.stage === stage).length
                  }{" "}
                  projects
                </p>
              </div>
              {idx < stages.length - 1 && (
                <div className="w-6 h-0.5 bg-muted" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Projects List */}
      <div className="space-y-4">
        {projects.map((project) => {
          const statusStyle = statusConfig[project.status as keyof typeof statusConfig];
          return (
            <div
              key={project.id}
              className="bg-background rounded-xl shadow-sm border border-border p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                {/* Left: Project Info */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-foreground">
                        {project.name}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {project.category} • {project.team} Team
                      </p>
                    </div>
                    <button className="p-2 hover:bg-muted/40 rounded-lg transition-colors">
                      <MoreVertical className="w-5 h-5 text-muted-foreground" />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                    >
                      {statusStyle.label}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-muted/40 text-foreground">
                      {project.stage}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                      AI: {project.aiLevel}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Progress</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted/40 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500"
                            style={{ width: `${project.progress}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-foreground">
                          {project.progress}%
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Market Ready</p>
                      <p className="text-lg font-bold text-foreground">
                        {project.marketReadyScore}
                        <span className="text-sm text-muted-foreground">/100</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Team Size</p>
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <p className="text-lg font-bold text-foreground">
                          {project.members}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Last Update</p>
                      <p className="text-sm text-foreground">
                        {project.lastUpdate}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex lg:flex-col gap-2">
                  <button className="flex-1 lg:flex-initial px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium whitespace-nowrap">
                    View Workspace
                  </button>
                  <button className="flex-1 lg:flex-initial px-4 py-2 border border-border text-foreground rounded-lg hover:bg-background transition-colors text-sm font-medium whitespace-nowrap">
                    View Details
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
