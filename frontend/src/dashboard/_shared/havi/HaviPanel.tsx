import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  X, Gauge, MessageSquare, SlidersHorizontal, GraduationCap, Target,
  Flame, ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Progress } from "@/dashboard/collaborators/section/components/ui/progress";
import { Checkbox } from "@/dashboard/collaborators/section/components/ui/checkbox";
import { HaviChat } from "./HaviChat";
import { HaviChoices } from "./HaviChoices";
import type { HaviRole, HaviTask, PersonalityMode } from "./haviData";
import type { MvpPlan, MvpProgress } from "./mvpEstimate";

type Tab = "today" | "ask" | "choices";

interface HaviPanelProps {
  isOpen: boolean;
  onClose: () => void;
  role: HaviRole;
  userName: string;
  tasks: HaviTask[];
  onToggleTask: (id: string) => void;
  timeSpentToday: number;
  completionPercentage: number;
  momentumScore: number;
  plan: MvpPlan;
  progress: MvpProgress;
  personality: PersonalityMode;
  onPersonalityChange: (m: PersonalityMode) => void;
  onTargetDateChange: (date: string) => void;
}

const ACADEMY_PATH: Record<HaviRole, string> = {
  founder: "/incubation-hub?panel=learn",
  collaborator: "/collaborator/academy",
};

export function HaviPanel(props: HaviPanelProps) {
  const {
    isOpen, onClose, role, userName, tasks, onToggleTask, timeSpentToday,
    completionPercentage, momentumScore, plan, progress, personality,
    onPersonalityChange, onTargetDateChange,
  } = props;

  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("today");

  const completedTasks = tasks.filter((t) => t.completed).length;
  const totalEstimated = tasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);

  const goAcademy = () => {
    onClose();
    navigate(ACADEMY_PATH[role]);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[130]"
            onClick={onClose}
          />

          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 220 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-[140] flex flex-col"
          >
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Havi</h2>
                  <p className="text-xs text-slate-500">Your build companion · {userName}</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  aria-label="Close Havi"
                >
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>

              {/* Time to MVP — the core tracker */}
              <div className="rounded-xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-blue-50 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-slate-700">
                    <Target className="w-4 h-4 text-cyan-600" /> Time to MVP
                  </span>
                  <span className="font-semibold text-cyan-700">
                    {progress.overdue
                      ? `${Math.abs(progress.daysRemaining)}d overdue`
                      : `${progress.daysRemaining} days left`}
                  </span>
                </div>
                <Progress value={progress.percentElapsed} className="h-2 mt-2" />
                <div className="flex justify-between text-xs text-slate-500 mt-1.5">
                  <span>{progress.percentElapsed}% elapsed</span>
                  <span>Target {progress.targetLabel}</span>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mt-4 bg-slate-100 rounded-lg p-1">
                <TabBtn active={tab === "today"} onClick={() => setTab("today")} icon={<Gauge className="w-4 h-4" />} label="Today" />
                <TabBtn active={tab === "ask"} onClick={() => setTab("ask")} icon={<MessageSquare className="w-4 h-4" />} label="Ask" />
                <TabBtn active={tab === "choices"} onClick={() => setTab("choices")} icon={<SlidersHorizontal className="w-4 h-4" />} label="Edit" />
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {tab === "today" && (
                <div className="space-y-6">
                  {/* Momentum */}
                  <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="flex items-center gap-1.5 font-semibold text-slate-900">
                        <Flame className="w-4 h-4 text-amber-500" /> Momentum
                      </h3>
                      <span className="font-semibold text-amber-600">{momentumScore}/100</span>
                    </div>
                    <Progress value={momentumScore} className="h-2" />
                    <p className="text-xs text-slate-600 mt-2">
                      {momentumScore >= 70
                        ? "Strong and steady — keep the streak alive."
                        : momentumScore >= 40
                        ? "Building up. Ship one visible thing today."
                        : "Momentum is low. Pick the smallest win and start."}
                    </p>
                  </div>

                  {/* Today's plan */}
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-3">Today's Plan</h3>
                    <div className="space-y-3">
                      {tasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                          <Checkbox
                            checked={task.completed}
                            onCheckedChange={() => onToggleTask(task.id)}
                            className="mt-0.5"
                          />
                          <div className="flex-1">
                            <p className={`text-sm ${task.completed ? "line-through text-slate-500" : "text-slate-900"}`}>
                              {task.title}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">{task.estimatedMinutes} min</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Progress summary */}
                  <div className="p-4 bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl border border-cyan-200 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Tasks completed</span>
                      <span className="font-medium text-slate-900">{completedTasks} / {tasks.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Time spent today</span>
                      <span className="font-medium text-slate-900">{timeSpentToday} min</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Estimated remaining</span>
                      <span className="font-medium text-slate-900">{Math.max(0, totalEstimated - timeSpentToday)} min</span>
                    </div>
                    <div className="pt-2 mt-1 border-t border-cyan-200">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Completion</span>
                        <span className="font-semibold text-cyan-600">{completionPercentage}%</span>
                      </div>
                      <Progress value={completionPercentage} className="h-2 mt-2" />
                    </div>
                  </div>

                  {/* Academy link */}
                  <button
                    onClick={goAcademy}
                    className="w-full group flex items-center gap-3 p-4 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 hover:border-indigo-300 transition-colors text-left"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-600 text-white shrink-0">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm">Learn this in TechIT Academy</p>
                      <p className="text-xs text-slate-600">Lessons mapped to your stage and track</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-indigo-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </button>
                </div>
              )}

              {tab === "ask" && <HaviChat role={role} />}

              {tab === "choices" && (
                <HaviChoices
                  plan={plan}
                  personality={personality}
                  onPersonalityChange={onPersonalityChange}
                  onTargetDateChange={onTargetDateChange}
                />
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function TabBtn({
  active, onClick, icon, label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
        active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
