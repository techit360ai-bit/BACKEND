import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFounderProfile, type OpenRole, type CompModel } from "@/contexts/UserContext";
import { FounderProgressBar } from "./FounderProgressBar";

const ALL_ROLES: OpenRole[] = [
  "Frontend Engineer", "Backend Engineer", "Full-stack Engineer",
  "ML Engineer", "Designer (Product)", "Designer (Visual)",
  "Product Manager", "Data Scientist", "DevOps Engineer",
  "Growth Marketer", "Content / Copy", "Founder Associate",
];

const COMP_OPTIONS: { v: CompModel; label: string }[] = [
  { v: "equity-heavy",    label: "Equity-heavy" },
  { v: "cash-equity-mix", label: "Cash + equity" },
  { v: "cash-heavy",      label: "Cash-heavy" },
];

export function FounderStep3() {
  const navigate = useNavigate();
  const { founderProfile, updateFounderProfile } = useFounderProfile();
  const [teamSize, setTeamSize] = useState(founderProfile.currentTeamSize);
  const [roles, setRoles]       = useState<OpenRole[]>(founderProfile.openRoles);
  const [comp, setComp]         = useState<CompModel>(founderProfile.compensationOffered);
  const [eqMin, setEqMin]       = useState(founderProfile.equityRangeMin);
  const [eqMax, setEqMax]       = useState(founderProfile.equityRangeMax);

  const toggleRole = (r: OpenRole) => {
    setRoles((cur) => {
      if (cur.includes(r)) return cur.filter((x) => x !== r);
      if (cur.length >= 5) return cur;
      return [...cur, r];
    });
  };

  const canContinue = teamSize >= 1 && roles.length >= 1 && roles.length <= 5 && eqMax >= eqMin;

  const persist = () => updateFounderProfile({
    currentTeamSize: teamSize, openRoles: roles, compensationOffered: comp,
    equityRangeMin: eqMin, equityRangeMax: eqMax,
  });
  const handleNext     = () => { persist(); navigate("/founder/onboarding/step-4"); };
  const handleBack     = () => { persist(); navigate("/founder/onboarding/step-2"); };
  const handleSaveExit = () => { persist(); navigate("/"); };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-2xl">
        <div className="flex justify-end mb-4">
          <button onClick={handleSaveExit} className="text-sm text-muted-foreground hover:text-foreground">Save &amp; exit</button>
        </div>
        <FounderProgressBar currentStep={3} totalSteps={6} />
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-foreground mb-2">Who's on the team — and who else are you looking for?</h1>
          <p className="text-base text-muted-foreground">Tell us your current size and the roles you need to fill.</p>
        </div>

        <div className="space-y-8">
          <div>
            <label className="block mb-2 text-sm font-semibold text-foreground">Current team size</label>
            <input type="number" min={1} value={teamSize} onChange={(e) => setTeamSize(Math.max(1, Number(e.target.value) || 1))}
              className="w-full h-12 bg-background border-2 border-border rounded-lg px-4 text-base outline-none focus:border-violet-500 transition-colors tabular-nums" />
          </div>

          <div>
            <label className="block mb-3 text-sm font-semibold text-foreground">
              Open roles <span className="text-muted-foreground/70 font-normal">({roles.length} of 5)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_ROLES.map((r) => (
                <button key={r} type="button" onClick={() => toggleRole(r)}
                  className={`px-3 py-1.5 rounded-full border text-sm transition-all ${
                    roles.includes(r)
                      ? "border-violet-500 bg-violet-50 text-violet-700"
                      : "border-border bg-background text-muted-foreground hover:border-violet-300"
                  }`}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block mb-3 text-sm font-semibold text-foreground">Compensation offered</label>
            <div className="grid grid-cols-3 gap-3">
              {COMP_OPTIONS.map(({ v, label }) => (
                <button key={v} type="button" onClick={() => setComp(v)}
                  className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                    comp === v
                      ? "border-violet-500 bg-violet-50 text-violet-700"
                      : "border-border bg-background text-foreground hover:border-violet-300"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block mb-3 text-sm font-semibold text-foreground">Equity range (%)</label>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block mb-1 text-xs text-muted-foreground">Min</label>
                <div className="relative">
                  <input type="number" min={0} max={100} step={0.1} value={eqMin}
                    onChange={(e) => setEqMin(Number(e.target.value) || 0)}
                    className="w-full h-12 bg-background border-2 border-border rounded-lg px-4 pr-8 text-base outline-none focus:border-violet-500 transition-colors tabular-nums" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 text-sm">%</span>
                </div>
              </div>
              <span className="text-muted-foreground/70 mt-5">–</span>
              <div className="flex-1">
                <label className="block mb-1 text-xs text-muted-foreground">Max</label>
                <div className="relative">
                  <input type="number" min={0} max={100} step={0.1} value={eqMax}
                    onChange={(e) => setEqMax(Number(e.target.value) || 0)}
                    className="w-full h-12 bg-background border-2 border-border rounded-lg px-4 pr-8 text-base outline-none focus:border-violet-500 transition-colors tabular-nums" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 text-sm">%</span>
                </div>
              </div>
            </div>
            {eqMax < eqMin && (
              <p className="mt-2 text-xs text-red-500">Max must be greater than or equal to min.</p>
            )}
          </div>
        </div>

        <div className="flex justify-between mt-10">
          <button onClick={handleBack} className="px-6 py-3 rounded-lg text-foreground hover:bg-muted/40 font-semibold transition-colors">← Back</button>
          <button onClick={handleNext} disabled={!canContinue}
            className="px-6 py-3 rounded-lg bg-violet-600 text-white font-semibold hover:bg-violet-500 disabled:bg-muted disabled:text-muted-foreground/70 disabled:cursor-not-allowed transition-colors">
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}
