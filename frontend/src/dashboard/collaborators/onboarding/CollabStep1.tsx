import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCollaboratorProfile } from "@/contexts/UserContext";
import { CollabProgressBar } from "./CollabProgressBar";
import { User, MapPin, Briefcase, Calendar, MessageSquare } from "lucide-react";

export function CollabStep1() {
  const navigate = useNavigate();
  const { collaboratorProfile, updateCollaboratorProfile } = useCollaboratorProfile();
  const [name, setName]             = useState(collaboratorProfile.name);
  const [title, setTitle]           = useState(collaboratorProfile.title);
  const [location, setLocation]     = useState(collaboratorProfile.location);
  const [years, setYears]           = useState(collaboratorProfile.yearsExperience);
  const [headline, setHeadline]     = useState(collaboratorProfile.headline);

  const canContinue = name.trim() && title.trim() && location.trim() && years >= 0 && headline.trim();

  const handleNext = () => {
    updateCollaboratorProfile({ name, title, location, yearsExperience: years, headline });
    navigate("/collaborator/onboarding/step-2");
  };
  const handleSaveExit = () => {
    updateCollaboratorProfile({ name, title, location, yearsExperience: years, headline });
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-2xl">
        <div className="flex justify-end mb-4">
          <button onClick={handleSaveExit} className="text-sm text-slate-500 hover:text-slate-900">Save & exit</button>
        </div>
        <CollabProgressBar currentStep={1} totalSteps={6} />
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Tell us who you are</h1>
          <p className="text-base text-slate-600">The basics. We'll use this on your public profile and to match you with the right builds.</p>
        </div>

        <div className="space-y-5">
          <Field label="Full name" icon={User}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Chen"
              className="w-full h-12 bg-white border-2 border-slate-300 rounded-lg px-4 text-base outline-none focus:border-amber-500 transition-colors" />
          </Field>
          <Field label="Professional title" icon={Briefcase}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Senior Frontend Engineer"
              className="w-full h-12 bg-white border-2 border-slate-300 rounded-lg px-4 text-base outline-none focus:border-amber-500 transition-colors" />
          </Field>
          <Field label="Location" icon={MapPin}>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Lagos, Nigeria"
              className="w-full h-12 bg-white border-2 border-slate-300 rounded-lg px-4 text-base outline-none focus:border-amber-500 transition-colors" />
          </Field>
          <Field label="Years of experience" icon={Calendar}>
            <input type="number" min={0} max={60} value={years} onChange={(e) => setYears(Number(e.target.value) || 0)}
              className="w-full h-12 bg-white border-2 border-slate-300 rounded-lg px-4 text-base outline-none focus:border-amber-500 transition-colors tabular-nums" />
          </Field>
          <Field label="Headline (one line)" icon={MessageSquare}>
            <input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={120}
              placeholder="I ship product-grade React systems quickly."
              className="w-full h-12 bg-white border-2 border-slate-300 rounded-lg px-4 text-base outline-none focus:border-amber-500 transition-colors" />
          </Field>
        </div>

        <div className="flex justify-end mt-10">
          <button onClick={handleNext} disabled={!canContinue}
            className="px-6 py-3 rounded-lg bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors">
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, icon: Icon, children }: { label: string; icon: typeof User; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-2 mb-2 text-sm font-semibold text-slate-700">
        <Icon className="w-4 h-4 text-slate-400" /> {label}
      </label>
      {children}
    </div>
  );
}
