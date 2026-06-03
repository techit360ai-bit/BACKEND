import { useEffect, useMemo, useState } from "react";
import { HaviWidget, type HaviStatus } from "./HaviWidget";
import { HaviPanel } from "./HaviPanel";
import {
  getDefaultTasks, haviMessages, type HaviRole, type HaviTask, type PersonalityMode,
} from "./haviData";
import { computeProgress, loadPlan, setTargetDate, type MvpPlan } from "./mvpEstimate";

interface HaviProps {
  role: HaviRole;
  userName?: string;
  /** Founder stage (Idea/Validation/MVP/…) used to seed the default MVP estimate. */
  stage?: string;
}

const POS_KEY = (role: HaviRole) => `techit:havi:pos:${role}`;
const PERSONA_KEY = (role: HaviRole) => `techit:havi:persona:${role}`;

function loadPosition(role: HaviRole): { x: number; y: number } {
  try {
    const raw = localStorage.getItem(POS_KEY(role));
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { x: 0, y: 0 };
}

function loadPersona(role: HaviRole): PersonalityMode {
  try {
    const raw = localStorage.getItem(PERSONA_KEY(role)) as PersonalityMode | null;
    if (raw) return raw;
  } catch {
    /* ignore */
  }
  return "coach";
}

export function Havi({ role, userName = "there", stage }: HaviProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tasks, setTasks] = useState<HaviTask[]>(() => getDefaultTasks(role));
  const [plan, setPlan] = useState<MvpPlan>(() => loadPlan(role, stage));
  const [position, setPosition] = useState(() => loadPosition(role));
  const [personality, setPersonality] = useState<PersonalityMode>(() => loadPersona(role));

  const [timeSpentToday] = useState(role === "founder" ? 105 : 80);

  const completedTasks = tasks.filter((t) => t.completed).length;
  const completionPercentage = tasks.length
    ? Math.round((completedTasks / tasks.length) * 100)
    : 0;

  // Momentum blends task completion with elapsed-vs-remaining health.
  const progress = useMemo(() => computeProgress(plan), [plan]);
  const momentumScore = useMemo(() => {
    const base = 45;
    const taskBoost = Math.round(completionPercentage * 0.4); // up to +40
    const paceBoost = progress.overdue ? -15 : Math.min(15, Math.round(progress.daysRemaining / 6));
    return Math.max(0, Math.min(100, base + taskBoost + paceBoost));
  }, [completionPercentage, progress]);

  const status: HaviStatus =
    completionPercentage === 100
      ? "celebration"
      : progress.overdue
      ? "alert"
      : "active";

  const widgetMessage =
    completionPercentage === 100
      ? haviMessages.celebration
      : progress.overdue
      ? "Past your MVP target — let's rebalance."
      : `${completionPercentage}% of today done`;

  // Persist position / persona.
  useEffect(() => {
    try { localStorage.setItem(POS_KEY(role), JSON.stringify(position)); } catch { /* ignore */ }
  }, [role, position]);
  useEffect(() => {
    try { localStorage.setItem(PERSONA_KEY(role), personality); } catch { /* ignore */ }
  }, [role, personality]);

  const toggleTask = (id: string) =>
    setTasks((cur) => cur.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));

  const changeTargetDate = (date: string) => setPlan(setTargetDate(role, date));

  return (
    <>
      <HaviWidget
        status={status}
        daysRemaining={progress.daysRemaining}
        overdue={progress.overdue}
        message={widgetMessage}
        onOpen={() => setIsOpen(true)}
        position={position}
        onPositionChange={setPosition}
      />

      <HaviPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        role={role}
        userName={userName}
        tasks={tasks}
        onToggleTask={toggleTask}
        timeSpentToday={timeSpentToday}
        completionPercentage={completionPercentage}
        momentumScore={momentumScore}
        plan={plan}
        progress={progress}
        personality={personality}
        onPersonalityChange={setPersonality}
        onTargetDateChange={changeTargetDate}
      />
    </>
  );
}
