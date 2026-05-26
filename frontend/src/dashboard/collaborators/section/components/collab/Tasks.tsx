import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { tasks as initialTasks, projects } from "@/dashboard/collaborators/section/data/mockData";
import type { Task } from "@/dashboard/collaborators/section/types";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/dashboard/collaborators/section/components/ui/dialog";

type SortKey = "impact" | "deadline" | "project";
type Priority = Task["priority"];

const PRIORITIES: Priority[] = ["critical", "high", "medium", "low"];

function daysUntil(deadlineIso: string): number {
  const due = new Date(deadlineIso);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

function priorityPillClass(p: Priority): string {
  switch (p) {
    case "critical": return "bg-red-50 text-red-700";
    case "high":     return "bg-amber-50 text-amber-700";
    case "medium":   return "bg-slate-100 text-slate-700";
    case "low":      return "bg-slate-100 text-slate-500";
  }
}

export function Tasks() {
  const navigate = useNavigate();
  const [taskList, setTaskList]   = useState<Task[]>(initialTasks);
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [sortKey, setSortKey]     = useState<SortKey>("impact");
  const [completedOpen, setCompletedOpen] = useState(false);
  const [addOpen, setAddOpen]     = useState(false);

  const [nfProject,   setNfProject]   = useState<string>(projects[0]?.id ?? "");
  const [nfTitle,     setNfTitle]     = useState("");
  const [nfDue,       setNfDue]       = useState("");
  const [nfPriority,  setNfPriority]  = useState<Priority>("medium");
  const [nfImpact,    setNfImpact]    = useState(50);

  const filtered = useMemo(() => {
    let list = taskList;
    if (projectFilter !== "all") list = list.filter((t) => t.projectId === projectFilter);
    const sorted = [...list].sort((a, b) => {
      if (sortKey === "impact") return b.impactScore - a.impactScore;
      if (sortKey === "deadline") return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      return a.projectName.localeCompare(b.projectName);
    });
    return sorted;
  }, [taskList, projectFilter, sortKey]);

  const open      = filtered.filter((t) => t.status !== "completed");
  const completed = filtered.filter((t) => t.status === "completed");

  const today    = open.filter((t) => daysUntil(t.deadline) <= 1);
  const thisWeek = open.filter((t) => { const d = daysUntil(t.deadline); return d > 1 && d <= 7; });
  const later    = open.filter((t) => daysUntil(t.deadline) > 7);

  const counts = {
    open: open.length,
    critical: open.filter((t) => t.priority === "critical").length,
    dueThisWeek: thisWeek.length + today.length,
  };

  const handleComplete = (id: string) => {
    setTaskList((cur) => cur.map((t) => t.id === id ? { ...t, status: "completed" as const } : t));
    toast("Marked complete");
  };
  const handleWorkspace = (projectId: string) => navigate(`/workspaces/build?startup=${projectId}`);
  const handleSnooze = (id: string, deadline: string) => {
    const d = new Date(deadline); d.setDate(d.getDate() + 1);
    const next = d.toISOString().slice(0, 10);
    setTaskList((cur) => cur.map((t) => t.id === id ? { ...t, deadline: next } : t));
    toast(`Snoozed to ${next}`);
  };

  const resetForm = () => {
    setNfTitle(""); setNfDue(""); setNfPriority("medium"); setNfImpact(50);
    setNfProject(projects[0]?.id ?? "");
  };
  const canSubmit = nfTitle.trim() && nfDue && nfProject;

  const handleAdd = () => {
    if (!canSubmit) return;
    const proj = projects.find((p) => p.id === nfProject);
    if (!proj) return;
    const newTask: Task = {
      id: `t-${Date.now()}`,
      title: nfTitle.trim(),
      projectId: proj.id,
      projectName: proj.name,
      priority: nfPriority,
      deadline: nfDue,
      impactScore: nfImpact,
      dependencies: [],
      aiReason: "",
      status: "pending",
      aiRank: taskList.length + 1,
    };
    setTaskList((cur) => [newTask, ...cur]);
    toast("Task added");
    setAddOpen(false);
    resetForm();
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tasks</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {counts.open} open · {counts.critical} critical · {counts.dueThisWeek} due this week
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}
            className="h-9 border border-slate-300 rounded-lg px-3 text-sm bg-white">
            <option value="all">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="h-9 border border-slate-300 rounded-lg px-3 text-sm bg-white">
            <option value="impact">Sort: Impact</option>
            <option value="deadline">Sort: Deadline</option>
            <option value="project">Sort: Project</option>
          </select>
          <button onClick={() => setAddOpen(true)}
            className="h-9 px-3 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-lg text-sm font-semibold flex items-center gap-1">
            <Plus className="w-4 h-4" /> Add task
          </button>
        </div>
      </div>

      <Section title="Today" rows={today} onComplete={handleComplete} onWorkspace={handleWorkspace} onSnooze={handleSnooze} priorityPillClass={priorityPillClass} emptyText="Nothing due today." />
      <Section title="This week" rows={thisWeek} onComplete={handleComplete} onWorkspace={handleWorkspace} onSnooze={handleSnooze} priorityPillClass={priorityPillClass} emptyText="Nothing due this week." />
      <Section title="Later" rows={later} onComplete={handleComplete} onWorkspace={handleWorkspace} onSnooze={handleSnooze} priorityPillClass={priorityPillClass} emptyText="No upcoming tasks." />

      <div className="border border-slate-200 bg-white rounded-xl">
        <button onClick={() => setCompletedOpen((v) => !v)}
          className="w-full p-4 text-left text-sm font-semibold text-slate-700 flex items-center justify-between">
          <span>Completed ({completed.length})</span>
          <span className="text-slate-400">{completedOpen ? "Hide" : "Show"}</span>
        </button>
        {completedOpen && (
          <ul className="border-t border-slate-100 divide-y divide-slate-100">
            {completed.length === 0 && <li className="p-4 text-sm text-slate-500">No completed tasks yet.</li>}
            {completed.map((t) => (
              <li key={t.id} className="p-4 text-sm text-slate-500 line-through">{t.title}</li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Project</label>
              <select value={nfProject} onChange={(e) => setNfProject(e.target.value)}
                className="w-full h-10 border border-slate-300 rounded-lg px-3 text-sm bg-white">
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Title</label>
              <input value={nfTitle} onChange={(e) => setNfTitle(e.target.value)}
                placeholder="What needs to be done?"
                className="w-full h-10 border border-slate-300 rounded-lg px-3 text-sm focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Due date</label>
              <input type="date" value={nfDue} onChange={(e) => setNfDue(e.target.value)}
                className="w-full h-10 border border-slate-300 rounded-lg px-3 text-sm focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Priority</label>
              <div className="grid grid-cols-4 gap-2">
                {PRIORITIES.map((p) => (
                  <button key={p} type="button" onClick={() => setNfPriority(p)}
                    className={`h-9 rounded-lg border-2 text-xs font-medium ${nfPriority === p ? "border-amber-500 bg-amber-50 text-amber-700" : "border-slate-300 bg-white text-slate-600"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Impact ({nfImpact})</label>
              <input type="range" min={0} max={100} value={nfImpact} onChange={(e) => setNfImpact(Number(e.target.value))}
                className="w-full accent-amber-500" />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setAddOpen(false)} className="px-4 py-2 text-sm rounded-lg text-slate-700 hover:bg-slate-100">Cancel</button>
            <button onClick={handleAdd} disabled={!canSubmit}
              className="px-4 py-2 text-sm rounded-lg bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 disabled:bg-slate-200 disabled:text-slate-400">Add</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({
  title, rows, onComplete, onWorkspace, onSnooze, priorityPillClass, emptyText,
}: {
  title: string;
  rows: Task[];
  onComplete: (id: string) => void;
  onWorkspace: (projectId: string) => void;
  onSnooze: (id: string, deadline: string) => void;
  priorityPillClass: (p: Priority) => string;
  emptyText: string;
}) {
  return (
    <div className="border border-slate-200 bg-white rounded-xl">
      <div className="px-5 py-3 border-b border-slate-100">
        <h2 className="text-sm font-semibold text-slate-700">{title} ({rows.length})</h2>
      </div>
      {rows.length === 0 ? (
        <p className="p-5 text-sm text-slate-500">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((t) => (
            <li key={t.id} className="p-4 flex items-start gap-3">
              <input type="checkbox" checked={false} readOnly className="mt-1 accent-amber-500" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm text-slate-900">{t.title}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${priorityPillClass(t.priority)}`}>{t.priority}</span>
                </div>
                <p className="text-xs text-slate-500">{t.projectName} · Impact {t.impactScore} · Due {t.deadline}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => onComplete(t.id)} className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50">Mark complete</button>
                <button onClick={() => onWorkspace(t.projectId)} className="text-xs px-3 py-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800">Open in workspace</button>
                <button onClick={() => onSnooze(t.id, t.deadline)} className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50">Snooze 1d</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
