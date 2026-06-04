import { Link } from "react-router-dom";
import { Users, TrendingUp, DollarSign, Award, ArrowRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/dashboard/investors/section/components/ui/card";
import { Progress } from "@/dashboard/investors/section/components/ui/progress";
import { Badge } from "@/dashboard/investors/section/components/ui/badge";
import { mockRooms, mockMentees, analyticsData } from "./data";
import { ACCENT_SOLID, ACCENT_TEXT, ACCENT_SOFT, HERO_GRADIENT } from "./theme";

const BASE = "/investor/mentorship";

export function Overview() {
  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className={`rounded-lg p-6 ${HERO_GRADIENT}`}>
        <h2 className="mb-2 text-2xl font-semibold">Welcome to TECHIT Mentorship</h2>
        <p className="mb-4 text-white/80">
          Run mentorship rooms for the founders you back — manage tasks, applications, analytics,
          payments, and multi-mentor coordination, all in one place.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link to={`${BASE}/create-room`}>
            <button className="rounded-lg bg-white px-4 py-2 text-sm text-blue-600 transition-colors hover:bg-blue-50 dark:text-emerald-700">
              Create Your First Room
            </button>
          </Link>
          <Link to={`${BASE}/applications`}>
            <button className="rounded-lg bg-white/20 px-4 py-2 text-sm text-white transition-colors hover:bg-white/30">
              View Applications (3 Pending)
            </button>
          </Link>
          <Link to={`${BASE}/hub`}>
            <button className="rounded-lg bg-white/20 px-4 py-2 text-sm text-white transition-colors hover:bg-white/30">
              Explore Advanced Hub
            </button>
          </Link>
        </div>
      </div>

      <div>
        <h1 className="mb-1 text-3xl">Dashboard</h1>
        <p className="text-muted-foreground">Manage your mentorship rooms and track progress</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Mentees</CardTitle>
            <Users className={`h-4 w-4 ${ACCENT_TEXT}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{analyticsData.activeMentees}</div>
            <p className="mt-1 text-xs text-muted-foreground">+2 from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">${analyticsData.totalRevenue.toLocaleString()}</div>
            <p className="mt-1 text-xs text-muted-foreground">+18% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Equity Distributed</CardTitle>
            <Award className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{analyticsData.equityDistributed}%</div>
            <p className="mt-1 text-xs text-muted-foreground">Across {analyticsData.totalMentees} mentees</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{analyticsData.averageProgress}%</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {analyticsData.tasksCompleted}/{analyticsData.totalTasks} tasks completed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Mentorship Rooms */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl">Your Mentorship Rooms</h2>
          <Link to={`${BASE}/create-room`} className={`flex items-center gap-1 text-sm ${ACCENT_TEXT}`}>
            Create New Room
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {mockRooms.map((room) => (
            <Card key={room.id} className="transition-shadow hover:shadow-lg">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="mb-2 text-lg">{room.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{room.description}</p>
                  </div>
                  <Badge variant={room.paymentModel === "equity" ? "default" : "secondary"}>
                    {room.paymentModel === "equity" ? `${room.equityPercentage}% Equity` : room.rate}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Mentees</span>
                  <span className="font-medium">
                    {room.menteeCount} / {room.capacity}
                  </span>
                </div>
                <Progress value={(room.menteeCount / room.capacity) * 100} />
                <div className="flex gap-2 pt-2">
                  <Link to={`${BASE}/room/${room.id}`} className="flex-1">
                    <button className={`w-full rounded-lg px-4 py-2 transition-colors ${ACCENT_SOLID}`}>
                      Open Room
                    </button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Mentees */}
      <div>
        <h2 className="mb-4 text-xl">Recent Mentees</h2>
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {mockMentees.map((mentee) => (
                <div key={mentee.id} className="p-4 transition-colors hover:bg-accent">
                  <div className="flex items-center gap-4">
                    <img
                      src={mentee.avatar}
                      alt={mentee.name}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <h3 className="font-medium">{mentee.name}</h3>
                        <Badge variant={mentee.status === "active" ? "default" : "secondary"}>
                          {mentee.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{mentee.goals}</p>
                      <div className="mt-2 flex gap-2">
                        {mentee.skills.slice(0, 3).map((skill) => (
                          <span key={skill} className={`rounded px-2 py-1 text-xs ${ACCENT_SOFT}`}>
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="mb-1 text-sm text-muted-foreground">Progress</div>
                      <div className={`text-lg font-semibold ${ACCENT_TEXT}`}>{mentee.progress}%</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
