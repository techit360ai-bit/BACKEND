import NavBar from "@/components/ui/NavBar";
import { Button } from "@/components/ui/button";
import CelebrationOverlay from "@/components/CelebrationOverlay";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, type Location } from "react-router-dom";

const collaboratorSkills = [
  "React",
  "Node.js",
  "Python",
  "Design",
  "Marketing",
  "Sales",
  "Product",
  "Data Science",
] as const;

const minHours = 5;
const maxHours = 60;

type RiskTolerance = "Low" | "Medium" | "High";

type CollaboratorProfile = {
  skills: string[];
  hours: number;
  riskTolerance: RiskTolerance;
};

type CollaboratorLocationState = {
  celebrate?: boolean;
  profile?: CollaboratorProfile;
};

const CollaboratorSetup = () => {
  const location = useLocation() as Location & {
    state?: CollaboratorLocationState;
  };
  const navigate = useNavigate();
  const initialProfile = location.state?.profile;
  const [showArrivalCelebration, setShowArrivalCelebration] = useState(
    Boolean(location.state?.celebrate),
  );
  const [selectedSkills, setSelectedSkills] = useState<string[]>(
    initialProfile?.skills ?? ["React", "Node.js"],
  );
  const [hours, setHours] = useState(initialProfile?.hours ?? 20);
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance | null>(
    initialProfile?.riskTolerance ?? "Medium",
  );

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill],
    );
  };

  const profileStrength = (() => {
    let score = 0;
    if (selectedSkills.length > 0) score += 40;
    if (hours >= minHours) score += 30;
    if (riskTolerance) score += 30;
    return score;
  })();

  const isValid =
    selectedSkills.length > 0 && hours >= minHours && !!riskTolerance;

  useEffect(() => {
    if (!showArrivalCelebration) return;
    const timer = setTimeout(() => setShowArrivalCelebration(false), 700);
    return () => clearTimeout(timer);
  }, [showArrivalCelebration]);

  const handleContinue = () => {
    if (!isValid || !riskTolerance) return;
    const profile: CollaboratorProfile = {
      skills: selectedSkills,
      hours,
      riskTolerance,
    };
    navigate("/collaborator/summary", { state: { profile } });
  };

  return (
    <div className="min-h-dvh w-full flex flex-col">
      <NavBar />
      <main className="flex-1 flex justify-center px-6 py-10 lg:py-16 relative overflow-hidden bg-linear-to-b from-slate-50 via-violet-50/30 to-slate-50 dark:from-slate-950 dark:via-slate-900/30 dark:to-slate-950 text-foreground">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(139,92,246,0.08)_0%,transparent_70%)] dark:bg-[radial-gradient(ellipse_at_50%_50%,rgba(168,85,247,0.05)_0%,transparent_70%)]" />

        <div className="relative z-10 w-full max-w-5xl flex flex-col gap-8">
          <header className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-semibold text-foreground">
              Set Up Your Profile
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-xl">
              Tell us about yourself to get matched with the right
              opportunities.
            </p>
          </header>

          <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6">
            <div className="space-y-5">
              <div className="rounded-2xl bg-card/80 border border-border px-6 py-5 shadow-lg shadow-cyan-500/10 dark:shadow-cyan-600/10">
                <p className="text-xs font-medium tracking-wide text-muted-foreground mb-3">
                  Your Skills
                  <span className="ml-1 text-[0.7rem] font-normal text-muted-foreground/80">
                    (AI will suggest more)
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {collaboratorSkills.map((skill) => {
                    const selected = selectedSkills.includes(skill);
                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => toggleSkill(skill)}
                        className={[
                          "rounded-full border px-3 py-1.5 text-xs sm:text-sm transition-colors",
                          selected
                            ? "border-cyan-500 bg-cyan-500/20 text-cyan-700 dark:text-cyan-300"
                            : "border-slate-300 dark:border-slate-700 bg-background/60 text-foreground hover:bg-cyan-100/50 dark:hover:bg-cyan-950/50",
                        ].join(" ")}
                      >
                        {skill}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl bg-card/80 border border-border px-6 py-5 shadow-lg shadow-cyan-500/10 dark:shadow-cyan-600/10 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground">
                      Weekly Availability
                      <span className="ml-1 text-[0.7rem] text-cyan-600 dark:text-cyan-400 font-normal">
                        {hours}h/week
                      </span>
                    </p>
                  </div>
                </div>
                <div className="space-y-1">
                  <input
                    type="range"
                    min={minHours}
                    max={maxHours}
                    value={hours}
                    onChange={(e) => setHours(Number(e.target.value))}
                    className="w-full accent-cyan-500 dark:accent-cyan-400"
                  />
                  <div className="flex justify-between text-[0.7rem] text-slate-400">
                    <span>Part-time</span>
                    <span>Full-time</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-card/80 border border-border px-6 py-5 shadow-lg shadow-teal-500/10 dark:shadow-teal-600/10 space-y-4">
                <p className="text-xs font-medium tracking-wide text-muted-foreground">
                  Risk Tolerance
                </p>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  {(["Low", "Medium", "High"] as RiskTolerance[]).map(
                    (level) => {
                      const selected = riskTolerance === level;
                      return (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setRiskTolerance(level)}
                          className={[
                            "rounded-xl border px-3 py-2.5 transition-colors",
                            selected
                              ? "border-teal-500 bg-teal-500/20 text-teal-700 dark:text-teal-300"
                              : "border-slate-300 dark:border-slate-700 bg-background/60 text-foreground hover:bg-teal-100/50 dark:hover:bg-teal-950/50",
                          ].join(" ")}
                        >
                          {level}
                        </button>
                      );
                    },
                  )}
                </div>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-2xl bg-card/80 border border-border px-5 py-4 shadow-lg shadow-violet-500/10 dark:shadow-violet-600/10">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground mb-3 flex items-center justify-between">
                  AI Profile Analysis
                  <span className="text-[0.7rem] text-muted-foreground/70">
                    Preview
                  </span>
                </p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Profile Strength
                    </span>
                    <span className="font-semibold text-foreground">
                      {profileStrength}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-violet-500 to-cyan-500 transition-all"
                      style={{ width: `${profileStrength}%` }}
                    />
                  </div>
                  <p className="text-[0.75rem] text-muted-foreground/80">
                    Complete the steps on the left to improve your matching
                    accuracy.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                disabled={!isValid}
                className="w-full h-11 text-sm font-semibold bg-linear-to-r from-violet-500 to-violet-600 text-white hover:from-violet-600 hover:to-violet-700 shadow-lg shadow-violet-500/20 dark:shadow-violet-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleContinue}
              >
                Continue
              </Button>
              <p className="text-[0.7rem] text-muted-foreground/80">
                You&apos;ll be able to review your answers before finalizing
                your profile.
              </p>
            </aside>
          </section>
        </div>
        <CelebrationOverlay
          visible={showArrivalCelebration}
          message="Welcome to your collaborator setup."
          label="Collaborator Journey"
        />
      </main>
    </div>
  );
};

export default CollaboratorSetup;
