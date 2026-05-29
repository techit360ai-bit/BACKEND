import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFounderProfile, type LaunchStatus } from "@/contexts/UserContext";
import { FounderProgressBar } from "./FounderProgressBar";

const LAUNCH_OPTIONS: { v: LaunchStatus; label: string }[] = [
  { v: "pre-launch",   label: "Pre-launch" },
  { v: "private-beta", label: "Private beta" },
  { v: "public",       label: "Public" },
];

export function FounderStep4() {
  const navigate = useNavigate();
  const { founderProfile, updateFounderProfile } = useFounderProfile();
  const [launch, setLaunch]       = useState<LaunchStatus>(founderProfile.launchStatus);
  const [users, setUsers]         = useState(founderProfile.users);
  const [revenue, setRevenue]     = useState(founderProfile.revenueMonthly);
  const [funding, setFunding]     = useState(founderProfile.fundingRaised);
  const [investor, setInvestor]   = useState(founderProfile.leadInvestor);
  const [milestone, setMilestone] = useState(founderProfile.nextMilestone);

  const canContinue = milestone.trim().length > 0;

  const persist = () => updateFounderProfile({
    launchStatus: launch, users, revenueMonthly: revenue, fundingRaised: funding,
    leadInvestor: investor, nextMilestone: milestone,
  });
  const handleNext     = () => { persist(); navigate("/founder/onboarding/step-5"); };
  const handleBack     = () => { persist(); navigate("/founder/onboarding/step-3"); };
  const handleSaveExit = () => { persist(); navigate("/"); };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-2xl">
        <div className="flex justify-end mb-4">
          <button onClick={handleSaveExit} className="text-sm text-slate-500 hover:text-slate-900">Save &amp; exit</button>
        </div>
        <FounderProgressBar currentStep={4} totalSteps={6} />
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Where you are right now</h1>
          <p className="text-base text-slate-600">Be honest. Zero is fine.</p>
        </div>

        <div className="space-y-8">
          <div>
            <label className="block mb-3 text-sm font-semibold text-slate-700">Have you launched?</label>
            <div className="grid grid-cols-3 gap-3">
              {LAUNCH_OPTIONS.map(({ v, label }) => (
                <button key={v} type="button" onClick={() => setLaunch(v)}
                  className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                    launch === v
                      ? "border-violet-500 bg-violet-50 text-violet-700"
                      : "border-slate-300 bg-white text-slate-700 hover:border-violet-300"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block mb-2 text-sm font-semibold text-slate-700">
              Users / customers <span className="text-slate-400 font-normal">(active accounts, MAU, whatever you track)</span>
            </label>
            <input type="number" min={0} value={users} onChange={(e) => setUsers(Math.max(0, Number(e.target.value) || 0))}
              className="w-full h-12 bg-white border-2 border-slate-300 rounded-lg px-4 text-base outline-none focus:border-violet-500 transition-colors tabular-nums" />
          </div>

          <div>
            <label className="block mb-2 text-sm font-semibold text-slate-700">Revenue (monthly)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-base">$</span>
              <input type="number" min={0} value={revenue} onChange={(e) => setRevenue(Math.max(0, Number(e.target.value) || 0))}
                className="w-full h-12 bg-white border-2 border-slate-300 rounded-lg pl-8 pr-4 text-base outline-none focus:border-violet-500 transition-colors tabular-nums" />
            </div>
          </div>

          <div>
            <label className="block mb-2 text-sm font-semibold text-slate-700">
              Funding raised <span className="text-slate-400 font-normal">(pre-seed / seed total)</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-base">$</span>
              <input type="number" min={0} value={funding} onChange={(e) => setFunding(Math.max(0, Number(e.target.value) || 0))}
                className="w-full h-12 bg-white border-2 border-slate-300 rounded-lg pl-8 pr-4 text-base outline-none focus:border-violet-500 transition-colors tabular-nums" />
            </div>
          </div>

          <div>
            <label className="block mb-2 text-sm font-semibold text-slate-700">Lead investor <span className="text-slate-400 font-normal">(optional)</span></label>
            <input value={investor} onChange={(e) => setInvestor(e.target.value)} placeholder="Y Combinator, Sequoia, angel name…"
              className="w-full h-12 bg-white border-2 border-slate-300 rounded-lg px-4 text-base outline-none focus:border-violet-500 transition-colors" />
          </div>

          <div>
            <label className="block mb-2 text-sm font-semibold text-slate-700">
              Key milestone next <span className="text-slate-400 font-normal">({milestone.length}/120)</span>
            </label>
            <input value={milestone} onChange={(e) => setMilestone(e.target.value)} maxLength={120}
              placeholder="Launch public beta with 500 waitlist users by end of Q3."
              className="w-full h-12 bg-white border-2 border-slate-300 rounded-lg px-4 text-base outline-none focus:border-violet-500 transition-colors" />
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
