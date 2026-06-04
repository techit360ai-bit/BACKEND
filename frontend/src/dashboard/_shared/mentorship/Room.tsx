import { useParams } from "react-router-dom";
import { useState } from "react";
import { Calendar, CheckCircle2, Clock, Plus } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/dashboard/investors/section/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/dashboard/investors/section/components/ui/tabs";
import { Badge } from "@/dashboard/investors/section/components/ui/badge";
import { Progress } from "@/dashboard/investors/section/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/dashboard/investors/section/components/ui/dialog";
import { Label } from "@/dashboard/investors/section/components/ui/label";
import { Input } from "@/dashboard/investors/section/components/ui/input";
import { Textarea } from "@/dashboard/investors/section/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/dashboard/investors/section/components/ui/select";
import { mockMentees, mockTasks, mockRooms } from "./data";
import { ACCENT_SOLID, ACCENT_SOFT, NEUTRAL_BTN, HERO_GRADIENT, statusBadge } from "./theme";

export function Room() {
  const { roomId } = useParams();
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);

  const room = mockRooms.find((r) => r.id === roomId);
  const roomMentees = mockMentees.slice(0, 3);
  const roomTasks = mockTasks;

  if (!room) {
    return <div className="text-muted-foreground">Room not found</div>;
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "text-red-600 dark:text-red-400";
      case "medium":
        return "text-orange-600 dark:text-orange-400";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      {/* Room Header */}
      <div className={`rounded-lg p-6 ${HERO_GRADIENT}`}>
        <h1 className="mb-2 text-3xl">{room.name}</h1>
        <p className="mb-4 text-white/80">{room.description}</p>
        <div className="flex gap-4">
          <div className="rounded-lg bg-white/20 px-4 py-2">
            <div className="text-sm text-white/80">Payment Model</div>
            <div className="font-semibold">
              {room.paymentModel === "equity" ? `${room.equityPercentage}% Equity` : room.rate}
            </div>
          </div>
          <div className="rounded-lg bg-white/20 px-4 py-2">
            <div className="text-sm text-white/80">Active Mentees</div>
            <div className="font-semibold">
              {room.menteeCount} / {room.capacity}
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="mentees" className="w-full">
        <TabsList>
          <TabsTrigger value="mentees">Mentees</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="communication">Communication</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
        </TabsList>

        {/* Mentees Tab */}
        <TabsContent value="mentees" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl">Active Mentees</h2>
            <span className="text-sm text-muted-foreground">{roomMentees.length} total</span>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {roomMentees.map((mentee) => (
              <Card key={mentee.id}>
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <img
                      src={mentee.avatar}
                      alt={mentee.name}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <CardTitle className="text-base">{mentee.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{mentee.email}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{mentee.progress}%</span>
                    </div>
                    <Progress value={mentee.progress} />
                  </div>
                  <div>
                    <div className="mb-2 text-sm text-muted-foreground">Skills</div>
                    <div className="flex flex-wrap gap-1">
                      {mentee.skills.map((skill) => (
                        <span key={skill} className={`rounded px-2 py-1 text-xs ${ACCENT_SOFT}`}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-sm text-muted-foreground">Goals</div>
                    <p className="text-sm">{mentee.goals}</p>
                  </div>
                  <button className={`w-full rounded-lg px-4 py-2 text-sm ${NEUTRAL_BTN}`}>
                    View Details
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl">Tasks &amp; Assignments</h2>
            <Dialog open={isCreateTaskOpen} onOpenChange={setIsCreateTaskOpen}>
              <DialogTrigger asChild>
                <button className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-colors ${ACCENT_SOLID}`}>
                  <Plus className="h-4 w-4" />
                  Create Task
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New Task</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="task-title">Task Title</Label>
                    <Input id="task-title" placeholder="Enter task title" />
                  </div>
                  <div>
                    <Label htmlFor="task-description">Description</Label>
                    <Textarea id="task-description" placeholder="Describe the task..." rows={3} />
                  </div>
                  <div>
                    <Label htmlFor="assign-to">Assign To</Label>
                    <Select>
                      <SelectTrigger id="assign-to">
                        <SelectValue placeholder="Select mentee" />
                      </SelectTrigger>
                      <SelectContent>
                        {roomMentees.map((mentee) => (
                          <SelectItem key={mentee.id} value={mentee.id}>
                            {mentee.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="due-date">Due Date</Label>
                      <Input id="due-date" type="date" />
                    </div>
                    <div>
                      <Label htmlFor="priority">Priority</Label>
                      <Select>
                        <SelectTrigger id="priority">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="reward">Reward (Optional)</Label>
                    <Input id="reward" placeholder="e.g., $500 or 2% equity" />
                  </div>
                  <button
                    onClick={() => setIsCreateTaskOpen(false)}
                    className={`w-full rounded-lg px-4 py-2 transition-colors ${ACCENT_SOLID}`}
                  >
                    Create Task
                  </button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-3">
            {roomTasks.map((task) => {
              const assignedMentee = roomMentees.find((m) => m.id === task.assignedTo);
              return (
                <Card key={task.id} className="transition-shadow hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <div className="mb-2 flex items-start justify-between">
                          <div className="flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <h3 className="font-medium">{task.title}</h3>
                              <Badge className={statusBadge(task.status)}>{task.status}</Badge>
                              <span className={`text-xs ${getPriorityColor(task.priority)}`}>
                                ● {task.priority}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">{task.description}</p>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <img
                              src={assignedMentee?.avatar}
                              alt={assignedMentee?.name}
                              className="h-5 w-5 rounded-full object-cover"
                            />
                            <span>{assignedMentee?.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                          </div>
                          {task.reward && (
                            <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                              <CheckCircle2 className="h-4 w-4" />
                              <span>{task.reward}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Communication Tab */}
        <TabsContent value="communication" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Room Chat</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-96 overflow-y-auto rounded-lg bg-muted/50 p-4">
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <img
                      src={roomMentees[0].avatar}
                      alt={roomMentees[0].name}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <div className="rounded-lg bg-card p-3">
                        <div className="mb-1 text-sm font-medium">{roomMentees[0].name}</div>
                        <p className="text-sm text-muted-foreground">
                          Hi everyone! I just completed the MVP design task. Would love to get your
                          feedback on the wireframes.
                        </p>
                      </div>
                      <span className="ml-3 mt-1 text-xs text-muted-foreground">2 hours ago</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <img
                      src={room.mentor.avatar}
                      alt={room.mentor.name}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <div className={`rounded-lg p-3 ${ACCENT_SOFT}`}>
                        <div className="mb-1 text-sm font-medium">{room.mentor.name}</div>
                        <p className="text-sm">
                          Great work, Sarah! I'll review them this afternoon and schedule a call to
                          discuss. Keep up the momentum!
                        </p>
                      </div>
                      <span className="ml-3 mt-1 text-xs text-muted-foreground">1 hour ago</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Input placeholder="Type your message..." className="flex-1" />
                <button className={`rounded-lg px-4 py-2 transition-colors ${ACCENT_SOLID}`}>
                  Send
                </button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Scheduled Sessions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className={`flex items-start gap-3 rounded-lg p-3 ${ACCENT_SOFT}`}>
                  <Clock className="mt-0.5 h-5 w-5" />
                  <div className="flex-1">
                    <h4 className="font-medium">Progress Review Call</h4>
                    <p className="text-sm opacity-80">Tomorrow at 2:00 PM</p>
                    <p className="text-sm opacity-80">with Sarah Johnson</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
                  <Clock className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <h4 className="font-medium">Technical Architecture Review</h4>
                    <p className="text-sm text-muted-foreground">Apr 20 at 10:00 AM</p>
                    <p className="text-sm text-muted-foreground">with Michael Chen</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <button className={`w-full rounded-lg px-4 py-2 text-left text-sm ${NEUTRAL_BTN}`}>
                  Schedule Video Call
                </button>
                <button className={`w-full rounded-lg px-4 py-2 text-left text-sm ${NEUTRAL_BTN}`}>
                  Share Resources
                </button>
                <button className={`w-full rounded-lg px-4 py-2 text-left text-sm ${NEUTRAL_BTN}`}>
                  Send Feedback
                </button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Resources Tab */}
        <TabsContent value="resources" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Shared Resources</CardTitle>
                <button className={`rounded-lg px-4 py-2 text-sm transition-colors ${ACCENT_SOLID}`}>
                  Upload Resource
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { kind: "PDF", color: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400", title: "SaaS Product Development Guide", date: "Apr 10, 2026" },
                  { kind: "DOC", color: "bg-green-100 text-green-600 dark:bg-green-500/15 dark:text-green-400", title: "API Architecture Template", date: "Apr 8, 2026" },
                  { kind: "VID", color: "bg-purple-100 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400", title: "Product Demo Best Practices", date: "Apr 5, 2026" },
                ].map((res) => (
                  <div
                    key={res.title}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent"
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${res.color}`}>
                      <span className="text-sm">{res.kind}</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium">{res.title}</h4>
                      <p className="text-xs text-muted-foreground">Uploaded on {res.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
