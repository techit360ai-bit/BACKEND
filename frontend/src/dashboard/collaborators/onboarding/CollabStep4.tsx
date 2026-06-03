import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCollaboratorProfile } from "@/contexts/UserContext";
import { CollabProgressBar } from "./CollabProgressBar";

const TIMEZONES = ["WAT", "GMT", "EST", "PST", "CET", "JST", "AEST", "IST"];

type EarliestStart = "this-week" | "2-weeks" | "1-month";
type CommitmentStyle = "deep" | "parallel" | "many";

const startOptions: { label: string; value: EarliestStart }[] = [
  { label: "This week", value: "this-week" },
  { label: "2 weeks", value: "2-weeks" },
  { label: "1 month", value: "1-month" },
];

const commitmentOptions: { label: string; sub: string; value: CommitmentStyle }[] = [
  { label: "One startup deeply", sub: "All-in on one build", value: "deep" },
  { label: "2–3 in parallel", sub: "Split focus across builds", value: "parallel" },
  { label: "Many short engagements", sub: "Short bursts, high variety", value: "many" },
];

export function CollabStep4() {
  const navigate = useNavigate();
  const { collaboratorProfile, updateCollaboratorProfile } = useCollaboratorProfile();
  const [hours, setHours]               = useState(collaboratorProfile.weeklyHours);
  const [tz, setTz]                     = useState(collaboratorProfile.timezone);
  const [earliestStart, setEarliestStart] = useState<EarliestStart>(collaboratorProfile.earliestStart);
  const [commitmentStyle, setCommitment]  = useState<CommitmentStyle>(collaboratorProfile.commitmentStyle);

  const canContinue = hours >= 5 && tz.trim();

  const persist = () => updateCollaboratorProfile({ weeklyHours: hours, timezone: tz, earliestStart, commitmentStyle });
  const handleNext = () => { persist(); navigate("/collaborator/onboarding/step-5"); };
  const handleBack = () => { persist(); navigate("/collaborator/onboarding/step-3"); };
  const handleSaveExit = () => { persist(); navigate("/dashboard"); };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-2xl">
        <div className="flex justify-end mb-4">
          <button onClick={handleSaveExit} className="text-sm text-muted-foreground hover:text-foreground">Save & exit</button>
        </div>
        <CollabProgressBar currentStep={4} totalSteps={6} />

        <div className="mb-10">
          <h1 className="text-3xl font-bold text-foreground mb-2">Availability</h1>
          <p className="text-base text-muted-foreground">Help us match you with builds that fit your schedule and working style.</p>
        </div>

        <div className="space-y-8">
          <div>
            <label className="block mb-3 text-sm font-semibold text-foreground">
              Weekly hours available
              <span className="ml-2 text-amber-600 font-bold">{hours} hrs/week</span>
            </label>
            <input
              type="range" min={5} max={60} value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
            <div className="flex justify-between text-xs text-muted-foreground/70 mt-1">
              <span>5 hrs</span><span>60 hrs</span>
            </div>
          </div>

          <div>
            <label className="block mb-3 text-sm font-semibold text-foreground">Timezone</label>
            <select
              value={tz} onChange={(e) => setTz(e.target.value)}
              className="w-full h-12 bg-background border-2 border-border rounded-lg px-4 text-base outline-none focus:border-amber-500 transition-colors">
              {TIMEZONES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-3 text-sm font-semibold text-foreground">Earliest start</label>
            <div className="grid grid-cols-3 gap-3">
              {startOptions.map(({ label, value }) => (
                <button key={value} type="button" onClick={() => setEarliestStart(value)}
                  className={`py-3 px-4 rounded-lg border-2 text-sm font-medium transition-all ${
                    earliestStart === value ? "border-amber-500 bg-amber-50 text-amber-700"
                                           : "border-border bg-background text-foreground hover:border-amber-300"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block mb-3 text-sm font-semibold text-foreground">Commitment style</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {commitmentOptions.map(({ label, sub, value }) => (
                <button key={value} type="button" onClick={() => setCommitment(value)}
                  className={`py-3 px-4 rounded-lg border-2 text-left transition-all ${
                    commitmentStyle === value ? "border-amber-500 bg-amber-50"
                                             : "border-border bg-background hover:border-amber-300"}`}>
                  <p className={`text-sm font-semibold ${commitmentStyle === value ? "text-amber-700" : "text-foreground"}`}>{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-between mt-10">
          <button onClick={handleBack} className="px-6 py-3 rounded-lg text-foreground hover:bg-muted/40 font-semibold transition-colors">← Back</button>
          <button onClick={handleNext} disabled={!canContinue}
            className="px-6 py-3 rounded-lg bg-amber-500 text-foreground font-semibold hover:bg-amber-400 disabled:bg-muted disabled:text-muted-foreground/70 disabled:cursor-not-allowed transition-colors">
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}
