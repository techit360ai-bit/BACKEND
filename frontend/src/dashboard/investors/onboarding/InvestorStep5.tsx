import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInvestorProfile } from "@/contexts/UserContext";
import { InvestorProgressBar } from "./InvestorProgressBar";
import { Button } from "@/components/ui/button";
import { Gauge, Globe, DollarSign, Users } from "lucide-react";

const metrics = [
  {
    id: "Execution Velocity",
    label: "Execution Velocity",
    description: "How fast the startup ships features and iterates",
    icon: Gauge,
  },
  {
    id: "Market Readiness",
    label: "Market Readiness",
    description: "Market timing and competitive positioning analysis",
    icon: Globe,
  },
  {
    id: "Revenue Traction",
    label: "Revenue Traction",
    description: "Revenue growth rate and monetization strength",
    icon: DollarSign,
  },
  {
    id: "Beta Retention",
    label: "Beta Retention",
    description: "User retention and engagement metrics from beta",
    icon: Users,
  },
];

export function InvestorStep5() {
  const navigate = useNavigate();
  const { investorProfile, updateInvestorProfile } = useInvestorProfile();
  const [dashboardMetrics, setDashboardMetrics] = useState<string[]>(
    investorProfile.dashboardMetrics,
  );

  const toggleMetric = (metricId: string) => {
    setDashboardMetrics((prev) =>
      prev.includes(metricId)
        ? prev.filter((m) => m !== metricId)
        : [...prev, metricId],
    );
  };

  const handleComplete = () => {
    updateInvestorProfile({ dashboardMetrics });
    navigate("/investor/profile");
  };

  const handleBack = () => {
    navigate("/investor/onboarding/step-4");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-teal-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900/80 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-3xl">
        <InvestorProgressBar currentStep={5} totalSteps={5} />

        <div className="mb-12">
          <h1 className="text-5xl sm:text-4xl mb-3 text-slate-900 dark:text-white font-bold tracking-tight">
            Customize Your Deal Discovery Feed
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 font-medium">
            These metrics will prioritize which startups appear in your deal
            flow
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            const isActive = dashboardMetrics.includes(metric.id);

            return (
              <button
                key={metric.id}
                onClick={() => toggleMetric(metric.id)}
                className={`p-6 rounded-xl border-2 transition-all duration-200 text-left ${
                  isActive
                    ? "border-teal-500 bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-500/20 dark:to-teal-600/10 shadow-[0_8px_24px_rgba(20,184,166,0.15)]"
                    : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/40 hover:border-teal-400 dark:hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-500/10 hover:shadow-[0_6px_16px_rgba(20,184,166,0.12)] shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`p-3 rounded-lg transition-all ${isActive ? "bg-teal-200 dark:bg-teal-500/40" : "bg-slate-100 dark:bg-slate-700/40"}`}
                  >
                    <Icon
                      className={`w-6 h-6 ${isActive ? "text-teal-700 dark:text-teal-300" : "text-slate-600 dark:text-slate-500"}`}
                    />
                  </div>
                  <div
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-all cursor-pointer ${
                      isActive
                        ? "bg-white border-2 border-teal-500 shadow-md"
                        : "bg-slate-300 dark:bg-slate-600"
                    }`}
                  >
                    <span
                      className={`inline-block h-7 w-7 transform rounded-full ${
                        isActive
                          ? "bg-teal-500 translate-x-6 shadow-md"
                          : "bg-white translate-x-0.5 shadow-md"
                      } transition-all`}
                    />
                  </div>
                </div>
                <h3 className="text-slate-900 dark:text-white mb-2 font-bold text-base">
                  {metric.label}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                  {metric.description}
                </p>
              </button>
            );
          })}
        </div>

        <div className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-500/15 dark:to-teal-600/10 border-2 border-teal-300 dark:border-teal-500/30 rounded-xl p-6 mb-12 shadow-[0_4px_12px_rgba(20,184,166,0.1)]">
          <div className="flex items-start gap-4">
            <div className="w-2 h-2 rounded-full bg-teal-500 dark:bg-teal-400 mt-2 flex-shrink-0 animate-pulse" />
            <div>
              <p className="text-slate-900 dark:text-white mb-2 font-bold text-base">
                Selected Metrics: {dashboardMetrics.length} of {metrics.length}
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                Our AI will surface startups that excel in your chosen metrics,
                ensuring your deal pipeline matches your investment thesis.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-16 flex justify-between">
          <Button
            onClick={handleBack}
            variant="outline"
            className="px-8 py-6 text-base font-semibold border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-teal-400 dark:hover:border-teal-500 hover:text-teal-700 dark:hover:text-teal-300 transition-all duration-200"
          >
            Back
          </Button>
          <Button
            onClick={handleComplete}
            className="px-10 py-6 text-lg bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 dark:from-teal-500 dark:to-cyan-500 dark:hover:from-teal-600 dark:hover:to-cyan-600 text-white font-bold shadow-lg hover:shadow-xl transition-all duration-200"
          >
            Complete Setup
          </Button>
        </div>
      </div>
    </div>
  );
}
