import {
  Plus,
  Calendar,
  Users,
  TrendingUp,
  GraduationCap,
  Target,
  Award,
  CheckCircle2,
  Clock,
  BookOpen,
} from "lucide-react";

const programs = [
  {
    id: 1,
    name: "Q2 2026 Accelerator",
    duration: "12 weeks",
    cohortSize: 15,
    enrolled: 15,
    status: "Active",
    startDate: "Apr 1, 2026",
    endDate: "Jun 24, 2026",
    progress: 45,
    curriculum: "AI-Driven Innovation",
    mentors: 8,
    marketReady: 7,
  },
  {
    id: 2,
    name: "Web3 Builders Program",
    duration: "16 weeks",
    cohortSize: 12,
    enrolled: 11,
    status: "Active",
    startDate: "Mar 15, 2026",
    endDate: "Jul 1, 2026",
    progress: 62,
    curriculum: "Blockchain Development",
    mentors: 6,
    marketReady: 5,
  },
  {
    id: 3,
    name: "Internal Innovation Lab",
    duration: "8 weeks",
    cohortSize: 20,
    enrolled: 20,
    status: "Active",
    startDate: "Apr 7, 2026",
    endDate: "Jun 2, 2026",
    progress: 38,
    curriculum: "Custom Internal",
    mentors: 12,
    marketReady: 3,
  },
  {
    id: 4,
    name: "SaaS Bootcamp",
    duration: "10 weeks",
    cohortSize: 18,
    enrolled: 0,
    status: "Upcoming",
    startDate: "May 1, 2026",
    endDate: "Jul 10, 2026",
    progress: 0,
    curriculum: "Product-Market Fit",
    mentors: 10,
    marketReady: 0,
  },
];

const cohortStartups = [
  {
    name: "NeuralFlow AI",
    program: "Q2 2026 Accelerator",
    stage: "Testing",
    readiness: 78,
    mentor: "Dr. Sarah Chen",
  },
  {
    name: "ChainVault",
    program: "Web3 Builders Program",
    stage: "Market Ready",
    readiness: 92,
    mentor: "Marcus Johnson",
  },
  {
    name: "CloudSync Pro",
    program: "Q2 2026 Accelerator",
    stage: "Development",
    readiness: 65,
    mentor: "Elena Rodriguez",
  },
  {
    name: "DataPulse",
    program: "Internal Innovation Lab",
    stage: "Validation",
    readiness: 54,
    mentor: "David Kim",
  },
  {
    name: "FinTech Bridge",
    program: "Web3 Builders Program",
    stage: "Development",
    readiness: 71,
    mentor: "Aisha Patel",
  },
];

const weeklyReports = [
  {
    program: "Q2 2026 Accelerator",
    week: "Week 6",
    highlights: "3 startups completed MVP",
    attendance: "98%",
    date: "Last Monday",
  },
  {
    program: "Web3 Builders Program",
    week: "Week 10",
    highlights: "2 secured partnerships",
    attendance: "95%",
    date: "Last Monday",
  },
  {
    program: "Internal Innovation Lab",
    week: "Week 3",
    highlights: "All teams validated concepts",
    attendance: "100%",
    date: "Last Monday",
  },
];

export function Incubator() {
  return (
    <div className="p-6 lg:p-8 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Incubator Programs
          </h1>
          <p className="text-gray-600 mt-2">
            Run innovation programs, accelerators, and cohort-based learning
          </p>
        </div>
        <button className="mt-4 sm:mt-0 inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
          <Plus className="w-5 h-5" />
          Create Program
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Active Programs</p>
            <GraduationCap className="w-5 h-5 text-indigo-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">8</p>
          <p className="text-sm text-green-600 mt-1">+2 this quarter</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Total Startups</p>
            <Target className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">127</p>
          <p className="text-sm text-gray-600 mt-1">Across all cohorts</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Success Rate</p>
            <Award className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">73%</p>
          <p className="text-sm text-green-600 mt-1">Market ready outcomes</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Active Mentors</p>
            <Users className="w-5 h-5 text-purple-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">36</p>
          <p className="text-sm text-gray-600 mt-1">Supporting cohorts</p>
        </div>
      </div>

      {/* Programs Grid */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Your Programs
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {programs.map((program) => (
            <div
              key={program.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {program.name}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {program.curriculum}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    program.status === "Active"
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-blue-50 text-blue-700 border border-blue-200"
                  }`}
                >
                  {program.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Duration</p>
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4 text-gray-600" />
                    <p className="text-sm font-medium text-gray-900">
                      {program.duration}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Cohort Size</p>
                  <p className="text-sm font-medium text-gray-900">
                    {program.enrolled}/{program.cohortSize} enrolled
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Mentors</p>
                  <p className="text-sm font-medium text-gray-900">
                    {program.mentors} assigned
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Market Ready</p>
                  <p className="text-sm font-medium text-gray-900">
                    {program.marketReady} startups
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-gray-600">Program Progress</span>
                  <span className="font-medium text-gray-900">
                    {program.progress}%
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                    style={{ width: `${program.progress}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-600 mb-4 pb-4 border-b border-gray-200">
                <span>
                  <Calendar className="w-3 h-3 inline mr-1" />
                  {program.startDate}
                </span>
                <span>→</span>
                <span>{program.endDate}</span>
              </div>

              <div className="flex gap-2">
                <button className="flex-1 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium">
                  View Cohort
                </button>
                <button className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                  Manage
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cohort Startups */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">
              Cohort Startups
            </h2>
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <div className="space-y-4">
            {cohortStartups.map((startup, idx) => (
              <div
                key={idx}
                className="pb-4 border-b border-gray-100 last:border-0"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-medium text-gray-900">{startup.name}</h4>
                    <p className="text-xs text-gray-600 mt-1">
                      {startup.program}
                    </p>
                  </div>
                  <span className="text-xs font-medium px-2 py-1 bg-gray-100 text-gray-700 rounded">
                    {startup.stage}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-600">
                    Mentor: {startup.mentor}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500"
                        style={{ width: `${startup.readiness}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-900">
                      {startup.readiness}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly Reports */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">Weekly Reports</h2>
            <BookOpen className="w-5 h-5 text-blue-500" />
          </div>
          <div className="space-y-4">
            {weeklyReports.map((report, idx) => (
              <div
                key={idx}
                className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {report.program}
                    </h4>
                    <p className="text-sm text-indigo-600 mt-1">
                      {report.week}
                    </p>
                  </div>
                  <span className="text-xs text-gray-600">{report.date}</span>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <p className="text-sm text-gray-700">{report.highlights}</p>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  Attendance: <span className="font-medium">{report.attendance}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* White Label Info */}
      <div className="mt-8 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200 p-6">
        <div className="flex items-start gap-4">
          <div className="bg-white p-3 rounded-lg">
            <Award className="w-6 h-6 text-purple-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 mb-2">
              White-Label Your Incubator
            </h3>
            <p className="text-sm text-gray-700 mb-4">
              Brand TechIT as your own innovation platform. Offer programs
              publicly with custom curriculum and full control.
            </p>
            <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium">
              Learn More
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
