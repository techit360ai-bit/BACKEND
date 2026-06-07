import { useEffect, useState } from "react";
import { GraduationCap, Code2, Sparkles } from "lucide-react";
import { ProgressCard } from "./ProgressCard";
import { BadgeDisplay } from "./BadgeDisplay";
import { LessonView } from "./LessonView";
import { getCurriculum, getBadges, type AcademyRole } from "./curriculum";
import { generateCurriculum, updateTrainingProgress, type Curriculum } from "@/lib/api/training";

interface AcademyProps {
  /** Which curriculum track to show. Each role only ever sees its own track. */
  role: AcademyRole;
  /** Shown in the AI greeting line. */
  userName?: string;
}

const ROLE_META: Record<
  AcademyRole,
  { trackLabel: string; curriculumLabel: string; icon: typeof GraduationCap; seedBadgeId: string }
> = {
  founder: {
    trackLabel: "Founder Track",
    curriculumLabel: "Founder Curriculum",
    icon: GraduationCap,
    seedBadgeId: "founder-certified-1",
  },
  collaborator: {
    trackLabel: "Collaborator Track",
    curriculumLabel: "Collaborator Curriculum",
    icon: Code2,
    seedBadgeId: "verified-collaborator",
  },
};

export function Academy({ role, userName = "there" }: AcademyProps) {
  const meta = ROLE_META[role];
  const curriculum = getCurriculum(role);
  const roleBadges = getBadges(role);

  const [currentWeek, setCurrentWeek] = useState(1);
  const [viewingLesson, setViewingLesson] = useState(false);
  const [completedWeeks, setCompletedWeeks] = useState<number[]>([]);
  const [earnedBadgeIds, setEarnedBadgeIds] = useState<string[]>([meta.seedBadgeId]);

  // Adaptive curriculum plan from ai-router's time-to-MVP engine. Surfaced as a
  // banner; the static lesson content stays as the offline-safe fallback.
  const [adaptivePlan, setAdaptivePlan] = useState<Curriculum | null>(null);
  useEffect(() => {
    let alive = true;
    generateCurriculum({ role }).then((plan) => { if (alive) setAdaptivePlan(plan); });
    return () => { alive = false; };
  }, [role]);

  const currentLesson = curriculum.find((l) => l.week === currentWeek) || curriculum[0];
  const progressPercent = (completedWeeks.length / curriculum.length) * 100;
  const completedTasks = completedWeeks.length * 3;
  const totalTasks = curriculum.length * 3;

  const handleLessonComplete = () => {
    if (!completedWeeks.includes(currentWeek)) {
      const next = [...completedWeeks, currentWeek];
      setCompletedWeeks(next);
      // Report progress to the adaptive-training engine (fire-and-forget).
      void updateTrainingProgress({ role, week: currentWeek, completedWeeks: next });

      // Award progression badges (founder track only has multi-level badges)
      if (role === "founder") {
        if (next.length >= 4 && !earnedBadgeIds.includes("founder-certified-2")) {
          setEarnedBadgeIds((cur) => [...cur, "founder-certified-2"]);
        }
        if (next.length >= 10 && !earnedBadgeIds.includes("market-ready")) {
          setEarnedBadgeIds((cur) => [...cur, "market-ready"]);
        }
      } else if (next.length >= 3 && !earnedBadgeIds.includes("sprint-completion")) {
        setEarnedBadgeIds((cur) => [...cur, "sprint-completion"]);
      }
    }

    if (currentWeek < curriculum.length) {
      setCurrentWeek(currentWeek + 1);
    }
    setViewingLesson(false);
  };

  // ─── Lesson screen (what is being taught) ──────────────────────────────────
  if (viewingLesson) {
    return (
      <div className="min-h-full bg-gray-50 py-8 px-4">
        <LessonView
          lesson={currentLesson}
          totalWeeks={curriculum.length}
          onComplete={handleLessonComplete}
          onBack={() => setViewingLesson(false)}
        />
      </div>
    );
  }

  const RoleIcon = meta.icon;

  // ─── Academy overview ──────────────────────────────────────────────────────
  return (
    <div className="min-h-full bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">TechIT Academy</h1>
          <p className="text-base text-gray-600 mt-1">Build. Learn. Execute.</p>
        </div>

        {/* AI greeting / track banner */}
        <div className="mb-6 rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 p-5">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-600 text-white shrink-0">
              <Sparkles className="size-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-900 font-medium">
                Hey {userName} — you're {Math.round(progressPercent)}% through the {meta.trackLabel}.
              </p>
              {adaptivePlan?.modules?.length ? (
                <p className="text-xs text-indigo-700 mt-1">
                  Adaptive plan: {adaptivePlan.modules.length} modules
                  {adaptivePlan.durationWeeks ? ` · ~${adaptivePlan.durationWeeks} weeks to MVP` : ""} · tuned by the AI engine
                </p>
              ) : null}
              <p className="text-sm text-gray-600 mt-0.5">
                Today's focus: <span className="font-medium text-indigo-700">{currentLesson.title}</span>
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-indigo-700 bg-white/70 border border-indigo-200 rounded-full px-3 py-1.5 shrink-0">
              <RoleIcon className="size-3.5" />
              {meta.trackLabel}
            </div>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left — Progress */}
          <div className="lg:col-span-1">
            <ProgressCard
              currentWeek={currentWeek}
              totalWeeks={curriculum.length}
              progressPercent={Math.round(progressPercent)}
              nextLessonTitle={currentLesson.title}
              completedTasks={completedTasks}
              totalTasks={totalTasks}
              onContinue={() => setViewingLesson(true)}
            />
          </div>

          {/* Right — Lessons & Badges */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{meta.curriculumLabel}</h2>
              <div className="space-y-3">
                {curriculum.map((lesson) => (
                  <button
                    key={lesson.week}
                    onClick={() => {
                      setCurrentWeek(lesson.week);
                      setViewingLesson(true);
                    }}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      completedWeeks.includes(lesson.week)
                        ? "border-green-200 bg-green-50"
                        : currentWeek === lesson.week
                        ? "border-purple-300 bg-purple-50"
                        : "border-gray-200 bg-white hover:border-purple-200 hover:bg-purple-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-gray-500">Week {lesson.week}</span>
                          {completedWeeks.includes(lesson.week) && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                              Completed
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-gray-900">{lesson.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{lesson.subtitle}</p>
                        <p className="text-xs text-gray-500 mt-2">{lesson.duration}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Badges */}
            <BadgeDisplay badges={roleBadges} earnedBadgeIds={earnedBadgeIds} />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-600">
            TechIT doesn't teach startups. It trains them while they're being built.
          </p>
        </div>
      </div>
    </div>
  );
}
