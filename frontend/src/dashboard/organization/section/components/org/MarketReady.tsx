import {
  Rocket,
  TrendingUp,
  Target,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const portfolioScore = 78;

const projects = [
  {
    id: 1,
    name: "Project Alpha",
    category: "AI Platform",
    readiness: 68,
    status: "Progressing",
    team: "Engineering",
    gaps: ["Security audit", "Performance testing"],
    strengths: ["Product-market fit", "Tech stack", "Team"],
  },
  {
    id: 2,
    name: "Beta Commerce",
    category: "E-commerce",
    readiness: 87,
    status: "Near Ready",
    team: "Product",
    gaps: ["Marketing strategy"],
    strengths: ["MVP complete", "User testing", "Business model"],
  },
  {
    id: 3,
    name: "Gamma Analytics",
    category: "Data Analytics",
    readiness: 95,
    status: "Market Ready",
    team: "Engineering",
    gaps: [],
    strengths: ["Complete documentation", "Customer validation", "Scalable"],
  },
  {
    id: 4,
    name: "Delta Health",
    category: "HealthTech",
    readiness: 42,
    status: "At Risk",
    team: "Research",
    gaps: ["Market validation", "Tech debt", "Resource allocation"],
    strengths: ["Unique value proposition", "Expert team"],
  },
  {
    id: 5,
    name: "Epsilon Finance",
    category: "FinTech",
    readiness: 61,
    status: "Progressing",
    team: "Product",
    gaps: ["Compliance review", "Integration testing"],
    strengths: ["Clear roadmap", "Customer interest", "Funding secured"],
  },
];

const readinessDistribution = [
  { name: "0-40%", count: 15, color: "#ef4444" },
  { name: "41-60%", count: 32, color: "#f59e0b" },
  { name: "61-80%", count: 46, color: "#3b82f6" },
  { name: "81-100%", count: 34, color: "#10b981" },
];

const criteriaScores = [
  { criteria: "Product Quality", score: 85 },
  { criteria: "Market Fit", score: 78 },
  { criteria: "Team Strength", score: 92 },
  { criteria: "Business Model", score: 73 },
  { criteria: "Technical Execution", score: 88 },
  { criteria: "Go-to-Market", score: 65 },
];

const portfolioData = [
  { name: "Portfolio", value: portfolioScore, fill: "#8b5cf6" },
];

export function MarketReady() {
  return (
    <div className="p-6 lg:p-8 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Market Ready</h1>
        <p className="text-gray-600 mt-2">
          Track project readiness and portfolio health across your organization
        </p>
      </div>

      {/* Portfolio Score */}
      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-200 p-8 mb-8">
        <div className="flex flex-col lg:flex-row items-center gap-8">
          <div className="w-full lg:w-1/3">
            <ResponsiveContainer width="100%" height={200}>
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="60%"
                outerRadius="100%"
                data={portfolioData}
                startAngle={90}
                endAngle={-270}
              >
                <RadialBar
                  dataKey="value"
                  cornerRadius={10}
                  fill="#8b5cf6"
                  background={{ fill: "#e0e7ff" }}
                />
                <text
                  x="50%"
                  y="50%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-4xl font-bold fill-gray-900"
                >
                  {portfolioScore}
                </text>
              </RadialBarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Portfolio Score
            </h2>
            <p className="text-gray-700 mb-6">
              Average readiness across all {projects.length} active projects in
              your organization
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-4 border border-purple-200">
                <Rocket className="w-5 h-5 text-green-600 mb-2" />
                <p className="text-2xl font-bold text-gray-900">34</p>
                <p className="text-xs text-gray-600">Market Ready</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-purple-200">
                <TrendingUp className="w-5 h-5 text-blue-600 mb-2" />
                <p className="text-2xl font-bold text-gray-900">46</p>
                <p className="text-xs text-gray-600">Progressing</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-purple-200">
                <AlertCircle className="w-5 h-5 text-orange-600 mb-2" />
                <p className="text-2xl font-bold text-gray-900">32</p>
                <p className="text-xs text-gray-600">Need Work</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-purple-200">
                <Target className="w-5 h-5 text-purple-600 mb-2" />
                <p className="text-2xl font-bold text-gray-900">15</p>
                <p className="text-xs text-gray-600">Early Stage</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Projects List */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Project Readiness</h2>
        <div className="space-y-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
              <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                {/* Left: Project Info */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        {project.name}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {project.category} • {project.team} Team
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        project.status === "Market Ready"
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : project.status === "Near Ready"
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : project.status === "Progressing"
                          ? "bg-yellow-50 text-yellow-700 border border-yellow-200"
                          : "bg-red-50 text-red-700 border border-red-200"
                      }`}
                    >
                      {project.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-gray-900">
                          Strengths
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {project.strengths.map((strength) => (
                          <span
                            key={strength}
                            className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs"
                          >
                            {strength}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 text-orange-600" />
                        <span className="text-sm font-medium text-gray-900">
                          Gaps to Address
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {project.gaps.length > 0 ? (
                          project.gaps.map((gap) => (
                            <span
                              key={gap}
                              className="px-2 py-1 bg-orange-50 text-orange-700 rounded text-xs"
                            >
                              {gap}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-500 italic">
                            No gaps identified
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Readiness Score */}
                <div className="lg:w-48 flex flex-col items-center">
                  <div className="relative w-32 h-32 mb-2">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="#e5e7eb"
                        strokeWidth="8"
                        fill="none"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke={
                          project.readiness >= 80
                            ? "#10b981"
                            : project.readiness >= 60
                            ? "#3b82f6"
                            : project.readiness >= 40
                            ? "#f59e0b"
                            : "#ef4444"
                        }
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={`${(project.readiness / 100) * 351.86} 351.86`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-3xl font-bold text-gray-900">
                        {project.readiness}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 text-center">
                    Market Readiness
                  </p>
                  <button className="mt-3 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium w-full">
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Readiness Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6">
            Readiness Distribution
          </h2>
          <div className="flex items-center gap-6">
            <div className="w-1/2">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={readinessDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="count"
                  >
                    {readinessDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-3">
              {readinessDistribution.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-gray-700">{item.name}</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Criteria Scores */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6">
            Average Criteria Scores
          </h2>
          <div className="space-y-4">
            {criteriaScores.map((item) => (
              <div key={item.criteria}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-700">{item.criteria}</span>
                  <span className="text-sm font-bold text-gray-900">
                    {item.score}/100
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      item.score >= 80
                        ? "bg-green-500"
                        : item.score >= 60
                        ? "bg-blue-500"
                        : "bg-orange-500"
                    }`}
                    style={{ width: `${item.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
