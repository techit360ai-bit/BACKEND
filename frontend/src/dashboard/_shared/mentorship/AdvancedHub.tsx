import { Users, Star, Globe, TrendingUp, Plus } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/dashboard/investors/section/components/ui/card";
import { Badge } from "@/dashboard/investors/section/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/dashboard/investors/section/components/ui/tabs";
import { ACCENT_SOLID, NEUTRAL_BTN, HUB_GRADIENT, statusBadge } from "./theme";

interface CoMentor {
  id: string;
  name: string;
  avatar: string;
  expertise: string[];
  rating: number;
  mentees: number;
  status: "active" | "invited" | "pending";
}

const mockCoMentors: CoMentor[] = [
  {
    id: "1",
    name: "Jessica Martinez",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150",
    expertise: ["Marketing", "Growth Hacking", "SEO"],
    rating: 4.9,
    mentees: 8,
    status: "active",
  },
  {
    id: "2",
    name: "Robert Kim",
    avatar: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=150",
    expertise: ["Backend", "DevOps", "Cloud Architecture"],
    rating: 4.8,
    mentees: 6,
    status: "active",
  },
];

const purpleChip = "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400";

export function AdvancedHub() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`rounded-lg p-6 ${HUB_GRADIENT}`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Star className="h-6 w-6" />
              <h1 className="text-3xl">Advanced Mentorship Hub</h1>
            </div>
            <p className="mb-4 text-white/80">
              Coordinate with co-mentors and scale your mentorship impact
            </p>
            <div className="flex gap-4">
              <div className="rounded-lg bg-white/20 px-4 py-2">
                <div className="text-sm text-white/80">Co-Mentors</div>
                <div className="text-xl font-semibold">{mockCoMentors.length}</div>
              </div>
              <div className="rounded-lg bg-white/20 px-4 py-2">
                <div className="text-sm text-white/80">Total Reach</div>
                <div className="text-xl font-semibold">
                  {mockCoMentors.reduce((sum, m) => sum + m.mentees, 0) + 12}
                </div>
              </div>
            </div>
          </div>
          <button className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-purple-600 transition-colors hover:bg-purple-50">
            <Plus className="h-4 w-4" />
            Invite Co-Mentor
          </button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="co-mentors">Co-Mentors</TabsTrigger>
          <TabsTrigger value="coordination">Coordination</TabsTrigger>
          <TabsTrigger value="matching">Mentee Matching</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Hub Capacity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-1 text-2xl font-semibold">26 / 35</div>
                <p className="text-sm text-muted-foreground">Mentees across all mentors</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-purple-600 dark:bg-purple-500" style={{ width: "74%" }} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Expertise Coverage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-1 text-2xl font-semibold">9 Areas</div>
                <p className="text-sm text-muted-foreground">Combined expertise pool</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Success Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-1 text-2xl font-semibold">92%</div>
                <p className="text-sm text-muted-foreground">Mentees achieve goals</p>
              </CardContent>
            </Card>
          </div>

          {/* Hub Features */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Hub Benefits</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${purpleChip}`}>
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-medium">Multi-Mentor Collaboration</h4>
                    <p className="text-sm text-muted-foreground">
                      Work with co-mentors to provide comprehensive guidance
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
                    <Globe className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-medium">Broader Expertise</h4>
                    <p className="text-sm text-muted-foreground">
                      Cover more areas with combined knowledge base
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-500/15 dark:text-green-400">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-medium">Scale Impact</h4>
                    <p className="text-sm text-muted-foreground">
                      Mentor more people effectively with shared workload
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Hub Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { text: "Jessica completed review for Sarah's project", time: "2 hours ago" },
                  { text: "New mentee matched to Robert (Backend expertise)", time: "5 hours ago" },
                  { text: "Hub meeting scheduled for tomorrow", time: "1 day ago" },
                ].map((item) => (
                  <div key={item.text} className="text-sm">
                    <div className="mb-1 text-muted-foreground">{item.text}</div>
                    <span className="text-xs text-muted-foreground/70">{item.time}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Co-Mentors Tab */}
        <TabsContent value="co-mentors" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl">Active Co-Mentors</h2>
            <button className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-white transition-colors hover:bg-purple-700">
              <Plus className="h-4 w-4" />
              Invite Co-Mentor
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {mockCoMentors.map((mentor) => (
              <Card key={mentor.id}>
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <img
                      src={mentor.avatar}
                      alt={mentor.name}
                      className="h-16 w-16 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{mentor.name}</CardTitle>
                          <div className="mt-1 flex items-center gap-1">
                            <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                            <span className="text-sm font-medium">{mentor.rating}</span>
                          </div>
                        </div>
                        <Badge className={statusBadge(mentor.status)}>{mentor.status}</Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="mb-2 text-sm text-muted-foreground">Expertise</div>
                    <div className="flex flex-wrap gap-1">
                      {mentor.expertise.map((skill) => (
                        <span key={skill} className={`rounded px-2 py-1 text-xs ${purpleChip}`}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
                    <span className="text-muted-foreground">Active Mentees</span>
                    <span className="font-medium">{mentor.mentees}</span>
                  </div>
                  <div className="flex gap-2">
                    <button className={`flex-1 rounded-lg px-3 py-2 text-sm ${NEUTRAL_BTN}`}>
                      View Profile
                    </button>
                    <button className="flex-1 rounded-lg bg-purple-600 px-3 py-2 text-sm text-white transition-colors hover:bg-purple-700">
                      Message
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Coordination Tab */}
        <TabsContent value="coordination" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Shared Calendar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="rounded-lg border border-border p-4 transition-colors hover:bg-accent">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium">Hub Strategy Meeting</h4>
                      <p className="mt-1 text-sm text-muted-foreground">Tomorrow at 3:00 PM</p>
                      <p className="text-sm text-muted-foreground">with Jessica Martinez, Robert Kim</p>
                    </div>
                    <Badge>Upcoming</Badge>
                  </div>
                </div>
                <div className="rounded-lg border border-border p-4 transition-colors hover:bg-accent">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium">Mentee Progress Review</h4>
                      <p className="mt-1 text-sm text-muted-foreground">Apr 20 at 10:00 AM</p>
                      <p className="text-sm text-muted-foreground">Cross-mentor discussion</p>
                    </div>
                    <Badge variant="secondary">Scheduled</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shared Resources Library</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="cursor-pointer rounded-lg border border-border p-3 hover:bg-accent">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
                      <span className="text-sm">PDF</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium">Hub Guidelines</h4>
                      <p className="text-xs text-muted-foreground">Shared by Jessica</p>
                    </div>
                  </div>
                </div>
                <div className="cursor-pointer rounded-lg border border-border p-3 hover:bg-accent">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-500/15 dark:text-green-400">
                      <span className="text-sm">DOC</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium">Task Templates</h4>
                      <p className="text-xs text-muted-foreground">Shared by Robert</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mentee Matching Tab */}
        <TabsContent value="matching" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Smart Mentee Matching</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Our AI-powered matching system suggests the best mentor-mentee pairings based on
                expertise, availability, and learning goals.
              </p>

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/30 dark:bg-blue-500/10">
                <h4 className="mb-2 font-medium">Pending Match Suggestions</h4>
                <div className="space-y-3">
                  <div className="rounded-lg bg-card p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h5 className="font-medium">David Park → Robert Kim</h5>
                      <Badge className={statusBadge("completed")}>95% Match</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Strong alignment: Backend expertise, DevOps experience
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button className={`rounded px-3 py-1 text-sm ${ACCENT_SOLID}`}>
                        Approve Match
                      </button>
                      <button className={`rounded px-3 py-1 text-sm ${NEUTRAL_BTN}`}>Reassign</button>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="mb-3 font-medium">Match Distribution</h4>
                <div className="space-y-2">
                  {[
                    { name: "You", count: 12, width: "60%", fill: "bg-purple-600 dark:bg-purple-500" },
                    { name: "Jessica Martinez", count: 8, width: "40%", fill: "bg-blue-600 dark:bg-blue-500" },
                    { name: "Robert Kim", count: 6, width: "30%", fill: "bg-green-600 dark:bg-green-500" },
                  ].map((row) => (
                    <div key={row.name}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span>{row.name}</span>
                        <span>{row.count} mentees</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className={`h-full ${row.fill}`} style={{ width: row.width }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
