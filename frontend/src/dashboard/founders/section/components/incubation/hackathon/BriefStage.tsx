import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Lock, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import type { HackathonRegistration, IdeaBrief } from "@/contexts/UserContext";
import { useFounderProfile } from "@/contexts/UserContext";
import { scoreBrief } from "@/dashboard/_shared/hackathon/scoring";
import { momentumColor } from "@/dashboard/_shared/hackathon/momentum";

interface Props {
  registration: HackathonRegistration;
}

const FIELDS: { key: keyof Omit<IdeaBrief, "submittedAt">; label: string; helper: string }[] = [
  { key: "problem",        label: "Problem",         helper: "What specific pain are you solving, and for whom?" },
  { key: "targetUser",     label: "Target user",     helper: "Who exactly feels this? Be concrete." },
  { key: "solutionSketch", label: "Solution sketch", helper: "What will you actually build? Outline the core flow." },
  { key: "whyNow",         label: "Why now",         helper: "What changed recently that makes this the moment?" },
  { key: "differentiator", label: "Differentiator",  helper: "What makes this unlike existing alternatives?" },
  { key: "risk",           label: "Biggest risk",    helper: "What's most likely to sink this — and your hedge?" },
  { key: "successMetric",  label: "Success metric",  helper: "How will you know it worked? Add a number or timeframe." },
];

const MIN_CHARS = 20;
const SUB_SCORES: { key: "problemClarity" | "innovationGap" | "initialImpact"; label: string }[] = [
  { key: "problemClarity", label: "Problem Clarity" },
  { key: "innovationGap",  label: "Innovation Gap" },
  { key: "initialImpact",  label: "Initial Impact" },
];

const EMPTY: Record<string, string> = {
  problem: "", targetUser: "", solutionSketch: "", whyNow: "", differentiator: "", risk: "", successMetric: "",
};

function ScoreBar({ score, label }: { score: number; label: string }) {
  const color = momentumColor(score);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-slate-700">{label}</span>
        <span className={`text-xs font-semibold ${color.text}`}>{score}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-100">
        <div className={`h-1.5 rounded-full ${color.bar}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export function BriefStage({ registration }: Props) {
  const [, setSearchParams] = useSearchParams();
  const { submitBrief } = useFounderProfile();
  const [values, setValues] = useState<Record<string, string>>(EMPTY);

  // Live score preview — debounced via useMemo on the 7 field values.
  // Hoisted above the early return so hook order stays stable across locked/unlocked.
  const previewScore = useMemo(
    () => scoreBrief({ ...(values as unknown as IdeaBrief), submittedAt: "" }),
    [values],
  );

  const locked = !!registration.brief;

  const goToBuild = () => {
    const next = new URLSearchParams();
    next.set("panel", "hackathon");
    next.set("stage", "build");
    setSearchParams(next, { replace: true });
  };

  // ---- Post-submit locked view ----
  if (locked && registration.brief && registration.briefScore) {
    const brief = registration.brief;
    const score = registration.briefScore;
    const color = momentumColor(score.overall);
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="border border-slate-200 bg-white rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-4 h-4 text-slate-400" />
            <h2 className="text-base font-semibold text-slate-900">Idea brief — submitted</h2>
            <span className="ml-auto text-xs text-slate-500">Locked</span>
          </div>
          <dl className="space-y-3">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">{f.label}</dt>
                <dd className="text-sm text-slate-800 mt-0.5 whitespace-pre-wrap">{brief[f.key]}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="border border-slate-200 bg-white rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">Score breakdown</h3>
            <span className={`text-2xl font-bold ${color.text}`}>{score.overall}</span>
          </div>
          {SUB_SCORES.map((s) => (
            <div key={s.key} className="space-y-2">
              <ScoreBar score={score[s.key]} label={s.label} />
              <ul className="space-y-1 pl-1">
                {score.critiques[s.key].map((c, i) => (
                  <li key={i} className="text-xs text-slate-600 flex gap-1.5">
                    <span className="text-slate-300">•</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={goToBuild}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700"
          >
            Continue to Build <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ---- Pre-submit form ----
  const allValid = FIELDS.every((f) => values[f.key].trim().length >= MIN_CHARS);
  const color = momentumColor(previewScore.overall);

  const handleSubmit = () => {
    if (!allValid) return;
    const brief: IdeaBrief = {
      problem: values.problem.trim(),
      targetUser: values.targetUser.trim(),
      solutionSketch: values.solutionSketch.trim(),
      whyNow: values.whyNow.trim(),
      differentiator: values.differentiator.trim(),
      risk: values.risk.trim(),
      successMetric: values.successMetric.trim(),
      submittedAt: new Date().toISOString(),
    };
    submitBrief(registration.teamId, brief, scoreBrief(brief));
    toast.success("Brief submitted — Build stage unlocked");
    goToBuild();
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-slate-900">Submit your idea brief</h2>
        <p className="text-sm text-slate-600 mt-1">
          Seven fields, each at least {MIN_CHARS} characters. The brief locks on submit — make it count.
        </p>
      </div>

      <div className="space-y-5">
        {FIELDS.map((f) => {
          const val = values[f.key];
          const ok = val.trim().length >= MIN_CHARS;
          return (
            <div key={f.key}>
              <label className="block text-sm font-medium text-slate-800">{f.label}</label>
              <p className="text-xs text-slate-500 mb-1.5">{f.helper}</p>
              <textarea
                rows={3}
                value={val}
                onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
              />
              <div className="flex justify-end mt-1">
                <span className={`text-xs ${ok ? "text-slate-400" : "text-amber-600"}`}>
                  {val.trim().length}/{MIN_CHARS} min
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Score preview */}
      <div className="border border-slate-200 bg-slate-50 rounded-xl p-4 mt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-600 uppercase tracking-wider">Score preview</span>
          <span className={`text-xl font-bold ${color.text}`}>{previewScore.overall}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-200">
          <div className={`h-1.5 rounded-full ${color.bar}`} style={{ width: `${previewScore.overall}%` }} />
        </div>
        <p className="text-xs text-slate-500 mt-2">Critiques appear after you submit.</p>
      </div>

      <div className="flex justify-end mt-6">
        <button
          type="button"
          disabled={!allValid}
          onClick={handleSubmit}
          className={`text-sm font-medium px-4 py-2 rounded-lg ${
            allValid
              ? "bg-violet-600 text-white hover:bg-violet-700"
              : "bg-slate-100 text-slate-400 cursor-not-allowed"
          }`}
        >
          Submit brief
        </button>
      </div>
    </div>
  );
}
