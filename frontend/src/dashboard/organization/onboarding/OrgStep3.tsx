import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOrgProfile } from "@/contexts/UserContext";
import { OrgProgressBar } from "./OrgProgressBar";
import { Target, MapPin } from "lucide-react";

const PROGRAMMES = [
  { id: "Hackathons", emoji: "🏆", desc: "Theme-driven build sprints" },
  { id: "Accelerator", emoji: "🚀", desc: "Structured 8–16 week cohorts" },
  { id: "Grants", emoji: "💸", desc: "Funding for early-stage projects" },
  { id: "Mentorship", emoji: "🧭", desc: "1-on-1 founder support" },
  { id: "Hiring", emoji: "🎯", desc: "Recruit verified builders" },
  { id: "Sponsorship", emoji: "🤝", desc: "Back third-party events" },
];

const SECTORS = [
  "AI",
  "FinTech",
  "Healthcare",
  "Climate",
  "Education",
  "Logistics",
  "Deep Tech",
  "Web3",
  "Agriculture",
  "Energy",
];

const GEOGRAPHIES = [
  "West Africa",
  "East Africa",
  "Southern Africa",
  "North Africa",
  "Middle East",
  "South Asia",
  "South-East Asia",
  "Latin America",
  "Europe",
  "North America",
];

export function OrgStep3() {
  const navigate = useNavigate();
  const { orgProfile, updateOrgProfile } = useOrgProfile();
  const [programmes, setProgrammes] = useState<string[]>(orgProfile.programmes);
  const [sectors, setSectors] = useState<string[]>(orgProfile.sectors);
  const [geographies, setGeographies] = useState<string[]>(
    orgProfile.geographies,
  );

  const toggle = (
    list: string[],
    setList: (v: string[]) => void,
    val: string,
  ) =>
    setList(list.includes(val) ? list.filter((x) => x !== val) : [...list, val]);

  const handleNext = () => {
    updateOrgProfile({ programmes, sectors, geographies });
    navigate("/org/onboarding/step-4");
  };
  const handleBack = () => navigate("/org/onboarding/step-2");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900/80 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-3xl">
        <OrgProgressBar currentStep={3} totalSteps={5} />

        <div className="mb-10">
          <h1 className="text-4xl font-bold text-foreground dark:text-white tracking-tight mb-2">
            Programmes & Focus
          </h1>
          <p className="text-base text-muted-foreground dark:text-muted-foreground/70">
            What does your organisation offer, and where do you operate? We use
            this to route the right builders to you.
          </p>
        </div>

        <div className="space-y-9">
          {/* Programmes */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-indigo-500" />
              <h3 className="text-foreground dark:text-white font-semibold">
                What you run
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PROGRAMMES.map((p) => {
                const active = programmes.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => toggle(programmes, setProgrammes, p.id)}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${
                      active
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10"
                        : "border-border dark:border-border bg-background dark:bg-card/40 hover:border-indigo-300"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-xl">{p.emoji}</span>
                      <p className="font-bold text-foreground dark:text-white">
                        {p.id}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground dark:text-muted-foreground/70">
                      {p.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sectors */}
          <div>
            <h3 className="text-foreground dark:text-white font-semibold mb-4">
              Sectors of focus
            </h3>
            <div className="flex flex-wrap gap-2">
              {SECTORS.map((s) => {
                const active = sectors.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => toggle(sectors, setSectors, s)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                      active
                        ? "bg-indigo-600 text-white shadow-md"
                        : "bg-background dark:bg-card/40 text-foreground dark:text-muted-foreground/50 border-2 border-border dark:border-border hover:border-indigo-400"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Geographies */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-4 h-4 text-indigo-500" />
              <h3 className="text-foreground dark:text-white font-semibold">
                Where you operate
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {GEOGRAPHIES.map((g) => {
                const active = geographies.includes(g);
                return (
                  <button
                    key={g}
                    onClick={() => toggle(geographies, setGeographies, g)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                      active
                        ? "bg-violet-600 text-white shadow-md"
                        : "bg-background dark:bg-card/40 text-foreground dark:text-muted-foreground/50 border-2 border-border dark:border-border hover:border-violet-400"
                    }`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-12 flex justify-between gap-4">
          <button
            onClick={handleBack}
            className="px-6 py-4 rounded-xl border-2 border-border dark:border-border text-foreground dark:text-muted-foreground/50 font-semibold hover:border-indigo-400 transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleNext}
            disabled={programmes.length === 0 || sectors.length === 0}
            className="px-10 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
