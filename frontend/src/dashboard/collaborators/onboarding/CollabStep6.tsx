import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useCollaboratorProfile } from "@/contexts/UserContext";
import { CollabProgressBar } from "./CollabProgressBar";

export function CollabStep6() {
  const navigate = useNavigate();
  const { collaboratorProfile, updateCollaboratorProfile } = useCollaboratorProfile();
  const [github, setGithub]       = useState(collaboratorProfile.links.github);
  const [linkedin, setLinkedin]   = useState(collaboratorProfile.links.linkedin);
  const [portfolio, setPortfolio] = useState(collaboratorProfile.links.portfolio);
  const [twitter, setTwitter]     = useState(collaboratorProfile.links.twitter);
  const [whyHere, setWhyHere]     = useState(collaboratorProfile.whyHere);
  const [pinned, setPinned]       = useState<string[]>(collaboratorProfile.pinnedWork);

  const addPinned = () => { if (pinned.length < 3) setPinned((cur) => [...cur, ""]); };
  const removePinned = (i: number) => setPinned((cur) => cur.filter((_, idx) => idx !== i));
  const updatePinned = (i: number, val: string) => setPinned((cur) => cur.map((v, idx) => idx === i ? val : v));

  const persist = () => updateCollaboratorProfile({
    links: { github, linkedin, portfolio, twitter },
    whyHere,
    pinnedWork: pinned.filter((u) => u.trim()),
  });

  const handleFinish = () => {
    updateCollaboratorProfile({
      links: { github, linkedin, portfolio, twitter },
      whyHere,
      pinnedWork: pinned.filter((u) => u.trim()),
      onboardingComplete: true,
    });
    toast.success("You're in. Welcome to TechIT.");
    navigate("/collaborator/dashboard");
  };

  const handleBack = () => { persist(); navigate("/collaborator/onboarding/step-5"); };
  const handleSaveExit = () => { persist(); navigate("/dashboard"); };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-2xl">
        <div className="flex justify-end mb-4">
          <button onClick={handleSaveExit} className="text-sm text-slate-500 hover:text-slate-900">Save & exit</button>
        </div>
        <CollabProgressBar currentStep={6} totalSteps={6} />

        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Portfolio & goals</h1>
          <p className="text-base text-slate-600">All optional — but the more you share, the better your matches.</p>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block mb-2 text-sm font-semibold text-slate-700">GitHub</label>
            <input value={github} onChange={(e) => setGithub(e.target.value)} placeholder="https://github.com/username"
              className="w-full h-12 bg-white border-2 border-slate-300 rounded-lg px-4 text-base outline-none focus:border-amber-500 transition-colors" />
          </div>
          <div>
            <label className="block mb-2 text-sm font-semibold text-slate-700">LinkedIn</label>
            <input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/username"
              className="w-full h-12 bg-white border-2 border-slate-300 rounded-lg px-4 text-base outline-none focus:border-amber-500 transition-colors" />
          </div>
          <div>
            <label className="block mb-2 text-sm font-semibold text-slate-700">Portfolio</label>
            <input value={portfolio} onChange={(e) => setPortfolio(e.target.value)} placeholder="https://yoursite.com"
              className="w-full h-12 bg-white border-2 border-slate-300 rounded-lg px-4 text-base outline-none focus:border-amber-500 transition-colors" />
          </div>
          <div>
            <label className="block mb-2 text-sm font-semibold text-slate-700">Twitter / X</label>
            <input value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="https://twitter.com/username"
              className="w-full h-12 bg-white border-2 border-slate-300 rounded-lg px-4 text-base outline-none focus:border-amber-500 transition-colors" />
          </div>

          <div>
            <label className="block mb-2 text-sm font-semibold text-slate-700">
              Why are you here? <span className="text-slate-400 font-normal">({whyHere.length}/200)</span>
            </label>
            <textarea
              value={whyHere} onChange={(e) => setWhyHere(e.target.value)} maxLength={200} rows={3}
              placeholder="What kind of product do you want to build equity in?"
              className="w-full bg-white border-2 border-slate-300 rounded-lg px-4 py-3 text-base outline-none focus:border-amber-500 transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block mb-2 text-sm font-semibold text-slate-700">Pinned work (up to 3 links)</label>
            <div className="space-y-2">
              {pinned.map((url, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={url} onChange={(e) => updatePinned(i, e.target.value)}
                    placeholder="https://project-url.com"
                    className="flex-1 h-12 bg-white border-2 border-slate-300 rounded-lg px-4 text-base outline-none focus:border-amber-500 transition-colors"
                  />
                  <button type="button" onClick={() => removePinned(i)}
                    className="h-12 w-12 rounded-lg border-2 border-slate-300 text-slate-500 hover:border-red-300 hover:text-red-500 transition-colors flex items-center justify-center text-lg">
                    ×
                  </button>
                </div>
              ))}
            </div>
            {pinned.length < 3 && (
              <button type="button" onClick={addPinned}
                className="mt-2 text-sm text-amber-600 hover:text-amber-800 font-semibold transition-colors">
                + Add link
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-between mt-10">
          <button onClick={handleBack} className="px-6 py-3 rounded-lg text-slate-700 hover:bg-slate-100 font-semibold transition-colors">← Back</button>
          <button onClick={handleFinish}
            className="px-6 py-3 rounded-lg bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors">
            Finish →
          </button>
        </div>
      </div>
    </div>
  );
}
