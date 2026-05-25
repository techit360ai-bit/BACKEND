import {
  Plus,
  Settings,
  TrendingUp,
  Activity,
  Crown,
  Shield,
  UserCog,
  Briefcase,
} from "lucide-react";

const teams = [
  {
    id: 1,
    name: "Engineering",
    members: 87,
    projects: 34,
    performance: 92,
    role: "Core Development",
    activeMembers: 82,
    color: "bg-blue-500",
  },
  {
    id: 2,
    name: "Product",
    members: 45,
    projects: 28,
    performance: 88,
    role: "Product Strategy",
    activeMembers: 43,
    color: "bg-purple-500",
  },
  {
    id: 3,
    name: "Growth",
    members: 32,
    projects: 19,
    performance: 85,
    role: "Marketing & Sales",
    activeMembers: 30,
    color: "bg-green-500",
  },
  {
    id: 4,
    name: "Research",
    members: 28,
    projects: 15,
    performance: 90,
    role: "Innovation & R&D",
    activeMembers: 25,
    color: "bg-orange-500",
  },
  {
    id: 5,
    name: "Design",
    members: 24,
    projects: 21,
    performance: 89,
    role: "UX/UI Design",
    activeMembers: 24,
    color: "bg-pink-500",
  },
  {
    id: 6,
    name: "Operations",
    members: 19,
    projects: 12,
    performance: 87,
    role: "Business Operations",
    activeMembers: 18,
    color: "bg-indigo-500",
  },
];

const roles = [
  { name: "Admin", icon: Crown, description: "Full access", count: 12 },
  { name: "Manager", icon: Shield, description: "Team oversight", count: 34 },
  { name: "Contributor", icon: UserCog, description: "Project work", count: 267 },
  {
    name: "External",
    icon: Briefcase,
    description: "Collaborator",
    count: 29,
  },
];

const topPerformers = [
  { name: "Sarah Chen", team: "Engineering", score: 98, projects: 8 },
  { name: "Marcus Johnson", team: "Product", score: 96, projects: 12 },
  { name: "Elena Rodriguez", team: "Design", score: 95, projects: 9 },
  { name: "David Kim", team: "Growth", score: 94, projects: 7 },
  { name: "Aisha Patel", team: "Research", score: 93, projects: 6 },
];

export function Teams() {
  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Teams Management</h1>
          <p className="text-gray-600 mt-2">
            Organize, assign, and monitor team performance
          </p>
        </div>
        <button className="mt-4 sm:mt-0 inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
          <Plus className="w-5 h-5" />
          Create Team
        </button>
      </div>

      {/* Role Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {roles.map((role) => {
          const Icon = role.icon;
          return (
            <div
              key={role.name}
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-200"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-indigo-50 p-2 rounded-lg">
                  <Icon className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{role.name}</h3>
                  <p className="text-xs text-gray-500">{role.description}</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{role.count}</p>
            </div>
          );
        })}
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        {teams.map((team) => (
          <div
            key={team.id}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className={`h-2 ${team.color}`} />
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    {team.name}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">{team.role}</p>
                </div>
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <Settings className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600">Members</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {team.members}
                  </p>
                  <p className="text-xs text-green-600">
                    {team.activeMembers} active
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Projects</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {team.projects}
                  </p>
                  <p className="text-xs text-gray-500">assigned</p>
                </div>
              </div>

              <div className="mb-2">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-600">Performance</span>
                  <span className="font-bold text-gray-900">
                    {team.performance}%
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${team.color}`}
                    style={{ width: `${team.performance}%` }}
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button className="flex-1 px-4 py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium">
                  View Team
                </button>
                <button className="flex-1 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium">
                  Assign Project
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performers */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">Top Performers</h2>
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <div className="space-y-4">
            {topPerformers.map((performer, idx) => (
              <div
                key={idx}
                className="flex items-center gap-4 pb-4 border-b border-gray-100 last:border-0"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                  {performer.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{performer.name}</h4>
                  <p className="text-sm text-gray-600">{performer.team}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900">{performer.score}</p>
                  <p className="text-xs text-gray-500">
                    {performer.projects} projects
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Log */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">Recent Activity</h2>
            <Activity className="w-5 h-5 text-blue-500" />
          </div>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2" />
              <div>
                <p className="text-sm text-gray-900">
                  <span className="font-medium">Engineering</span> completed 3
                  projects
                </p>
                <p className="text-xs text-gray-500">2 hours ago</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
              <div>
                <p className="text-sm text-gray-900">
                  <span className="font-medium">Sarah Chen</span> joined Product
                  team
                </p>
                <p className="text-xs text-gray-500">4 hours ago</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-purple-500 rounded-full mt-2" />
              <div>
                <p className="text-sm text-gray-900">
                  <span className="font-medium">Growth</span> assigned to new
                  incubator program
                </p>
                <p className="text-xs text-gray-500">6 hours ago</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-orange-500 rounded-full mt-2" />
              <div>
                <p className="text-sm text-gray-900">
                  <span className="font-medium">Research</span> published new
                  findings
                </p>
                <p className="text-xs text-gray-500">8 hours ago</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-pink-500 rounded-full mt-2" />
              <div>
                <p className="text-sm text-gray-900">
                  <span className="font-medium">Design</span> completed UI for 5
                  projects
                </p>
                <p className="text-xs text-gray-500">10 hours ago</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
