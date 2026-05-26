import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCollaboratorProfile } from "@/contexts/UserContext";
import { CollabProgressBar } from "./CollabProgressBar";

const SUGGESTIONS = ["TypeScript", "tRPC", "Tailwind", "Redis", "Playwright", "Jest", "Figma", "Postgres"];

export function CollabStep3() {
  const navigate = useNavigate();
  const { collaboratorProfile, updateCollaboratorProfile } = useCollaboratorProfile();
  const [stack, setStack] = useState<string[]>(collaboratorProfile.techStack);
  const [draft, setDraft] = useState("");

  const addChip = (v: string) => {
    const trimmed = v.trim();
    if (!trimmed || stack.includes(trimmed)) { setDraft(""); return; }
    setStack((cur) => [...cur, trimmed]);
    setDraft("");
  };
  const removeChip = (s: string) => setStack((cur) => cur.filter((x) => x !== s));
  const canContinue = stack.length >= 3;

  const persist = () => updateCollaboratorProfile({ techStack: stack });
  const handleNext = () => { persist(); navigate("/collaborator/onboarding/step-4"); };
  const handleBack = () => { persist(); navigate("/collaborator/onboarding/step-2"); };
  const handleSaveExit = () => { persist(); navigate("/dashboard"); };

  const suggestions = SUGGESTIONS.filter((s) => !stack.includes(s)).slice(0, 8);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-2xl">
        <div className="flex justify-end mb-4">
          <button onClick={handleSaveExit} className="text-sm text-slate-500 hover:text-slate-900">Save & exit</button>
        </div>
        <CollabProgressBar currentStep={3} totalSteps={6} />

        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Tech stack & tools</h1>
          <p className="text-base text-slate-600">Add at least 3. Hit Enter or click + to add.</p>
        </div>

        <div className="mb-6">
          <div className="flex flex-wrap gap-2 mb-4">
            {stack.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-500 text-amber-700 text-sm font-medium">
                {s}
                <button type="button" onClick={() => removeChip(s)} className="text-amber-400 hover:text-amber-700 leading-none">×</button>
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addChip(draft); } }}
              placeholder="e.g. Next.js"
              className="flex-1 h-12 bg-white border-2 border-slate-300 rounded-lg px-4 text-base outline-none focus:border-amber-500 transition-colors"
            />
            <button type="button" onClick={() => addChip(draft)}
              className="h-12 w-12 rounded-lg bg-amber-500 text-slate-900 font-bold text-xl hover:bg-amber-400 transition-colors flex items-center justify-center">
              +
            </button>
          </div>
        </div>

        {suggestions.length > 0 && (
          <div className="mb-8">
            <p className="text-sm font-semibold text-slate-500 mb-3">Suggested</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button key={s} type="button" onClick={() => addChip(s)}
                  className="px-3 py-1.5 rounded-full border border-slate-300 bg-white text-slate-600 text-sm hover:border-amber-300 transition-all">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

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
