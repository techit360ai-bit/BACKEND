import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOrgProfile, type OrgPlan } from "@/contexts/UserContext";
import { OrgProgressBar } from "./OrgProgressBar";
import { CheckCircle2, Sparkles, Rocket, Building2 } from "lucide-react";

const plans: {
  id: OrgPlan;
  name: string;
  blurb: string;
  price: string;
  features: string[];
  icon: typeof Sparkles;
  accent: string;
}[] = [
  {
    id: "free",
    name: "Free",
    blurb: "Test the platform with one programme",
    price: "$0/mo",
    features: ["1 active programme", "Up to 50 builders", "Basic analytics"],
    icon: Sparkles,
    accent: "border-slate-300 dark:border-slate-700",
  },
  {
    id: "growth",
    name: "Growth",
    blurb: "Run accelerators, hackathons and grants",
    price: "$499/mo",
    features: [
      "Unlimited programmes",
      "Up to 1,000 builders",
      "Hackathon command centre",
      "Sponsor reporting",
      "Talent pool search",
    ],
    icon: Rocket,
    accent: "border-indigo-500",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    blurb: "For multi-region partners and corporates",
    price: "Custom",
    features: [
      "Everything in Growth",
      "Dedicated success manager",
      "Custom integrations & SSO",
      "Cohort trajectory tracking",
      "White-label option",
    ],
    icon: Building2,
    accent: "border-violet-500",
  },
];

export function OrgStep5() {
  const navigate = useNavigate();
  const { orgProfile, updateOrgProfile } = useOrgProfile();
  const [plan, setPlan] = useState<OrgPlan>(orgProfile.plan);

  const handleComplete = () => {
    updateOrgProfile({ plan });
    navigate("/org/profile");
  };
  const handleBack = () => navigate("/org/onboarding/step-4");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900/80 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-5xl">
        <OrgProgressBar currentStep={5} totalSteps={5} />

        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">
            Choose your plan
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-400">
            You can change this any time from Billing &amp; Usage.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          {plans.map((p) => {
            const active = plan === p.id;
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                onClick={() => setPlan(p.id)}
                className={`text-left p-6 rounded-2xl border-2 transition-all ${
                  active
                    ? `${p.accent} bg-white dark:bg-slate-800/60 shadow-xl ring-2 ring-indigo-500/20`
                    : "border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/40 hover:border-indigo-300"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center ${active ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400" : "bg-slate-100 dark:bg-slate-700/50 text-slate-500"}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  {active && (
                    <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                  )}
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                  {p.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  {p.blurb}
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                  {p.price}
                </p>
                <ul className="space-y-1.5 text-sm">
                  {p.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-slate-700 dark:text-slate-300"
                    >
                      <CheckCircle2
                        className={`w-4 h-4 mt-0.5 flex-shrink-0 ${active ? "text-indigo-600" : "text-slate-400"}`}
                      />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        <div className="flex justify-between gap-4">
          <button
            onClick={handleBack}
            className="px-6 py-4 rounded-xl border-2 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold hover:border-indigo-400 transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleComplete}
            className="px-12 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all"
          >
            Complete setup
          </button>
        </div>
      </div>
    </div>
  );
}
