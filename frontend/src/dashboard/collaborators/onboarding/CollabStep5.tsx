import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCollaboratorProfile } from "@/contexts/UserContext";
import { CollabProgressBar } from "./CollabProgressBar";

type VestingComfort = "standard" | "1y-cliff-4y" | "custom";

const vestingOptions: { label: string; sub: string; value: VestingComfort }[] = [
  { label: "1y cliff, 4y vest", sub: "No equity until year 1", value: "1y-cliff-4y" },
  { label: "Standard (4y, 1y cliff)", sub: "Most common structure", value: "standard" },
  { label: "Custom", sub: "Let's talk about it", value: "custom" },
];

export function CollabStep5() {
  const navigate = useNavigate();
  const { collaboratorProfile, updateCollaboratorProfile } = useCollaboratorProfile();
  const [pref, setPref]     = useState(collaboratorProfile.equityPreference);
  const [floor, setFloor]   = useState(collaboratorProfile.minCashFloor);
  const [vesting, setVesting] = useState<VestingComfort>(collaboratorProfile.vestingComfort);

  const canContinue = pref >= 0 && pref <= 100 && floor >= 0;

  const persist = () => updateCollaboratorProfile({ equityPreference: pref, minCashFloor: floor, vestingComfort: vesting });
  const handleNext = () => { persist(); navigate("/collaborator/onboarding/step-6"); };
  const handleBack = () => { persist(); navigate("/collaborator/onboarding/step-4"); };
  const handleSaveExit = () => { persist(); navigate("/dashboard"); };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-2xl">
        <div className="flex justify-end mb-4">
          <button onClick={handleSaveExit} className="text-sm text-slate-500 hover:text-slate-900">Save & exit</button>
        </div>
        <CollabProgressBar currentStep={5} totalSteps={6} />

        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Building for Equity</h1>
          <p className="text-base text-slate-600 leading-relaxed">
            TechIT is built on the idea that contributors should own what they build. Every engagement
            is a mix of cash and equity. Your preference shapes the opportunities we surface and the
            offers you accept.
          </p>
        </div>

        <div className="space-y-8">
          <div>
            <label className="block mb-3 text-sm font-semibold text-slate-700">
              Equity / cash split preference
            </label>
            <input
              type="range" min={0} max={100} value={pref}
              onChange={(e) => setPref(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>Cash heavy</span>
              <span className="text-sm font-semibold text-amber-600">{pref}% equity / {100 - pref}% cash</span>
              <span>Equity heavy</span>
            </div>
          </div>

          <div>
            <label className="block mb-3 text-sm font-semibold text-slate-700">Minimum cash floor (per month)</label>
            <input
              type="number" min={0} step={100} value={floor}
              onChange={(e) => setFloor(Number(e.target.value) || 0)}
              placeholder="e.g. 2000"
              className="w-full h-12 bg-white border-2 border-slate-300 rounded-lg px-4 text-base outline-none focus:border-amber-500 transition-colors tabular-nums"
            />
          </div>

          <div>
            <label className="block mb-3 text-sm font-semibold text-slate-700">Vesting comfort</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {vestingOptions.map(({ label, sub, value }) => (
                <button key={value} type="button" onClick={() => setVesting(value)}
                  className={`py-3 px-4 rounded-lg border-2 text-left transition-all ${
                    vesting === value ? "border-amber-500 bg-amber-50"
                                     : "border-slate-300 bg-white hover:border-amber-300"}`}>
                  <p className={`text-sm font-semibold ${vesting === value ? "text-amber-700" : "text-slate-700"}`}>{label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
                </button>
              ))}
            </div>
          </div>

          <details className="group rounded-lg border border-slate-200 bg-white overflow-hidden">
            <summary className="px-4 py-3 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-50 list-none flex items-center justify-between">
              How equity works on TechIT
              <span className="text-slate-400 group-open:rotate-180 transition-transform">▾</span>
            </summary>
            <div className="px-4 pb-4 pt-2">
              <ul className="space-y-2 text-sm text-slate-600">
                <li>· Vesting is tracked on-platform — you always know your earned stake.</li>
                <li>· Dilution protection clauses are negotiated per engagement, not platform-wide.</li>
                <li>· TechIT acts as cap-table custodian, holding your equity until a liquidity event.</li>
              </ul>
            </div>
          </details>
        </div>

        <div className="flex justify-between mt-10">
          <button onClick={handleBack} className="px-6 py-3 rounded-lg text-slate-700 hover:bg-slate-100 font-semibold transition-colors">← Back</button>
          <button onClick={handleNext} disabled={!canContinue}
            className="px-6 py-3 rounded-lg bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors">
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}
