import { TrendingUp, TrendingDown, DollarSign, CheckCircle2, Clock, Download } from 'lucide-react';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Badge } from '../components/ui/badge';

const contributorData = [
  {
    id: 1,
    name: 'Sarah Chen',
    avatar: 'SC',
    color: 'bg-blue-500',
    timeSpent: 87,
    tasksCompleted: 23,
    powerScore: 94,
    trend: 'up',
    revenue: 12540,
  },
  {
    id: 2,
    name: 'Mike Johnson',
    avatar: 'MJ',
    color: 'bg-green-500',
    timeSpent: 76,
    tasksCompleted: 19,
    powerScore: 88,
    trend: 'up',
    revenue: 10890,
  },
  {
    id: 3,
    name: 'Alex Kim',
    avatar: 'AK',
    color: 'bg-purple-500',
    timeSpent: 68,
    tasksCompleted: 17,
    powerScore: 82,
    trend: 'down',
    revenue: 9760,
  },
  {
    id: 4,
    name: 'Emma Wilson',
    avatar: 'EW',
    color: 'bg-pink-500',
    timeSpent: 64,
    tasksCompleted: 15,
    powerScore: 79,
    trend: 'up',
    revenue: 9120,
  },
  {
    id: 5,
    name: 'David Lee',
    avatar: 'DL',
    color: 'bg-yellow-500',
    timeSpent: 52,
    tasksCompleted: 12,
    powerScore: 71,
    trend: 'up',
    revenue: 7480,
  },
];

const activityData = [
  { day: 'Mon', hours: 7.5 },
  { day: 'Tue', hours: 8.2 },
  { day: 'Wed', hours: 6.8 },
  { day: 'Thu', hours: 9.1 },
  { day: 'Fri', hours: 7.9 },
  { day: 'Sat', hours: 3.5 },
  { day: 'Sun', hours: 2.0 },
];

export function Reports() {
  const totalContributions = contributorData.reduce((sum, c) => sum + c.tasksCompleted, 0);
  const totalRevenue = contributorData.reduce((sum, c) => sum + c.revenue, 0);
  const totalHours = contributorData.reduce((sum, c) => sum + c.timeSpent, 0);

  return (
    <div className="h-full bg-background overflow-auto">
      {/* Page Header */}
      <div className="bg-background border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Contribution Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Team performance metrics for February 2026
            </p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#2196F3] text-white rounded-lg hover:bg-[#2196F3]/90 transition-colors shadow-sm">
            <Download className="w-4 h-4" />
            <span className="text-sm font-medium">Export Report</span>
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Top Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Total Contributions */}
          <div className="bg-background rounded-xl p-6 shadow-sm border border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-[#2196F3]/10 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-[#2196F3]" />
              </div>
              <Badge className="bg-[#10B981] text-white">+12%</Badge>
            </div>
            <div className="text-3xl font-bold mb-1">{totalContributions}</div>
            <div className="text-sm text-muted-foreground">Total Contributions</div>
            <div className="text-xs text-muted-foreground mt-2">This month</div>
          </div>

          {/* Revenue Share */}
          <div className="bg-background rounded-xl p-6 shadow-sm border border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-[#10B981]/10 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-[#10B981]" />
              </div>
              <Badge className="bg-[#10B981] text-white">+8%</Badge>
            </div>
            <div className="text-3xl font-bold mb-1">${(totalRevenue / 1000).toFixed(1)}k</div>
            <div className="text-sm text-muted-foreground">Revenue Share</div>
            <div className="text-xs text-muted-foreground mt-2">Total allocated</div>
          </div>

          {/* Active Hours */}
          <div className="bg-background rounded-xl p-6 shadow-sm border border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-[#F59E0B]/10 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-[#F59E0B]" />
              </div>
              <Badge className="bg-[#F59E0B] text-white">+5%</Badge>
            </div>
            <div className="text-3xl font-bold mb-1">{totalHours}h</div>
            <div className="text-sm text-muted-foreground">Active Hours</div>
            <div className="text-xs text-muted-foreground mt-2">Team total</div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Leaderboard */}
          <div className="lg:col-span-2 bg-background rounded-xl shadow-sm border border-border">
            <div className="p-6 border-b border-border">
              <h2 className="font-semibold text-lg">Contribution Leaderboard</h2>
              <p className="text-sm text-muted-foreground mt-1">Top performers this month</p>
            </div>
            <div className="p-6">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-muted-foreground border-b">
                    <th className="pb-3 font-medium">Contributor</th>
                    <th className="pb-3 font-medium">Time Spent</th>
                    <th className="pb-3 font-medium">Tasks</th>
                    <th className="pb-3 font-medium">Power Score</th>
                    <th className="pb-3 font-medium">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {contributorData.map((contributor, idx) => (
                    <tr key={contributor.id} className="border-b last:border-0 hover:bg-background transition-colors">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar className="w-10 h-10">
                              <AvatarFallback className={`${contributor.color} text-white`}>
                                {contributor.avatar}
                              </AvatarFallback>
                            </Avatar>
                            {idx < 3 && (
                              <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#FFD700] rounded-full flex items-center justify-center text-xs font-bold text-black">
                                {idx + 1}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-medium">{contributor.name}</div>
                            <div className="text-xs text-muted-foreground">${(contributor.revenue / 1000).toFixed(1)}k revenue</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 max-w-[100px] h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#2196F3] rounded-full"
                              style={{ width: `${contributor.timeSpent}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{contributor.timeSpent}h</span>
                        </div>
                      </td>
                      <td className="py-4">
                        <span className="font-medium">{contributor.tasksCompleted}</span>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <div className="relative w-12 h-12">
                            <svg className="w-12 h-12 transform -rotate-90">
                              <circle
                                cx="24"
                                cy="24"
                                r="20"
                                stroke="currentColor"
                                strokeWidth="4"
                                fill="none"
                                className="text-foreground/80"
                              />
                              <circle
                                cx="24"
                                cy="24"
                                r="20"
                                stroke="currentColor"
                                strokeWidth="4"
                                fill="none"
                                strokeDasharray={`${2 * Math.PI * 20}`}
                                strokeDashoffset={`${2 * Math.PI * 20 * (1 - contributor.powerScore / 100)}`}
                                className="text-[#2196F3]"
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                              {contributor.powerScore}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4">
                        {contributor.trend === 'up' ? (
                          <TrendingUp className="w-5 h-5 text-[#10B981]" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-red-500" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Activity Chart */}
          <div className="bg-background rounded-xl shadow-sm border border-border">
            <div className="p-6 border-b border-border">
              <h2 className="font-semibold text-lg">Weekly Activity</h2>
              <p className="text-sm text-muted-foreground mt-1">Hours logged per day</p>
            </div>
            <div className="p-6">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '8px 12px',
                    }}
                  />
                  <Bar dataKey="hours" radius={[8, 8, 0, 0]}>
                    {activityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="#2196F3" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Activity Heatmap Legend */}
              <div className="mt-6 p-4 bg-background rounded-lg">
                <div className="text-sm font-medium mb-2">Activity Level</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gradient-to-r from-gray-200 via-[#2196F3]/50 to-[#2196F3] rounded-full" />
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span>Low</span>
                    <span>High</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
