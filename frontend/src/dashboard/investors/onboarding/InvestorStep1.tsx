import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInvestorProfile } from "@/contexts/UserContext";
import { InvestorProgressBar } from "./InvestorProgressBar";
import { Button } from "@/components/ui/button";
import { MapPin, Minus, Plus } from "lucide-react";

const investorTypes = [
  "Angel",
  "VC",
  "Family Office",
  "Corporate Venture",
  "Accelerator",
];
const locations = [
  "🇺🇸 United States",
  "🇬🇧 United Kingdom",
  "🇨🇦 Canada",
  "🇩🇪 Germany",
  "🇸🇬 Singapore",
  "🇦🇺 Australia",
];
const fundSizes = ["<$1M", "$1M–$10M", "$10M–$100M", "$100M+"];

export function InvestorStep1() {
  const navigate = useNavigate();
  const { investorProfile, updateInvestorProfile } = useInvestorProfile();
  const [investorType, setInvestorType] = useState(
    investorProfile.investorType,
  );
  const [location, setLocation] = useState(investorProfile.location);
  const [fundSize, setFundSize] = useState(investorProfile.fundSize);
  const [yearsInvesting, setYearsInvesting] = useState(
    investorProfile.yearsInvesting || 0,
  );
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);

  const handleNext = () => {
    updateInvestorProfile({ investorType, location, fundSize, yearsInvesting });
    navigate("/investor/onboarding/step-2");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900/80 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-3xl">
        <InvestorProgressBar currentStep={1} totalSteps={5} />

        <div className="mb-12">
          <h1 className="text-5xl sm:text-4xl mb-3 text-foreground dark:text-white font-bold tracking-tight">
            Investor Identity
          </h1>
          <p className="text-lg text-muted-foreground dark:text-muted-foreground/70 font-medium">
            Help us understand your investment profile
          </p>
        </div>

        <div className="space-y-10">
          {/* Investor Type */}
          <div>
            <label className="block mb-5 text-foreground dark:text-white font-semibold text-lg">
              Investor Type
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {investorTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => setInvestorType(type)}
                  className={`px-5 py-4 rounded-xl border-2 transition-all duration-200 font-semibold text-sm sm:text-base ${
                    investorType === type
                      ? "border-teal-500 bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-500/20 dark:to-teal-600/10 text-teal-700 dark:text-teal-300 shadow-[0_8px_24px_rgba(20,184,166,0.15)] dark:shadow-[0_8px_24px_rgba(20,184,166,0.2)]"
                      : "border-border dark:border-border bg-background dark:bg-card/40 text-foreground dark:text-muted-foreground/50 hover:border-teal-400 dark:hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-500/10 hover:shadow-[0_6px_16px_rgba(20,184,166,0.12)] dark:hover:shadow-[0_4px_12px_rgba(20,184,166,0.08)] shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block mb-5 text-foreground dark:text-white font-semibold text-lg">
              Location
            </label>
            <div className="relative">
              <button
                onClick={() => setShowLocationDropdown(!showLocationDropdown)}
                className={`w-full h-16 bg-background dark:bg-card/40 border-2 rounded-xl px-5 flex items-center gap-3 transition-all duration-200 shadow-[0_2px_8px_rgba(0,0,0,0.06)] ${
                  location
                    ? "border-teal-500 shadow-[0_6px_16px_rgba(20,184,166,0.12)]"
                    : "border-border dark:border-border hover:border-teal-400 dark:hover:border-teal-500 hover:shadow-[0_6px_16px_rgba(20,184,166,0.12)]"
                }`}
              >
                <MapPin className="w-5 h-5 text-teal-600 dark:text-teal-400 flex-shrink-0" />
                <span
                  className={`text-base font-medium ${
                    location
                      ? "text-foreground dark:text-white"
                      : "text-muted-foreground dark:text-muted-foreground"
                  }`}
                >
                  {location || "Select your location"}
                </span>
              </button>

              {showLocationDropdown && (
                <div className="absolute top-full left-0 right-0 mt-3 bg-background dark:bg-card border-2 border-border dark:border-border rounded-xl shadow-xl z-50 overflow-hidden">
                  {locations.map((loc) => (
                    <button
                      key={loc}
                      onClick={() => {
                        setLocation(loc);
                        setShowLocationDropdown(false);
                      }}
                      className="w-full text-left px-5 py-4 hover:bg-teal-50 dark:hover:bg-card/50 hover:text-teal-700 dark:hover:text-teal-300 transition-all text-foreground dark:text-muted-foreground/50 border-b border-border dark:border-border/50 last:border-b-0 font-medium"
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Fund Size */}
          <div>
            <label className="block mb-5 text-foreground dark:text-white font-semibold text-lg">
              Fund Size
            </label>
            <div className="grid grid-cols-2 gap-4">
              {fundSizes.map((size) => (
                <button
                  key={size}
                  onClick={() => setFundSize(size)}
                  className={`px-5 py-4 rounded-xl border-2 transition-all duration-200 font-semibold text-sm sm:text-base ${
                    fundSize === size
                      ? "border-teal-500 bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-500/20 dark:to-teal-600/10 text-teal-700 dark:text-teal-300 shadow-[0_8px_24px_rgba(20,184,166,0.15)]"
                      : "border-border dark:border-border bg-background dark:bg-card/40 text-foreground dark:text-muted-foreground/50 hover:border-teal-400 dark:hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-500/10 hover:shadow-[0_6px_16px_rgba(20,184,166,0.12)] shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Years Investing */}
          <div>
            <label className="block mb-5 text-foreground dark:text-white font-semibold text-lg">
              Years Investing
            </label>
            <div className="flex items-center gap-5">
              <button
                onClick={() =>
                  setYearsInvesting(Math.max(0, yearsInvesting - 1))
                }
                className="w-14 h-14 rounded-xl bg-background dark:bg-card/40 border-2 border-border dark:border-border hover:border-teal-400 dark:hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-500/10 flex items-center justify-center transition-all duration-200 shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_6px_16px_rgba(20,184,166,0.12)]"
              >
                <Minus className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              </button>
              <div className="flex-1 h-16 bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-500/10 dark:to-cyan-500/10 border-2 border-teal-500 rounded-xl flex items-center justify-center shadow-[0_4px_12px_rgba(20,184,166,0.1)]">
                <span className="text-4xl text-teal-700 dark:text-teal-300 font-bold">
                  {yearsInvesting}
                </span>
              </div>
              <button
                onClick={() => setYearsInvesting(yearsInvesting + 1)}
                className="w-14 h-14 rounded-xl bg-background dark:bg-card/40 border-2 border-border dark:border-border hover:border-teal-400 dark:hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-500/10 flex items-center justify-center transition-all duration-200 shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_6px_16px_rgba(20,184,166,0.12)]"
              >
                <Plus className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-16 flex justify-end">
          <Button
            onClick={handleNext}
            disabled={!investorType || !location || !fundSize}
            className="px-10 py-6 text-lg bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 dark:from-teal-500 dark:to-cyan-500 dark:hover:from-teal-600 dark:hover:to-cyan-600 text-white font-bold shadow-lg hover:shadow-xl transition-all duration-200"
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
