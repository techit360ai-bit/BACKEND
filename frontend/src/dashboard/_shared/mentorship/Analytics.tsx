import { TrendingUp, Users, CheckCircle, DollarSign } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/dashboard/investors/section/components/ui/card";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { analyticsData, mockMentees } from "./data";
import { ACCENT_FILL, ACCENT_TEXT, CHART_PRIMARY, CHART_SECONDARY } from "./theme";

export function Analytics() {
  const taskCompletionRate = (
    (analyticsData.tasksCompleted / analyticsData.totalTasks) *
    100
  ).toFixed(1);

  // Recharts axes/grid don't read CSS tokens; use muted neutrals that read on
  // both light and dark surfaces. `currentColor` ticks inherit text-muted color.
  const axisTick = { fill: "currentColor", fontSize: 12 };
  const gridStroke = "rgba(127,127,127,0.2)";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 text-3xl">Analytics &amp; Insights</h1>
        <p className="text-muted-foreground">Track your mentorship performance and growth</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Mentees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-1 text-3xl font-semibold">{analyticsData.totalMentees}</div>
            <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
              <TrendingUp className="h-4 w-4" />
              <span>+25% from last quarter</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Mentees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-1 text-3xl font-semibold">{analyticsData.activeMentees}</div>
            <div className="text-sm text-muted-foreground">
              {analyticsData.completedMentees} completed programs
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-1 text-3xl font-semibold">
              ${analyticsData.totalRevenue.toLocaleString()}
            </div>
            <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
              <TrendingUp className="h-4 w-4" />
              <span>+22% from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Task Completion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-1 text-3xl font-semibold">{taskCompletionRate}%</div>
            <div className="text-sm text-muted-foreground">
              {analyticsData.tasksCompleted} of {analyticsData.totalTasks} tasks
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Growth Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Growth</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analyticsData.monthlyGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="month" tick={axisTick} stroke={gridStroke} />
                <YAxis tick={axisTick} stroke={gridStroke} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--popover-foreground)",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke={CHART_PRIMARY}
                  strokeWidth={2}
                  name="Revenue ($)"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mentee Growth</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analyticsData.monthlyGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="month" tick={axisTick} stroke={gridStroke} />
                <YAxis tick={axisTick} stroke={gridStroke} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--popover-foreground)",
                  }}
                  cursor={{ fill: "rgba(127,127,127,0.1)" }}
                />
                <Legend />
                <Bar dataKey="mentees" fill={CHART_SECONDARY} name="Total Mentees" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Mentee Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Mentee Progress Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockMentees.map((mentee) => (
              <div key={mentee.id} className="flex items-center gap-4">
                <img
                  src={mentee.avatar}
                  alt={mentee.name}
                  className="h-12 w-12 rounded-full object-cover"
                />
                <div className="flex-1">
                  <div className="mb-1 flex items-center justify-between">
                    <h4 className="font-medium">{mentee.name}</h4>
                    <span className="text-sm font-medium">{mentee.progress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full transition-all duration-300 ${ACCENT_FILL}`}
                      style={{ width: `${mentee.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className={`h-5 w-5 ${ACCENT_TEXT}`} />
              <CardTitle>Retention Rate</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-2 text-3xl font-semibold">94%</div>
            <p className="text-sm text-muted-foreground">Mentees continue past 3 months</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <CardTitle>Success Rate</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-2 text-3xl font-semibold">87%</div>
            <p className="text-sm text-muted-foreground">Mentees achieve their goals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <CardTitle>Avg. Revenue/Mentee</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-2 text-3xl font-semibold">$2,042</div>
            <p className="text-sm text-muted-foreground">Per month across all rooms</p>
          </CardContent>
        </Card>
      </div>

      {/* Equity Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Equity Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-purple-50 p-3 dark:bg-purple-500/10">
              <div>
                <h4 className="font-medium">Total Equity Distributed</h4>
                <p className="text-sm text-muted-foreground">Across all equity-based mentorships</p>
              </div>
              <div className="text-2xl font-semibold text-purple-600 dark:text-purple-400">
                {analyticsData.equityDistributed}%
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border p-3">
                <div className="text-sm text-muted-foreground">Average per mentee</div>
                <div className="text-xl font-semibold">
                  {(analyticsData.equityDistributed / analyticsData.totalMentees).toFixed(2)}%
                </div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-sm text-muted-foreground">Equity rooms</div>
                <div className="text-xl font-semibold">2</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-sm text-muted-foreground">Active equity deals</div>
                <div className="text-xl font-semibold">5</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
