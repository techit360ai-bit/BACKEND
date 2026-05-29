import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFounderProfile, type OwnershipPhilosophy } from "@/contexts/UserContext";
import { FounderProgressBar } from "./FounderProgressBar";

const PHILOSOPHY_OPTIONS: { v: OwnershipPhilosophy; label: string }[] = [
  { v: "equity-day-one",          label: "Collaborators earn equity from day one" },
  { v: "cash-first-equity-later", label: "Cash-first now, equity at seed" },
  { v: "custom",                  label: "Custom (negotiate per-person)" },
];

export function FounderStep5() {
  const navigate = useNavigate();
  const { founderProfile, updateFounderProfile } = useFounderProfile();
  const [why, setWhy]               = useState(founderProfile.whyBuilding);
  const [winning, setWinning]       = useState(founderProfile.winningIn3Years);
  const [advantage, setAdvantage]   = useState(founderProfile.unfairAdvantage);
  const [philosophy, setPhilosophy] = useState<OwnershipPhilosophy>(founderProfile.ownershipPhilosophy);

  const canContinue = why.trim() && winning.trim() && advantage.trim();

  const persist = () => updateFounderProfile({
    whyBuilding: why, winningIn3Years: winning, unfairAdvantage: advantage, ownershipPhilosophy: philosophy,
  });
  const handleNext     = () => { persist(); navigate("/founder/onboarding/step-6"); };
  const handleBack     = () => { persist(); navigate("/founder/onboarding/step-4"); };
  const handleSaveExit = () => { persist(); navigate("/"); };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-2xl">
        <div className="flex justify-end mb-4">
          <button onClick={handleSaveExit} className="text-sm text-slate-500 hover:text-slate-900">Save &amp; exit</button>
        </div>
        <FounderProgressBar currentStep={5} totalSteps={6} />
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Mission</h1>
          <p className="text-base text-slate-600 leading-relaxed">
            TechIT is built on the belief that founders should ship outcomes, not pitch decks.
            The collaborators you bring in earn equity, not just a paycheck. Tell us what you're aiming at.
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block mb-2 text-sm font-semibold text-slate-700">Why are you building this?</label>
            <textarea value={why} onChange={(e) => setWhy(e.target.value)} rows={3}
              placeholder="What problem are you solving and why does it matter to you personally?"
              className="w-full bg-white border-2 border-slate-300 rounded-lg px-4 py-3 text-base outline-none focus:border-violet-500 transition-colors resize-none" />
          </div>

          <div>
            <label className="block mb-2 text-sm font-semibold text-slate-700">What does winning look like in 3 years?</label>
            <textarea value={winning} onChange={(e) => setWinning(e.target.value)} rows={3}
              placeholder="Describe the outcome — market position, revenue, impact, users."
              className="w-full bg-white border-2 border-slate-300 rounded-lg px-4 py-3 text-base outline-none focus:border-violet-500 transition-colors resize-none" />
          </div>

          <div>
            <label className="block mb-2 text-sm font-semibold text-slate-700">Unfair advantage</label>
            <textarea value={advantage} onChange={(e) => setAdvantage(e.target.value)} rows={3}
              placeholder="What do you have that others don't? Domain expertise, network, proprietary data, distribution…"
              className="w-full bg-white border-2 border-slate-300 rounded-lg px-4 py-3 text-base outline-none focus:border-violet-500 transition-colors resize-none" />
          </div>

          <div>
            <label className="block mb-3 text-sm font-semibold text-slate-700">Ownership philosophy</label>
            <div className="flex flex-col gap-3">
              {PHILOSOPHY_OPTIONS.map(({ v, label }) => (
                <button key={v} type="button" onClick={() => setPhilosophy(v)}
                  className={`px-4 py-3 rounded-lg border-2 text-sm font-medium text-left transition-all ${
                    philosophy === v
                      ? "border-violet-500 bg-violet-50 text-violet-700"
                      : "border-slate-300 bg-white text-slate-700 hover:border-violet-300"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-slate-100 border border-slate-200 px-4 py-3 text-sm text-slate-600">
            Verify your GitHub / socials / ID in Settings → Verification after you finish.
            Verified founders see more matches.
          </div>
        </div>

        <div className="flex justify-between mt-10">
          <button onClick={handleBack} className="px-6 py-3 rounded-lg text-slate-700 hover:bg-slate-100 font-semibold transition-colors">← Back</button>
          <button onClick={handleNext} disabled={!canContinue}
            className="px-6 py-3 rounded-lg bg-violet-600 text-white font-semibold hover:bg-violet-500 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors">
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}
