import { motion } from "motion/react";
import { Mail, MessageCircle, Star, Award } from "lucide-react";
import confetti from "canvas-confetti";
import Sidebar from "../components/Sidebar";
import MobileMenuButton from "../components/MobileMenuButton";

const matches = [
  {
    name: "Sarah Chen",
    role: "Full-Stack Developer",
    match: 94,
    skills: ["React", "Node.js", "AWS"],
    avatar: "SC",
    risk: "Medium",
    hours: "30h/week",
  },
  {
    name: "Alex Rivera",
    role: "Product Designer",
    match: 89,
    skills: ["UI/UX", "Figma", "Research"],
    avatar: "AR",
    risk: "Low",
    hours: "20h/week",
  },
  {
    name: "Jordan Lee",
    role: "Marketing Specialist",
    match: 87,
    skills: ["SEO", "Content", "Analytics"],
    avatar: "JL",
    risk: "High",
    hours: "25h/week",
  },
  {
    name: "Morgan Taylor",
    role: "DevOps Engineer",
    match: 85,
    skills: ["Docker", "K8s", "CI/CD"],
    avatar: "MT",
    risk: "Medium",
    hours: "40h/week",
  },
];

export default function MatchResults() {
  const handleInvite = () => {
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 },
    });
  };

  return (
    <div className="min-h-screen w-full flex bg-background text-foreground">
      <Sidebar />

      <main className="flex-1 overflow-y-auto bg-linear-to-b from-slate-100 via-indigo-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 py-6 lg:py-12">
        <div className="max-w-6xl mx-auto px-4 lg:px-6">
          {/* Mobile Menu Button */}
          <div className="mb-6 flex items-center justify-between md:hidden">
            <MobileMenuButton />
          </div>
          {/* Header */}
          <div className="mb-6 lg:mb-8">
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">
              Your Top Matches
            </h1>
            <p className="text-sm lg:text-base text-muted-foreground">
              AI-curated collaborators based on your profile and project needs
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6 lg:mb-8">
            <select className="px-3 py-2 bg-card border border-border rounded-lg text-foreground text-sm flex-1 sm:flex-none">
              <option>All Availability</option>
              <option>Full-time</option>
              <option>Part-time</option>
            </select>
            <select className="px-3 py-2 bg-card border border-border rounded-lg text-foreground text-sm flex-1 sm:flex-none">
              <option>All Risk Levels</option>
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
            <select className="px-3 py-2 bg-card border border-border rounded-lg text-foreground text-sm flex-1 sm:flex-none">
              <option>All Time Zones</option>
              <option>PST</option>
              <option>EST</option>
            </select>
          </div>

          {/* Match Cards Grid */}
          <div className="grid gap-6">
            {matches.map((match, index) => (
              <motion.div
                key={match.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-card rounded-xl p-4 lg:p-6 border border-border hover:border-indigo-500/50 transition-all"
              >
                <div className="flex flex-col sm:flex-row items-start gap-4 lg:gap-6">
                  {/* Avatar */}
                  <div className="flex-shrink-0 w-full sm:w-auto flex sm:flex-col items-start sm:items-center gap-4 sm:gap-2">
                    <div className="size-16 sm:size-20 rounded-full bg-linear-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-xl sm:text-2xl font-bold text-white shrink-0">
                      {match.avatar}
                    </div>
                    {/* Match Badge */}
                    <div className="px-3 py-1 bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 rounded-full text-xs sm:text-sm font-medium text-center">
                      {match.match}% Match
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 w-full">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3 lg:mb-4 gap-2 sm:gap-0">
                      <div className="flex-1">
                        <h3 className="text-lg sm:text-xl font-bold text-foreground mb-1">
                          {match.name}
                        </h3>
                        <div className="text-sm text-muted-foreground mb-2">
                          {match.role}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Award className="size-4" />
                            {match.hours}
                          </span>
                          <span>•</span>
                          <span>{match.risk} Risk</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`size-3 sm:size-4 ${
                              i < 4
                                ? "fill-amber-400 text-amber-400"
                                : "text-slate-300 dark:text-slate-700"
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Skills */}
                    <div className="flex flex-wrap gap-2 mb-3 lg:mb-4">
                      {match.skills.map((skill) => (
                        <span
                          key={skill}
                          className="px-2 py-1 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded-full text-xs sm:text-sm"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
                      <button
                        onClick={() => handleInvite()}
                        className="flex-1 sm:flex-none py-2 px-4 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
                      >
                        <Mail className="size-4" />
                        <span>Invite</span>
                      </button>
                      <button className="flex-1 sm:flex-none py-2 px-4 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-white rounded-lg flex items-center justify-center gap-2 transition-colors text-sm">
                        <MessageCircle className="size-4" />
                        <span>Message</span>
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
