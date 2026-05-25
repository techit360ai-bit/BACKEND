import {
  Search,
  Filter,
  Star,
  Briefcase,
  MapPin,
  TrendingUp,
  CheckCircle2,
  Award,
  Code,
  Palette,
  Rocket,
  Users,
} from "lucide-react";

const talents = [
  {
    id: 1,
    name: "Alex Rivera",
    role: "Full Stack Engineer",
    location: "San Francisco, CA",
    reputation: 98,
    skills: ["React", "Node.js", "AI/ML", "Web3"],
    availability: "Available",
    velocity: 94,
    projects: 23,
    successRate: 96,
    hourlyRate: "$120/hr",
    avatar: "AR",
  },
  {
    id: 2,
    name: "Priya Sharma",
    role: "Product Designer",
    location: "London, UK",
    reputation: 95,
    skills: ["Figma", "User Research", "Prototyping", "Branding"],
    availability: "Available",
    velocity: 91,
    projects: 18,
    successRate: 94,
    hourlyRate: "$95/hr",
    avatar: "PS",
  },
  {
    id: 3,
    name: "Jordan Lee",
    role: "AI/ML Engineer",
    location: "Singapore",
    reputation: 97,
    skills: ["Python", "TensorFlow", "NLP", "Computer Vision"],
    availability: "Busy",
    velocity: 96,
    projects: 15,
    successRate: 98,
    hourlyRate: "$140/hr",
    avatar: "JL",
  },
  {
    id: 4,
    name: "Maria Garcia",
    role: "Growth Marketer",
    location: "Barcelona, Spain",
    reputation: 92,
    skills: ["SEO", "Content", "Analytics", "Paid Ads"],
    availability: "Available",
    velocity: 88,
    projects: 27,
    successRate: 91,
    hourlyRate: "$85/hr",
    avatar: "MG",
  },
  {
    id: 5,
    name: "Chen Wei",
    role: "Blockchain Developer",
    location: "Hong Kong",
    reputation: 96,
    skills: ["Solidity", "Web3.js", "Smart Contracts", "DeFi"],
    availability: "Available",
    velocity: 93,
    projects: 12,
    successRate: 97,
    hourlyRate: "$135/hr",
    avatar: "CW",
  },
  {
    id: 6,
    name: "Emma Watson",
    role: "Backend Engineer",
    location: "Toronto, Canada",
    reputation: 94,
    skills: ["Go", "Kubernetes", "PostgreSQL", "GraphQL"],
    availability: "Busy",
    velocity: 90,
    projects: 19,
    successRate: 95,
    hourlyRate: "$115/hr",
    avatar: "EW",
  },
];

const skillCategories = [
  { name: "Engineering", count: 145, icon: Code, color: "text-blue-600", bg: "bg-blue-50" },
  { name: "Product", count: 87, icon: Briefcase, color: "text-purple-600", bg: "bg-purple-50" },
  { name: "Design", count: 62, icon: Palette, color: "text-pink-600", bg: "bg-pink-50" },
  { name: "Growth", count: 48, icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
];

const topTalents = [
  { name: "Alex Rivera", score: 98, specialty: "Full Stack" },
  { name: "Jordan Lee", score: 97, specialty: "AI/ML" },
  { name: "Chen Wei", score: 96, specialty: "Blockchain" },
  { name: "Priya Sharma", score: 95, specialty: "Design" },
  { name: "Emma Watson", score: 94, specialty: "Backend" },
];

export function TalentPool() {
  return (
    <div className="p-6 lg:p-8 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Talent Pool</h1>
          <p className="text-gray-600 mt-2">
            Discover, hire, and manage top builders for your projects
          </p>
        </div>
        <button className="mt-4 sm:mt-0 inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
          <Users className="w-5 h-5" />
          Invite Talent
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {skillCategories.map((category) => {
          const Icon = category.icon;
          return (
            <div
              key={category.name}
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-200"
            >
              <div className={`${category.bg} p-3 rounded-lg inline-block mb-3`}>
                <Icon className={`w-6 h-6 ${category.color}`} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{category.count}</p>
              <p className="text-sm text-gray-600 mt-1">{category.name} Talent</p>
            </div>
          );
        })}
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, skills, or location..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Filter className="w-5 h-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Filters</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <button className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-medium border border-indigo-200">
            Available Only
          </button>
          <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
            High Reputation (90+)
          </button>
          <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
            Fast Velocity
          </button>
          <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
            AI/ML Experts
          </button>
        </div>
      </div>

      {/* Talent Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {talents.map((talent) => (
          <div
            key={talent.id}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center text-white text-xl font-bold">
                {talent.avatar}
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {talent.name}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">{talent.role}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      talent.availability === "Available"
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : "bg-orange-50 text-orange-700 border border-orange-200"
                    }`}
                  >
                    {talent.availability}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  <MapPin className="w-3 h-3 text-gray-500" />
                  <span className="text-xs text-gray-600">{talent.location}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center gap-1 bg-yellow-50 px-3 py-1 rounded-lg border border-yellow-200">
                <Star className="w-4 h-4 text-yellow-600 fill-yellow-600" />
                <span className="text-sm font-bold text-yellow-900">
                  {talent.reputation}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                <TrendingUp className="w-3 h-3 inline mr-1 text-green-600" />
                Velocity: {talent.velocity}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {talent.skills.map((skill) => (
                <span
                  key={skill}
                  className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium"
                >
                  {skill}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4 py-4 border-y border-gray-200">
              <div>
                <p className="text-xs text-gray-600 mb-1">Projects</p>
                <p className="font-bold text-gray-900">{talent.projects}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Success Rate</p>
                <p className="font-bold text-gray-900">{talent.successRate}%</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Rate</p>
                <p className="font-bold text-gray-900">{talent.hourlyRate}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
                Hire
              </button>
              <button className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                View Profile
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Talent Leaderboard */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">Top Talent</h2>
            <Award className="w-5 h-5 text-yellow-500" />
          </div>
          <div className="space-y-4">
            {topTalents.map((talent, idx) => (
              <div
                key={idx}
                className="flex items-center gap-4 pb-4 border-b border-gray-100 last:border-0"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    idx === 0
                      ? "bg-yellow-100 text-yellow-700"
                      : idx === 1
                      ? "bg-gray-200 text-gray-700"
                      : idx === 2
                      ? "bg-orange-100 text-orange-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  #{idx + 1}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{talent.name}</h4>
                  <p className="text-xs text-gray-600">{talent.specialty}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  <span className="font-bold text-gray-900">{talent.score}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Hires */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">Recent Activity</h2>
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          </div>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
              <div>
                <p className="text-sm text-gray-900">
                  <span className="font-medium">Alex Rivera</span> assigned to
                  Project Alpha
                </p>
                <p className="text-xs text-gray-500 mt-1">2 hours ago</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
              <div>
                <p className="text-sm text-gray-900">
                  <span className="font-medium">Priya Sharma</span> completed
                  design system
                </p>
                <p className="text-xs text-gray-500 mt-1">5 hours ago</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
              <div>
                <p className="text-sm text-gray-900">
                  <span className="font-medium">Chen Wei</span> joined Web3
                  Builders Program
                </p>
                <p className="text-xs text-gray-500 mt-1">1 day ago</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Rocket className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <p className="text-sm text-gray-900">
                  15 new talents joined the pool
                </p>
                <p className="text-xs text-gray-500 mt-1">2 days ago</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
