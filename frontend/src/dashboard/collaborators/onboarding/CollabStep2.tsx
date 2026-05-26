import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCollaboratorProfile, type CollaboratorDiscipline } from "@/contexts/UserContext";
import { CollabProgressBar } from "./CollabProgressBar";

const disciplines: CollaboratorDiscipline[] = [
  "Engineering", "Design", "Product", "Data & ML",
  "DevOps", "Security", "Marketing", "Research",
];

const subSkillsByDiscipline: Record<CollaboratorDiscipline, string[]> = {
  "Engineering": ["React", "TypeScript", "Node.js", "Python", "Go", "Rust", "System design", "Performance", "Mobile (RN/iOS/Android)", "Backend APIs", "Testing", "GraphQL", "Realtime", "Web3"],
  "Design":      ["Product", "Visual", "Brand", "UX research", "Design systems", "Motion", "Illustration", "Prototyping", "3D", "Webflow/Framer", "Figma", "Pitch decks", "Marketing pages", "Iconography"],
  "Product":     ["Discovery", "Roadmapping", "PRDs", "Analytics", "Pricing", "GTM", "Growth experiments", "A/B testing", "Stakeholder mgmt", "Customer interviews", "Spec writing", "Prioritisation", "OKRs", "PMing AI features"],
  "Data & ML":   ["Modelling", "MLOps", "NLP", "CV", "RAG", "Fine-tuning", "Evals", "Recommenders", "Time series", "Forecasting", "SQL", "dbt", "Notebooks", "Dashboards"],
  "DevOps":      ["AWS", "GCP", "Azure", "K8s", "Terraform", "CI/CD", "Observability", "Incident response", "Cost optimization", "Container orchestration", "Edge/CDN", "Serverless", "Networking", "Backups"],
  "Security":    ["AppSec", "Pen testing", "SAST/DAST", "Threat modelling", "IAM", "Compliance (SOC2/ISO/GDPR)", "Secrets mgmt", "Audit logging", "Zero trust", "Crypto", "Incident response", "Bug bounty", "Cloud security", "Red team"],
  "Marketing":   ["Content", "SEO", "Paid ads", "Lifecycle", "Email", "Brand", "Social", "Community", "PR", "Launches", "Partnerships", "Analytics", "Creator marketing", "Founder-led"],
  "Research":    ["User research", "Market research", "Behavioural research", "Quant", "Qual", "Surveys", "Diary studies", "Usability", "Interviews", "Competitive analysis", "Synthesis", "Repository", "Insights", "Strategy"],
};

export function CollabStep2() {
  const navigate = useNavigate();
  const { collaboratorProfile, updateCollaboratorProfile } = useCollaboratorProfile();
  const [discipline, setDiscipline] = useState<CollaboratorDiscipline | "">(collaboratorProfile.discipline);
  const [subSkills, setSubSkills]   = useState<string[]>(collaboratorProfile.subSkills);

  const toggleSkill = (s: string) => setSubSkills((cur) => cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]);
  const canContinue = discipline && subSkills.length >= 3 && subSkills.length <= 8;

  const persist = () => updateCollaboratorProfile({ discipline, subSkills });
  const handleNext = () => { persist(); navigate("/collaborator/onboarding/step-3"); };
  const handleBack = () => { persist(); navigate("/collaborator/onboarding/step-1"); };
  const handleSaveExit = () => { persist(); navigate("/dashboard"); };

  const skillOptions = discipline ? subSkillsByDiscipline[discipline] : [];

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-2xl">
        <div className="flex justify-end mb-4"><button onClick={handleSaveExit} className="text-sm text-slate-500 hover:text-slate-900">Save & exit</button></div>
        <CollabProgressBar currentStep={2} totalSteps={6} />

        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">What do you build?</h1>
          <p className="text-base text-slate-600">Pick one primary discipline, then 3–8 specific skills.</p>
        </div>

        <div className="mb-8">
          <label className="block mb-3 text-sm font-semibold text-slate-700">Primary discipline</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {disciplines.map((d) => (
              <button key={d} type="button" onClick={() => { setDiscipline(d); setSubSkills([]); }}
                className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                  discipline === d ? "border-amber-500 bg-amber-50 text-amber-700"
                                   : "border-slate-300 bg-white text-slate-700 hover:border-amber-300"}`}>
                {d}
              </button>
            ))}
          </div>
        </div>

        {discipline && (
          <div className="mb-8">
            <label className="block mb-3 text-sm font-semibold text-slate-700">
              Sub-skills <span className="text-slate-400 font-normal">({subSkills.length} of 3–8 selected)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {skillOptions.map((s) => (
                <button key={s} type="button" onClick={() => toggleSkill(s)}
                  className={`px-3 py-1.5 rounded-full border text-sm transition-all ${
                    subSkills.includes(s) ? "border-amber-500 bg-amber-50 text-amber-700"
                                          : "border-slate-300 bg-white text-slate-600 hover:border-amber-300"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-between mt-10">
          <button onClick={handleBack} className="px-6 py-3 rounded-lg text-slate-700 hover:bg-slate-100 font-semibold transition-colors">← Back</button>
          <button onClick={handleNext} disabled={!canContinue}
            className="px-6 py-3 rounded-lg bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors">Continue →</button>
        </div>
      </div>
    </div>
  );
}
