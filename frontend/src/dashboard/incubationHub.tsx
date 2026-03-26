import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Lightbulb, AlertCircle, Sparkles, ArrowRight } from "lucide-react";
import confetti from "canvas-confetti";
import Sidebar from "../components/Sidebar";

interface IdeaData {
  title: string;
  pitch: string;
  problem: string;
  solution: string;
  target: string;
  industry: string;
  techStack: string;
  monetization: string;
}

interface IdeaSubmissionProps {
  onSubmit?: (idea: IdeaData) => void;
}

export default function IdeaSubmission({ onSubmit }: IdeaSubmissionProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [idea, setIdea] = useState({
    title: "",
    pitch: "",
    problem: "",
    solution: "",
    target: "",
    industry: "",
    techStack: "",
    monetization: "",
  });

  const [aiScore, setAiScore] = useState({
    clarity: 0,
    marketPotential: 0,
    feasibility: 0,
    overall: 0,
  });

  const handleInputChange = (field: string, value: string) => {
    setIdea((prev) => ({ ...prev, [field]: value }));

    // Simulate AI scoring
    setTimeout(() => {
      setAiScore((prev) => ({
        ...prev,
        clarity: Math.min(100, prev.clarity + Math.random() * 10),
        marketPotential: Math.min(
          100,
          prev.marketPotential + Math.random() * 8,
        ),
        feasibility: Math.min(100, prev.feasibility + Math.random() * 7),
        overall: (prev.clarity + prev.marketPotential + prev.feasibility) / 3,
      }));
    }, 500);
  };

  const handleSubmit = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      colors: ["#6366f1", "#06b6d4", "#10b981"],
    });

    if (onSubmit) {
      onSubmit(idea);
    }
    setTimeout(() => {
      navigate("/idea-eval", { state: { idea } });
    }, 1000);
  };

  const canProceed =
    step === 1 ? idea.title && idea.pitch : idea.problem && idea.solution;

  return (
    <div className="min-h-screen w-full flex bg-background text-foreground">
      <Sidebar />

      <main className="flex-1 overflow-y-auto bg-slate-950 py-12">
        <div className="max-w-6xl mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-12">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="inline-flex items-center justify-center size-16 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-2xl mb-4 shadow-2xl shadow-indigo-500/50"
            >
              <Lightbulb className="size-8 text-white" />
            </motion.div>
            <h1 className="text-4xl font-bold text-white mb-2">
              Submit Your Idea
            </h1>
            <p className="text-slate-400">
              AI will analyze and help you refine it
            </p>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-4 mb-12">
            {[1, 2, 3].map((num) => (
              <div key={num} className="flex items-center">
                <div
                  className={`size-10 rounded-full flex items-center justify-center font-bold transition-all ${
                    num < step
                      ? "bg-emerald-500 text-white"
                      : num === step
                        ? "bg-indigo-500 text-white"
                        : "bg-slate-800 text-slate-500"
                  }`}
                >
                  {num < step ? "✓" : num}
                </div>
                {num < 3 && (
                  <div
                    className={`w-16 h-1 mx-2 ${
                      num < step ? "bg-emerald-500" : "bg-slate-800"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Form */}
            <div className="lg:col-span-2">
              <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800">
                {step === 1 && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <div>
                      <label className="block text-sm font-medium text-slate-200 mb-2">
                        Idea Title *
                      </label>
                      <input
                        type="text"
                        value={idea.title}
                        onChange={(e) =>
                          handleInputChange("title", e.target.value)
                        }
                        placeholder="e.g., AI-Powered Task Manager"
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-200 mb-2">
                        One-Line Pitch *
                      </label>
                      <input
                        type="text"
                        value={idea.pitch}
                        onChange={(e) =>
                          handleInputChange("pitch", e.target.value)
                        }
                        placeholder="Describe your idea in one sentence"
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <div>
                      <label className="block text-sm font-medium text-slate-200 mb-2">
                        Problem *
                      </label>
                      <textarea
                        value={idea.problem}
                        onChange={(e) =>
                          handleInputChange("problem", e.target.value)
                        }
                        placeholder="What problem does this solve?"
                        rows={4}
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-200 mb-2">
                        Solution *
                      </label>
                      <textarea
                        value={idea.solution}
                        onChange={(e) =>
                          handleInputChange("solution", e.target.value)
                        }
                        placeholder="How does your idea solve it?"
                        rows={4}
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-200 mb-2">
                        Target Users
                      </label>
                      <input
                        type="text"
                        value={idea.target}
                        onChange={(e) =>
                          handleInputChange("target", e.target.value)
                        }
                        placeholder="Who will use this?"
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <div>
                      <label className="block text-sm font-medium text-slate-200 mb-2">
                        Industry
                      </label>
                      <select
                        value={idea.industry}
                        onChange={(e) =>
                          setIdea((prev) => ({
                            ...prev,
                            industry: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Select industry...</option>
                        <option value="ai">AI/ML</option>
                        <option value="fintech">FinTech</option>
                        <option value="health">HealthTech</option>
                        <option value="saas">SaaS</option>
                        <option value="ecommerce">E-Commerce</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-200 mb-2">
                        Tech Stack (Optional)
                      </label>
                      <input
                        type="text"
                        value={idea.techStack}
                        onChange={(e) =>
                          setIdea((prev) => ({
                            ...prev,
                            techStack: e.target.value,
                          }))
                        }
                        placeholder="e.g., React, Node.js, PostgreSQL"
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-200 mb-2">
                        Monetization Idea (Optional)
                      </label>
                      <input
                        type="text"
                        value={idea.monetization}
                        onChange={(e) =>
                          setIdea((prev) => ({
                            ...prev,
                            monetization: e.target.value,
                          }))
                        }
                        placeholder="How will this make money?"
                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </motion.div>
                )}

                {/* Navigation */}
                <div className="flex gap-4 mt-8">
                  {step > 1 && (
                    <button
                      onClick={() => setStep(step - 1)}
                      className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                    >
                      Back
                    </button>
                  )}
                  {step < 3 ? (
                    <button
                      onClick={() => setStep(step + 1)}
                      disabled={!canProceed}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center gap-2 transition-all"
                    >
                      <span>Next Step</span>
                      <ArrowRight className="size-4" />
                    </button>
                  ) : (
                    <button
                      onClick={handleSubmit}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/30"
                    >
                      <Sparkles className="size-4" />
                      <span>Evaluate Idea</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* AI Feedback Panel */}
            <div className="lg:col-span-1">
              <div className="sticky top-8 bg-slate-900 rounded-2xl p-6 border border-indigo-500/30">
                <div className="flex items-center gap-2 mb-6">
                  <Sparkles className="size-5 text-indigo-400" />
                  <span className="text-sm font-medium text-slate-200">
                    Live AI Feedback
                  </span>
                </div>

                {/* Scores */}
                <div className="space-y-4 mb-6">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-400">Clarity</span>
                      <span className="text-indigo-400">
                        {Math.round(aiScore.clarity)}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-500"
                        style={{ width: `${aiScore.clarity}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-400">Market Potential</span>
                      <span className="text-cyan-400">
                        {Math.round(aiScore.marketPotential)}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-500"
                        style={{ width: `${aiScore.marketPotential}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-400">Feasibility</span>
                      <span className="text-emerald-400">
                        {Math.round(aiScore.feasibility)}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                        style={{ width: `${aiScore.feasibility}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Suggestions */}
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertCircle className="size-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-slate-300">
                      <p className="font-medium mb-1">
                        Tips for a better score:
                      </p>
                      <ul className="text-xs space-y-1 text-slate-400">
                        <li>• Be specific about the problem</li>
                        <li>• Explain your unique solution</li>
                        <li>• Define your target audience</li>
                        <li>• Add monetization strategy</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
