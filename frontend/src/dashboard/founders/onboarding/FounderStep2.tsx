import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFounderProfile, type FounderStage } from "@/contexts/UserContext";
import { FounderProgressBar } from "./FounderProgressBar";

const STAGES: FounderStage[] = ["Idea", "MVP", "Beta", "Launch", "Growth"];
const INDUSTRIES = ["AI/ML", "SaaS", "FinTech", "HealthTech", "E-Commerce", "Edtech", "CleanTech", "Web3"];

export function FounderStep2() {
  const navigate = useNavigate();
  const { founderProfile, updateFounderProfile } = useFounderProfile();
  const [startupName, setStartupName]   = useState(founderProfile.startupName);
  const [oneLiner, setOneLiner]         = useState(founderProfile.oneLiner);
  const [stage, setStage]               = useState<FounderStage>(founderProfile.stage);
  const [industries, setIndustries]     = useState<string[]>(founderProfile.industries);
  const [foundingYear, setFoundingYear] = useState(founderProfile.foundingYear);
  const [website, setWebsite]           = useState(founderProfile.website);
  const [logoEmoji, setLogoEmoji]       = useState(founderProfile.logoEmoji);

  const toggleIndustry = (s: string) =>
    setIndustries((cur) => cur.includes(s) ? cur.filter((x) => x !== s) : cur.length < 3 ? [...cur, s] : cur);

  const canContinue = startupName.trim() && oneLiner.trim() && industries.length >= 1 && industries.length <= 3;

  const persist = () => updateFounderProfile({ startupName, oneLiner, stage, industries, foundingYear, website, logoEmoji });
  const handleNext     = () => { persist(); navigate("/founder/onboarding/step-3"); };
  const handleBack     = () => { persist(); navigate("/founder/onboarding/step-1"); };
  const handleSaveExit = () => { persist(); navigate("/"); };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-2xl">
        <div className="flex justify-end mb-4">
          <button onClick={handleSaveExit} className="text-sm text-slate-500 hover:text-slate-900">Save &amp; exit</button>
        </div>
        <FounderProgressBar currentStep={2} totalSteps={6} />
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Tell us about your startup</h1>
          <p className="text-base text-slate-600">Give us the snapshot. This is what collaborators and investors will see first.</p>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block mb-2 text-sm font-semibold text-slate-700">Startup name</label>
            <input value={startupName} onChange={(e) => setStartupName(e.target.value)} placeholder="Acme Inc."
              className="w-full h-12 bg-white border-2 border-slate-300 rounded-lg px-4 text-base outline-none focus:border-violet-500 transition-colors" />
          </div>

          <div>
            <label className="block mb-2 text-sm font-semibold text-slate-700">
              One-liner <span className="text-slate-400 font-normal">({oneLiner.length}/140)</span>
            </label>
            <input value={oneLiner} onChange={(e) => setOneLiner(e.target.value)} maxLength={140}
              placeholder="We help African SMEs access working capital in under 24 hours."
              className="w-full h-12 bg-white border-2 border-slate-300 rounded-lg px-4 text-base outline-none focus:border-violet-500 transition-colors" />
          </div>

          <div>
            <label className="block mb-3 text-sm font-semibold text-slate-700">Stage</label>
            <div className="grid grid-cols-5 gap-2">
              {STAGES.map((s) => (
                <button key={s} type="button" onClick={() => setStage(s)}
                  className={`px-3 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                    stage === s
                      ? "border-violet-500 bg-violet-50 text-violet-700"
                      : "border-slate-300 bg-white text-slate-700 hover:border-violet-300"
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block mb-3 text-sm font-semibold text-slate-700">
              Industries <span className="text-slate-400 font-normal">({industries.length} of 1–3 selected)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {INDUSTRIES.map((ind) => (
                <button key={ind} type="button" onClick={() => toggleIndustry(ind)}
                  className={`px-3 py-1.5 rounded-full border text-sm transition-all ${
                    industries.includes(ind)
                      ? "border-violet-500 bg-violet-50 text-violet-700"
                      : "border-slate-300 bg-white text-slate-600 hover:border-violet-300"
                  }`}>
                  {ind}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block mb-2 text-sm font-semibold text-slate-700">Founding year</label>
            <input type="number" min={1990} max={2030} value={foundingYear}
              onChange={(e) => setFoundingYear(Number(e.target.value) || new Date().getFullYear())}
              className="w-full h-12 bg-white border-2 border-slate-300 rounded-lg px-4 text-base outline-none focus:border-violet-500 transition-colors tabular-nums" />
          </div>

          <div>
            <label className="block mb-2 text-sm font-semibold text-slate-700">Website <span className="text-slate-400 font-normal">(optional)</span></label>
            <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://yourstartup.com"
              className="w-full h-12 bg-white border-2 border-slate-300 rounded-lg px-4 text-base outline-none focus:border-violet-500 transition-colors" />
          </div>

          <div>
            <label className="block mb-2 text-sm font-semibold text-slate-700">Logo emoji <span className="text-slate-400 font-normal">(optional)</span></label>
            <input value={logoEmoji} onChange={(e) => setLogoEmoji(e.target.value)} maxLength={4}
              placeholder="🚀"
              className="w-32 h-12 bg-white border-2 border-slate-300 rounded-lg px-4 text-2xl outline-none focus:border-violet-500 transition-colors" />
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
