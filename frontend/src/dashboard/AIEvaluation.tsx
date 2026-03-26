import { motion } from "motion/react";
import { Link, useLocation } from "react-router-dom";
import {
  TrendingUp,
  AlertTriangle,
  Users,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import confetti from "canvas-confetti";
import { useEffect } from "react";
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

interface LocationState {
  idea?: IdeaData;
}

export default function AIEvaluation() {
  const location = useLocation();
  const { idea } = (location.state as LocationState) || {};

  useEffect(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
  }, []);

  // If no idea data is provided, show a fallback
  if (!idea) {
    return (
      <div className="min-h-screen w-full flex bg-background text-foreground">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center bg-slate-950 py-12">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-4">
              No idea data found
            </h1>
            <Link
              to="/idea-submit"
              className="inline-block px-6 py-3 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white rounded-lg transition-all shadow-lg shadow-indigo-500/30"
            >
              Submit an Idea
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex bg-background text-foreground">
      <Sidebar />

      <main className="flex-1 overflow-y-auto bg-slate-950 py-12">
        <div className="max-w-4xl mx-auto px-4">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center justify-center size-20 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full mb-4 shadow-2xl shadow-emerald-500/50">
              <Sparkles className="size-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">
              AI Evaluation Complete
            </h1>
            <p className="text-slate-300 mb-4">
              Evaluating:{" "}
              <span className="font-semibold text-indigo-400">
                {idea.title}
              </span>
            </p>
            <p className="text-slate-400">
              Here's your idea's market readiness score
            </p>
          </motion.div>

          {/* Score Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 border-2 border-indigo-500/30 rounded-2xl p-8 mb-8 text-center"
          >
            <div className="text-6xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent mb-2">
              87/100
            </div>
            <div className="text-xl text-white mb-4">
              Market Readiness Score
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 rounded-full text-emerald-300 text-sm">
              <TrendingUp className="size-4" />
              <span>High Potential - Ready for MVP</span>
            </div>
          </motion.div>

          {/* Idea Details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-slate-900 rounded-xl p-6 border border-slate-800 mb-8"
          >
            <h3 className="text-lg font-bold text-white mb-4">
              Your Submission
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide">
                  Pitch
                </p>
                <p className="text-white mt-1">{idea.pitch}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide">
                  Problem
                </p>
                <p className="text-white mt-1">{idea.problem}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide">
                  Solution
                </p>
                <p className="text-white mt-1">{idea.solution}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide">
                  Target Users
                </p>
                <p className="text-white mt-1">
                  {idea.target || "Not specified"}
                </p>
              </div>
              {idea.industry && (
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">
                    Industry
                  </p>
                  <p className="text-white mt-1 capitalize">{idea.industry}</p>
                </div>
              )}
              {idea.techStack && (
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">
                    Tech Stack
                  </p>
                  <p className="text-white mt-1">{idea.techStack}</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid md:grid-cols-3 gap-6 mb-8"
          >
            {[
              {
                label: "Problem Clarity",
                score: 92,
                color: "from-indigo-500 to-purple-500",
              },
              {
                label: "Market Size",
                score: 85,
                color: "from-cyan-500 to-blue-500",
              },
              {
                label: "Technical Feasibility",
                score: 84,
                color: "from-emerald-500 to-teal-500",
              },
            ].map((metric) => (
              <div
                key={metric.label}
                className="bg-slate-900 rounded-xl p-6 border border-slate-800"
              >
                <div className="text-sm text-slate-400 mb-2">
                  {metric.label}
                </div>
                <div className="text-3xl font-bold text-white mb-3">
                  {metric.score}%
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${metric.color}`}
                    style={{ width: `${metric.score}%` }}
                  />
                </div>
              </div>
            ))}
          </motion.div>

          {/* Risk Breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-slate-900 rounded-xl p-6 border border-slate-800 mb-8"
          >
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-400" />
              Risk Analysis
            </h3>
            <div className="space-y-3">
              {[
                {
                  risk: "Competition",
                  level: "Medium",
                  description: "Several established players in market",
                },
                {
                  risk: "Technical Complexity",
                  level: "Low",
                  description: "Technology stack is well-proven",
                },
                {
                  risk: "Time to Market",
                  level: "Low",
                  description: "MVP can be built in 3-4 months",
                },
              ].map((item) => (
                <div
                  key={item.risk}
                  className="flex items-start gap-4 p-3 bg-slate-800/50 rounded-lg"
                >
                  <div
                    className={`px-2 py-1 rounded text-xs ${
                      item.level === "Low"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : item.level === "Medium"
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-red-500/20 text-red-300"
                    }`}
                  >
                    {item.level}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">
                      {item.risk}
                    </div>
                    <div className="text-xs text-slate-400">
                      {item.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Roadmap Timeline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-slate-900 rounded-xl p-6 border border-slate-800 mb-8"
          >
            <h3 className="text-lg font-bold text-white mb-6">
              AI-Generated Roadmap
            </h3>
            <div className="space-y-4">
              {[
                {
                  phase: "Week 1-2",
                  task: "Validate with 20 target users",
                  status: "recommended",
                },
                {
                  phase: "Week 3-6",
                  task: "Build MVP with core features",
                  status: "recommended",
                },
                {
                  phase: "Week 7-8",
                  task: "Beta testing with 50 users",
                  status: "recommended",
                },
                {
                  phase: "Week 9-12",
                  task: "Launch and iterate",
                  status: "recommended",
                },
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div className="size-8 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-sm font-bold text-white">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">
                      {item.task}
                    </div>
                    <div className="text-xs text-slate-400">{item.phase}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Matching Requirements */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-gradient-to-r from-indigo-500/10 to-cyan-500/10 border border-indigo-500/30 rounded-xl p-6 mb-8"
          >
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Users className="size-5 text-indigo-400" />
              Recommended Team Composition
            </h3>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { role: "Technical Co-founder", skills: "React, Node.js" },
                { role: "Product Designer", skills: "UI/UX, Figma" },
                { role: "Marketing Lead", skills: "Growth, SEO" },
              ].map((member) => (
                <div
                  key={member.role}
                  className="bg-slate-900/50 rounded-lg p-4"
                >
                  <div className="text-sm font-medium text-white mb-1">
                    {member.role}
                  </div>
                  <div className="text-xs text-slate-400">{member.skills}</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="flex gap-4"
          >
            <Link
              to="/idea-submit"
              className="flex-1 py-3 px-6 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-center transition-colors"
            >
              Revise Idea
            </Link>
            <Link
              to="/matches"
              className="flex-1 py-3 px-6 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/30"
            >
              <span>Find Collaborators</span>
              <ArrowRight className="size-4" />
            </Link>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
