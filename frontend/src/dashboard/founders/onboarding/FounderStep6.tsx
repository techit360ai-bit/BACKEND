import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useFounderProfile } from "@/contexts/UserContext";
import { FounderProgressBar } from "./FounderProgressBar";

const NEEDS_OPTIONS = [
  "Find collaborators", "Find investors", "Validate the idea", "Build the MVP faster",
  "Customer interviews", "Pricing experiments", "Hire first sales hire",
  "Hackathon momentum", "Mentorship", "Just exploring",
];

export function FounderStep6() {
  const navigate = useNavigate();
  const { founderProfile, updateFounderProfile } = useFounderProfile();
  const [github, setGithub]     = useState(founderProfile.links.github);
  const [linkedin, setLinkedin] = useState(founderProfile.links.linkedin);
  const [twitter, setTwitter]   = useState(founderProfile.links.twitter);
  const [personal, setPersonal] = useState(founderProfile.links.personal);
  const [needs, setNeeds]       = useState<string[]>(founderProfile.needsFromTechIT);
  const [pinned, setPinned]     = useState<string[]>(founderProfile.pinnedWork);

  const toggleNeed = (n: string) => {
    setNeeds((cur) => {
      if (cur.includes(n)) return cur.filter((x) => x !== n);
      if (cur.length >= 3) return cur;
      return [...cur, n];
    });
  };

  const updatePinned = (i: number, v: string) => setPinned((cur) => cur.map((p, idx) => idx === i ? v : p));
  const removePinned = (i: number) => setPinned((cur) => cur.filter((_, idx) => idx !== i));
  const addPinned = () => { if (pinned.length < 3) setPinned((cur) => [...cur, ""]); };

  const handleFinish = () => {
    updateFounderProfile({
      links: { github, linkedin, twitter, personal },
      needsFromTechIT: needs,
      pinnedWork: pinned.filter((u) => u.trim()),
      onboardingComplete: true,
    });
    toast.success(`You're in. Welcome to TechIT, ${founderProfile.name.split(" ")[0]}.`);
    navigate("/dashboard");
  };

  const handleBack = () => {
    updateFounderProfile({
      links: { github, linkedin, twitter, personal },
      needsFromTechIT: needs,
      pinnedWork: pinned.filter((u) => u.trim()),
    });
    navigate("/founder/onboarding/step-5");
  };

  const handleSaveExit = () => {
    updateFounderProfile({
      links: { github, linkedin, twitter, personal },
      needsFromTechIT: needs,
      pinnedWork: pinned.filter((u) => u.trim()),
    });
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-2xl">
        <div className="flex justify-end mb-4">
          <button onClick={handleSaveExit} className="text-sm text-muted-foreground hover:text-foreground">Save &amp; exit</button>
        </div>
        <FounderProgressBar currentStep={6} totalSteps={6} />
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-foreground mb-2">Goals &amp; links</h1>
          <p className="text-base text-muted-foreground">All optional — but the more you share, the better your matches.</p>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block mb-2 text-sm font-semibold text-foreground">GitHub <span className="text-muted-foreground/70 font-normal">(optional)</span></label>
            <input value={github} onChange={(e) => setGithub(e.target.value)} placeholder="https://github.com/username"
              className="w-full h-12 bg-background border-2 border-border rounded-lg px-4 text-base outline-none focus:border-violet-500 transition-colors" />
          </div>
          <div>
            <label className="block mb-2 text-sm font-semibold text-foreground">LinkedIn <span className="text-muted-foreground/70 font-normal">(optional)</span></label>
            <input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/username"
              className="w-full h-12 bg-background border-2 border-border rounded-lg px-4 text-base outline-none focus:border-violet-500 transition-colors" />
          </div>
          <div>
            <label className="block mb-2 text-sm font-semibold text-foreground">X / Twitter <span className="text-muted-foreground/70 font-normal">(optional)</span></label>
            <input value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="https://twitter.com/username"
              className="w-full h-12 bg-background border-2 border-border rounded-lg px-4 text-base outline-none focus:border-violet-500 transition-colors" />
          </div>
          <div>
            <label className="block mb-2 text-sm font-semibold text-foreground">Personal site <span className="text-muted-foreground/70 font-normal">(optional)</span></label>
            <input value={personal} onChange={(e) => setPersonal(e.target.value)} placeholder="https://yoursite.com"
              className="w-full h-12 bg-background border-2 border-border rounded-lg px-4 text-base outline-none focus:border-violet-500 transition-colors" />
          </div>

          <div>
            <label className="block mb-3 text-sm font-semibold text-foreground">
              What do you need from TechIT right now? <span className="text-muted-foreground/70 font-normal">({needs.length} of 3)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {NEEDS_OPTIONS.map((n) => (
                <button key={n} type="button" onClick={() => toggleNeed(n)}
                  className={`px-3 py-1.5 rounded-full border text-sm transition-all ${
                    needs.includes(n)
                      ? "border-violet-500 bg-violet-50 text-violet-700"
                      : "border-border bg-background text-muted-foreground hover:border-violet-300"
                  }`}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block mb-2 text-sm font-semibold text-foreground">Pinned work <span className="text-muted-foreground/70 font-normal">(optional, up to 3 URLs)</span></label>
            <div className="space-y-2">
              {pinned.map((url, i) => (
                <div key={i} className="flex gap-2">
                  <input value={url} onChange={(e) => updatePinned(i, e.target.value)}
                    placeholder="https://project-url.com"
                    className="flex-1 h-12 bg-background border-2 border-border rounded-lg px-4 text-base outline-none focus:border-violet-500 transition-colors" />
                  <button type="button" onClick={() => removePinned(i)}
                    className="h-12 w-12 rounded-lg border-2 border-border text-muted-foreground hover:border-red-300 hover:text-red-500 transition-colors flex items-center justify-center text-lg">
                    ×
                  </button>
                </div>
              ))}
            </div>
            {pinned.length < 3 && (
              <button type="button" onClick={addPinned}
                className="mt-2 text-sm text-violet-600 hover:text-violet-800 font-semibold transition-colors">
                + Add link
              </button>
            )}
          </div>

          <div className="rounded-lg bg-muted/40 border border-border px-4 py-3 text-sm text-muted-foreground">
            Verify your GitHub / socials / ID in Settings → Verification after you finish.
            Verified founders see more matches.
          </div>
        </div>

        <div className="flex justify-between mt-10">
          <button onClick={handleBack} className="px-6 py-3 rounded-lg text-foreground hover:bg-muted/40 font-semibold transition-colors">← Back</button>
          <button onClick={handleFinish}
            className="px-6 py-3 rounded-lg bg-violet-600 text-white font-semibold hover:bg-violet-500 transition-colors">
            Finish →
          </button>
        </div>
      </div>
    </div>
  );
}
