import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInvestorProfile } from "@/contexts/UserContext";
import { InvestorProgressBar } from "./InvestorProgressBar";
import { Button } from "@/components/ui/button";
import { Brain, DollarSign, Blocks, Bot, Heart, Leaf } from "lucide-react";

const industries = [
  { id: "AI", label: "AI", icon: Brain },
  { id: "Fintech", label: "Fintech", icon: DollarSign },
  { id: "Web3", label: "Web3", icon: Blocks },
  { id: "Robotics", label: "Robotics", icon: Bot },
  { id: "Health", label: "Health", icon: Heart },
  { id: "Climate", label: "Climate", icon: Leaf },
];

const stages = [
  { id: "Idea", label: "Idea" },
  { id: "Pre-Seed", label: "Pre-Seed" },
  { id: "Seed", label: "Seed" },
  { id: "Series A", label: "Series A" },
];

const checkSizes = [
  { id: "$10k–$50k", label: "$10k–$50k" },
  { id: "$50k–$200k", label: "$50k–$200k" },
  { id: "$200k–$1M", label: "$200k–$1M" },
  { id: "$1M+", label: "$1M+" },
];

export function InvestorStep2() {
  const navigate = useNavigate();
  const { investorProfile, updateInvestorProfile } = useInvestorProfile();
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>(
    investorProfile.industries,
  );
  const [stage, setStage] = useState(investorProfile.stage);
  const [checkSize, setCheckSize] = useState(investorProfile.checkSize);

  const toggleIndustry = (industry: string) => {
    setSelectedIndustries((prev) =>
      prev.includes(industry)
        ? prev.filter((i) => i !== industry)
        : [...prev, industry],
    );
  };

  const handleNext = () => {
    updateInvestorProfile({ industries: selectedIndustries, stage, checkSize });
    navigate("/investor/onboarding/step-3");
  };

  const handleBack = () => {
    navigate("/investor/onboarding/step-1");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-teal-50/20 to-slate-50 dark:from-slate-950 dark:via-slate-900/30 dark:to-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-5xl">
        <InvestorProgressBar currentStep={2} totalSteps={5} />

        <div className="mb-12">
          <h1 className="text-5xl sm:text-4xl mb-3 text-slate-900 dark:text-white font-bold tracking-tight">
            Investment Focus
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 font-medium">
            Define your investment criteria
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14">
          {/* Left: Industries */}
          <div>
            <label className="block mb-5 text-slate-900 dark:text-white font-semibold text-lg">
              Industries
            </label>
            <div className="grid grid-cols-2 gap-4">
              {industries.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => toggleIndustry(id)}
                  className={`p-6 rounded-xl border-2 transition-all duration-200 ${
                    selectedIndustries.includes(id)
                      ? "border-teal-500 bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-500/20 dark:to-teal-600/10 text-teal-700 dark:text-teal-300 shadow-[0_8px_24px_rgba(20,184,166,0.15)]"
                      : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-teal-400 dark:hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-500/10 hover:shadow-[0_6px_16px_rgba(20,184,166,0.12)] shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                  }`}
                >
                  <Icon className="w-8 h-8 mx-auto mb-4 opacity-90" />
                  <div className="text-center font-semibold">{label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Stage & Check Size */}
          <div className="space-y-10">
            {/* Stage */}
            <div>
              <label className="block mb-5 text-slate-900 dark:text-white font-semibold text-lg">
                Stage
              </label>
              <div className="space-y-3">
                {stages.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setStage(id)}
                    className={`w-full flex items-center space-x-4 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer font-medium shadow-[0_2px_8px_rgba(0,0,0,0.06)] ${
                      stage === id
                        ? "border-teal-500 bg-gradient-to-r from-teal-50 to-teal-100 dark:from-teal-500/20 dark:to-teal-600/10 text-teal-700 dark:text-teal-300 shadow-[0_6px_16px_rgba(20,184,166,0.12)]"
                        : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-teal-400 dark:hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-500/10 hover:shadow-[0_6px_16px_rgba(20,184,166,0.12)]"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        stage === id
                          ? "border-teal-500 bg-teal-500"
                          : "border-slate-400 dark:border-slate-600"
                      }`}
                    >
                      {stage === id && (
                        <div className="w-2.5 h-2.5 bg-white rounded-full" />
                      )}
                    </div>
                    <label className="flex-1 cursor-pointer">{label}</label>
                  </button>
                ))}
              </div>
            </div>

            {/* Check Size */}
            <div>
              <label className="block mb-5 text-slate-900 dark:text-white font-semibold text-lg">
                Check Size
              </label>
              <div className="space-y-3">
                {checkSizes.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setCheckSize(id)}
                    className={`w-full flex items-center space-x-4 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer font-medium shadow-[0_2px_8px_rgba(0,0,0,0.06)] ${
                      checkSize === id
                        ? "border-teal-500 bg-gradient-to-r from-teal-50 to-teal-100 dark:from-teal-500/20 dark:to-teal-600/10 text-teal-700 dark:text-teal-300 shadow-[0_6px_16px_rgba(20,184,166,0.12)]"
                        : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-teal-400 dark:hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-500/10 hover:shadow-[0_6px_16px_rgba(20,184,166,0.12)]"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        checkSize === id
                          ? "border-teal-500 bg-teal-500"
                          : "border-slate-400 dark:border-slate-600"
                      }`}
                    >
                      {checkSize === id && (
                        <div className="w-2.5 h-2.5 bg-white rounded-full" />
                      )}
                    </div>
                    <label className="flex-1 cursor-pointer">{label}</label>
                  </button>
                ))}
              </div>
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
            onClick={handleNext}
            disabled={selectedIndustries.length === 0 || !stage || !checkSize}
            className="px-10 py-6 text-lg bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 dark:from-teal-500 dark:to-cyan-500 dark:hover:from-teal-600 dark:hover:to-cyan-600 text-white font-bold shadow-lg hover:shadow-xl transition-all duration-200"
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
