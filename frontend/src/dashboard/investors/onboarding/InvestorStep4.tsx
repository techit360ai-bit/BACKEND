import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInvestorProfile } from "@/contexts/UserContext";
import { InvestorProgressBar } from "./InvestorProgressBar";
import { Button } from "@/components/ui/button";
import { Zap, Target, TrendingUp } from "lucide-react";

const riskProfiles = [
  {
    id: "High Risk Early Ideas",
    label: "High Risk — Early Ideas",
    icon: Zap,
    description:
      "Invest in founders with bold visions before product-market fit",
    color: "text-red-500",
  },
  {
    id: "Validated Prototypes",
    label: "Validated Prototypes",
    icon: Target,
    description: "Startups with proven concept and initial user validation",
    color: "text-teal-500 dark:text-teal-400",
  },
  {
    id: "Revenue Startups",
    label: "Revenue Startups",
    icon: TrendingUp,
    description: "Companies with consistent revenue and growth metrics",
    color: "text-cyan-500",
  },
];

const riskDescriptions: Record<string, string> = {
  "High Risk Early Ideas":
    "You thrive on discovering untapped potential. Your portfolio focuses on pre-product startups with visionary founders. You understand that 9/10 may fail, but the winners define industries.",
  "Validated Prototypes":
    "You balance risk and validation. You invest when there's clear product-market signals: user growth, engagement, or beta traction. You want proof of concept before writing checks.",
  "Revenue Startups":
    "You prioritize revenue metrics and sustainable growth. Your investments target startups with proven business models, recurring revenue, and clear paths to profitability.",
};

export function InvestorStep4() {
  const navigate = useNavigate();
  const { investorProfile, updateInvestorProfile } = useInvestorProfile();
  const [riskAppetite, setRiskAppetite] = useState(
    investorProfile.riskAppetite,
  );
  const [sliderValue, setSliderValue] = useState(
    riskProfiles.findIndex((p) => p.id === investorProfile.riskAppetite) || 1,
  );

  const handleSliderChange = (value: number) => {
    setSliderValue(value);
    setRiskAppetite(riskProfiles[value].id);
  };

  const handleNext = () => {
    updateInvestorProfile({ riskAppetite });
    navigate("/investor/onboarding/step-5");
  };

  const handleBack = () => {
    navigate("/investor/onboarding/step-3");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-teal-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900/80 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-4xl">
        <InvestorProgressBar currentStep={4} totalSteps={5} />

        <div className="mb-12">
          <h1 className="text-5xl sm:text-4xl mb-3 text-slate-900 dark:text-white font-bold tracking-tight">
            Your Investment Risk Profile
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 font-medium">
            Define your risk tolerance and investment stage preference
          </p>
        </div>

        {/* Risk Spectrum Slider */}
        <div className="mb-12 bg-white dark:bg-slate-800/40 border-2 border-slate-300 dark:border-slate-700 rounded-xl p-8 shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
          <div className="relative py-10 px-2">
            <div className="w-full h-3 bg-gradient-to-r from-red-500 via-teal-500 to-cyan-500 rounded-full shadow-lg"></div>
            <input
              type="range"
              min={0}
              max={2}
              step={1}
              value={sliderValue}
              onChange={(e) => handleSliderChange(parseInt(e.target.value))}
              className="absolute top-7 left-0 right-0 w-full h-3 appearance-none bg-transparent cursor-pointer"
              style={{
                WebkitAppearance: "none",
              }}
            />
            <style>{`
              input[type='range']::-webkit-slider-thumb {
                appearance: none;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                background: linear-gradient(135deg, #14b8a6, #06b6d4);
                cursor: pointer;
                border: 3px solid white;
                box-shadow: 0 4px 16px rgba(20, 184, 166, 0.4);
                transition: all 0.2s;
              }
              input[type='range']::-webkit-slider-thumb:hover {
                box-shadow: 0 6px 20px rgba(20, 184, 166, 0.6);
              }
              input[type='range']::-moz-range-thumb {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                background: linear-gradient(135deg, #14b8a6, #06b6d4);
                cursor: pointer;
                border: 3px solid white;
                box-shadow: 0 4px 16px rgba(20, 184, 166, 0.4);
                transition: all 0.2s;
              }
              input[type='range']::-moz-range-thumb:hover {
                box-shadow: 0 6px 20px rgba(20, 184, 166, 0.6);
              }
            `}</style>

            <div className="flex justify-between mt-10">
              {riskProfiles.map((profile, index) => (
                <div
                  key={profile.id}
                  className={`text-center transition-all duration-200 ${
                    sliderValue === index
                      ? "opacity-100 scale-110"
                      : "opacity-50"
                  }`}
                >
                  <div className={`text-sm font-bold ${profile.color}`}>
                    {profile.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI-Generated Description */}
          <div className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-500/15 dark:to-teal-600/10 border-2 border-teal-300 dark:border-teal-500/30 rounded-xl p-6 mt-8">
            <div className="flex items-start gap-4">
              <div className="w-2 h-2 rounded-full bg-teal-500 dark:bg-teal-400 mt-2 flex-shrink-0 animate-pulse" />
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                {riskDescriptions[riskAppetite]}
              </p>
            </div>
          </div>
        </div>

        {/* Risk Profile Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          {riskProfiles.map((profile) => {
            const Icon = profile.icon;
            return (
              <button
                key={profile.id}
                onClick={() => {
                  setRiskAppetite(profile.id);
                  setSliderValue(
                    riskProfiles.findIndex((p) => p.id === profile.id),
                  );
                }}
                className={`p-6 rounded-xl border-2 transition-all duration-200 text-left ${
                  riskAppetite === profile.id
                    ? "border-teal-500 bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-500/20 dark:to-teal-600/10 shadow-[0_8px_24px_rgba(20,184,166,0.15)]"
                    : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/40 hover:border-teal-400 dark:hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-500/10 hover:shadow-[0_6px_16px_rgba(20,184,166,0.12)] shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                }`}
              >
                <Icon className={`w-8 h-8 mb-3 ${profile.color}`} />
                <h3 className="text-slate-900 dark:text-white mb-2 font-bold text-base">
                  {profile.label}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                  {profile.description}
                </p>
              </button>
            );
          })}
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
            className="px-10 py-6 text-lg bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 dark:from-teal-500 dark:to-cyan-500 dark:hover:from-teal-600 dark:hover:to-cyan-600 text-white font-bold shadow-lg hover:shadow-xl transition-all duration-200"
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
