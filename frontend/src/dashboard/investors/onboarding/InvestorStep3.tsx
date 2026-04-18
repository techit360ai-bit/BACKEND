import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useInvestorProfile,
  type PortfolioCompany,
} from "@/contexts/UserContext";
import { InvestorProgressBar } from "./InvestorProgressBar";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";

const investmentStages = [
  "Idea",
  "Pre-Seed",
  "Seed",
  "Series A",
  "Series B+",
] as const;
const outcomes = ["Active", "Exited", "Failed", "Acquired"] as const;

const outcomeColors: Record<string, string> = {
  Active: "bg-blue-500",
  Exited: "bg-teal-500",
  Failed: "bg-red-500",
  Acquired: "bg-violet-500",
};

export function InvestorStep3() {
  const navigate = useNavigate();
  const { investorProfile, updateInvestorProfile } = useInvestorProfile();
  const [portfolio, setPortfolio] = useState<PortfolioCompany[]>(
    investorProfile.portfolio,
  );

  const [newCompany, setNewCompany] = useState<{
    name: string;
    stage: string;
    outcome: (typeof outcomes)[number];
  }>({
    name: "",
    stage: "",
    outcome: "Active",
  });

  const [showStageDropdown, setShowStageDropdown] = useState(false);
  const [showOutcomeDropdown, setShowOutcomeDropdown] = useState(false);

  const handleAddCompany = () => {
    if (newCompany.name && newCompany.stage) {
      const company: PortfolioCompany = {
        id: Date.now().toString(),
        name: newCompany.name,
        stage: newCompany.stage,
        outcome: newCompany.outcome,
      };
      setPortfolio([...portfolio, company]);
      setNewCompany({ name: "", stage: "", outcome: "Active" });
    }
  };

  const handleRemoveCompany = (id: string) => {
    setPortfolio(portfolio.filter((c) => c.id !== id));
  };

  const handleNext = () => {
    updateInvestorProfile({ portfolio });
    navigate("/investor/onboarding/step-4");
  };

  const handleBack = () => {
    navigate("/investor/onboarding/step-2");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-teal-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900/80 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-3xl">
        <InvestorProgressBar currentStep={3} totalSteps={5} />

        <div className="mb-12">
          <h1 className="text-5xl sm:text-4xl mb-3 text-slate-900 dark:text-white font-bold tracking-tight">
            Your Investment Track Record
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 font-medium">
            This builds your Investor Credibility Score
          </p>
        </div>

        {/* Add Investment Form */}
        <div className="bg-white dark:bg-slate-800/40 border-2 border-slate-300 dark:border-slate-700 rounded-xl p-7 mb-8 shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
            <div>
              <label className="block mb-3 text-sm text-slate-700 dark:text-slate-400 font-semibold">
                Startup Name
              </label>
              <input
                type="text"
                value={newCompany.name}
                onChange={(e) =>
                  setNewCompany({ ...newCompany, name: e.target.value })
                }
                placeholder="e.g., TechCorp"
                className="w-full h-11 bg-white dark:bg-slate-900/30 border-2 border-slate-300 dark:border-slate-700 rounded-lg px-4 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-600 focus:border-teal-500 dark:focus:border-teal-400 focus:shadow-[0_0_0_3px_rgba(20,184,166,0.1)] transition-all outline-none font-medium hover:border-slate-400"
              />
            </div>

            <div>
              <label className="block mb-3 text-sm text-slate-700 dark:text-slate-400 font-semibold">
                Stage at Investment
              </label>
              <div className="relative">
                <button
                  onClick={() => setShowStageDropdown(!showStageDropdown)}
                  className="w-full h-11 bg-white dark:bg-slate-900/30 border-2 border-slate-300 dark:border-slate-700 rounded-lg px-4 text-slate-900 dark:text-white text-left transition-all hover:border-teal-400 dark:hover:border-teal-500 font-medium"
                >
                  {newCompany.stage || "Select stage"}
                </button>
                {showStageDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-lg shadow-xl z-50">
                    {investmentStages.map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          setNewCompany({ ...newCompany, stage: s });
                          setShowStageDropdown(false);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-teal-50 dark:hover:bg-slate-700/50 hover:text-teal-700 dark:hover:text-teal-300 transition-all text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700/50 last:border-b-0 font-medium"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block mb-3 text-sm text-slate-700 dark:text-slate-400 font-semibold">
                Outcome
              </label>
              <div className="relative">
                <button
                  onClick={() => setShowOutcomeDropdown(!showOutcomeDropdown)}
                  className="w-full h-11 bg-white dark:bg-slate-900/30 border-2 border-slate-300 dark:border-slate-700 rounded-lg px-4 text-slate-900 dark:text-white text-left transition-all hover:border-teal-400 dark:hover:border-teal-500 font-medium"
                >
                  {newCompany.outcome}
                </button>
                {showOutcomeDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-lg shadow-xl z-50">
                    {outcomes.map((o) => (
                      <button
                        key={o}
                        onClick={() => {
                          setNewCompany({
                            ...newCompany,
                            outcome: o,
                          });
                          setShowOutcomeDropdown(false);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-teal-50 dark:hover:bg-slate-700/50 hover:text-teal-700 dark:hover:text-teal-300 transition-all text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700/50 last:border-b-0 font-medium"
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <Button
            onClick={handleAddCompany}
            disabled={!newCompany.name || !newCompany.stage}
            className="w-full bg-teal-50 dark:bg-teal-500/20 hover:bg-teal-100 dark:hover:bg-teal-500/30 text-teal-700 dark:text-teal-300 border-2 border-teal-500 dark:border-teal-400 font-bold transition-all duration-200"
            variant="outline"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Investment
          </Button>
        </div>

        {/* Portfolio List */}
        <div className="space-y-4 mb-10">
          {portfolio.map((company) => (
            <div
              key={company.id}
              className="bg-white dark:bg-slate-800/40 border-2 border-slate-300 dark:border-slate-700 rounded-xl p-5 flex items-center justify-between hover:border-teal-400 dark:hover:border-teal-500 hover:shadow-[0_6px_16px_rgba(20,184,166,0.12)] transition-all shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg text-slate-900 dark:text-white font-bold">
                    {company.name}
                  </h3>
                  <span
                    className={`px-3 py-1 rounded-lg text-xs font-bold text-white ${outcomeColors[company.outcome]}`}
                  >
                    {company.outcome}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 font-medium">
                  Invested at {company.stage}
                </p>
              </div>
              <button
                onClick={() => handleRemoveCompany(company.id)}
                className="p-2.5 hover:bg-red-500/10 rounded-lg transition-all flex-shrink-0"
              >
                <X className="w-5 h-5 text-red-500 dark:text-red-400" />
              </button>
            </div>
          ))}

          {portfolio.length === 0 && (
            <div className="text-center py-16 text-slate-500 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/20 rounded-xl">
              <div className="text-6xl mb-3">📊</div>
              <p className="font-medium text-base">No investments added yet.</p>
              <p className="text-sm mt-1">
                Add your first investment above to get started.
              </p>
            </div>
          )}
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
