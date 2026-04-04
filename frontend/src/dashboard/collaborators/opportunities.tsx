import { useState } from "react";
import {
  Sparkles,
  CheckCircle2,
  Target,
  Users,
  AlertCircle,
  Clock,
  Bookmark,
} from "lucide-react";
import CollaboratorSidebar from "@/components/CollaboratorSidebar";
import MobileNavBar from "@/components/MobileNavBar";

interface Opportunity {
  id: string;
  title: string;
  company: string;
  badge: "PROJECT" | "ADVISORY" | "GIG" | "TESTING";
  skills: string[];
  match: number;
  team: number;
  risk: "low" | "medium" | "high";
  time: string;
  compensation: string;
  description: string;
  isTopMatch?: boolean;
}

const OpportunitiesPage = () => {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [savedOpportunities, setSavedOpportunities] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const opportunities: Opportunity[] = [
    {
      id: "1",
      title: "Senior Full-Stack Engineer",
      company: "CloudVault",
      badge: "PROJECT",
      skills: ["React", "Node.js", "AWS", "TypeScript"],
      match: 92,
      team: 95,
      risk: "low",
      time: "30-40 hrs/week",
      compensation: "$8K-12K/month + 0.5% equity",
      description:
        "Your skills align perfectly with this role. The team has a strong track record and the compensation is above market rate.",
      isTopMatch: true,
    },
    {
      id: "2",
      title: "ML Consultant for Healthcare Startup",
      company: "MediAI",
      badge: "ADVISORY",
      skills: ["Machine Learning", "Python", "Healthcare"],
      match: 87,
      team: 88,
      risk: "medium",
      time: "5-10 hrs/week",
      compensation: "$5K/month + advisory shares",
      description:
        "This opportunity matches your expertise and could expand your network in a growing sector.",
    },
    {
      id: "3",
      title: "Frontend Performance Audit",
      company: "SpeedyApp",
      badge: "GIG",
      skills: ["React", "Performance Optimization", "Webpack"],
      match: 85,
      team: 82,
      risk: "low",
      time: "10-15 hrs total",
      compensation: "$3K one-time",
      description:
        "This opportunity matches your expertise and could expand your network in a growing sector.",
    },
    {
      id: "4",
      title: "Beta Tester for Dev Tools",
      company: "CodeCraft",
      badge: "TESTING",
      skills: ["Developer Tools", "Feedback"],
      match: 78,
      team: 90,
      risk: "low",
      time: "2-5 hrs/week",
      compensation: "$500 + early access",
      description:
        "This opportunity matches your expertise and could expand your network in a growing sector.",
    },
  ];

  const filteredOpportunities =
    selectedCategory === "all"
      ? opportunities
      : opportunities.filter(
          (op) => op.badge.toLowerCase() === selectedCategory,
        );

  const highMatchCount = opportunities.filter((op) => op.match >= 85).length;
  const potentialEarnings = "$516K+";

  const toggleSave = (id: string) => {
    setSavedOpportunities((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "low":
        return "text-emerald-600";
      case "medium":
        return "text-orange-600";
      case "high":
        return "text-rose-600";
      default:
        return "text-slate-600";
    }
  };

  const getBadgeColor = (badge: string) => {
    switch (badge) {
      case "PROJECT":
        return "bg-blue-100 text-blue-700 border border-blue-300";
      case "ADVISORY":
        return "bg-green-100 text-green-700 border border-green-300";
      case "GIG":
        return "bg-purple-100 text-purple-700 border border-purple-300";
      case "TESTING":
        return "bg-orange-100 text-orange-700 border border-orange-300";
      default:
        return "bg-slate-100 text-slate-700 border border-slate-300";
    }
  };

  const getCardBorder = (isTopMatch: boolean) => {
    return isTopMatch
      ? "border-2 border-emerald-500/50"
      : "border border-slate-200 dark:border-slate-700";
  };

  return (
    <div className="min-h-dvh w-full flex flex-col bg-background text-foreground overflow-hidden md:flex-row">
      {/* Mobile Navbar */}
      <MobileNavBar
        title="Opportunities"
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onCloseSidebar={() => setIsSidebarOpen(false)}
      />

      {/* Sidebar */}
      <CollaboratorSidebar
        isOpenMobile={isSidebarOpen}
        onCloseMobile={() => setIsSidebarOpen(false)}
      />

      {/* Main Content */}
      <main className="flex-1 min-h-dvh overflow-y-auto bg-linear-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 md:ml-64 xl:ml-72 pt-16 md:pt-0">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8 space-y-4 sm:space-y-6">
          {/* Header */}
          <div className="space-y-1.5 sm:space-y-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <Sparkles className="h-6 sm:h-8 w-6 sm:w-8 text-amber-500 flex-shrink-0" />
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">
                Opportunity Engine
              </h1>
            </div>
            <p className="text-xs sm:text-base text-muted-foreground">
              AI-curated opportunities matching your skills
            </p>
          </div>

          {/* AI Recommendation Banner */}
          <div className="rounded-lg sm:rounded-2xl border-2 border-amber-400/60 bg-amber-50/80 dark:bg-amber-950/20 px-3 sm:px-6 py-3 sm:py-5 space-y-3 sm:space-y-4">
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="flex items-center justify-center h-7 sm:h-8 w-7 sm:w-8 rounded-full bg-amber-400 text-amber-900 font-bold shrink-0 text-sm sm:text-base">
                🎯
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-amber-950 dark:text-amber-200">
                  AI Recommendation
                </h2>
                <p className="text-xs sm:text-sm text-amber-900 dark:text-amber-300 mt-0.5 sm:mt-1">
                  Based on your profile, CloudVault is a perfect match (92%
                  compatibility).
                </p>
                <div className="flex gap-1.5 sm:gap-2 mt-2 sm:mt-3 flex-wrap">
                  <span className="inline-block px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[0.65rem] sm:text-xs font-medium border border-emerald-300 dark:border-emerald-600">
                    High Match
                  </span>
                  <span className="inline-block px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[0.65rem] sm:text-xs font-medium border border-blue-300 dark:border-blue-600">
                    Low Risk
                  </span>
                  <span className="inline-block px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-violet-500/20 text-violet-700 dark:text-violet-300 text-[0.65rem] sm:text-xs font-medium border border-violet-300 dark:border-violet-600">
                    Top Team
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {[
              { id: "all", label: "All" },
              { id: "project", label: "Projects" },
              { id: "gig", label: "Gigs" },
              { id: "advisory", label: "Advisory" },
              { id: "testing", label: "Testing" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id)}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                  selectedCategory === tab.id
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg"
                    : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Opportunities List */}
          <div className="space-y-3 sm:space-y-4">
            {filteredOpportunities.map((opportunity) => (
              <div
                key={opportunity.id}
                className={`rounded-lg sm:rounded-2xl ${getCardBorder(opportunity.isTopMatch || false)} bg-white dark:bg-card/80 p-3 sm:p-6 space-y-3 sm:space-y-4 transition-all hover:shadow-lg`}
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                      <h3 className="text-base sm:text-xl font-bold text-foreground break-words">
                        {opportunity.title}
                      </h3>
                      <span
                        className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[0.65rem] sm:text-xs font-semibold whitespace-nowrap ${getBadgeColor(opportunity.badge)}`}
                      >
                        {opportunity.badge}
                      </span>
                      {opportunity.isTopMatch && (
                        <span className="flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[0.6rem] sm:text-xs font-medium whitespace-nowrap">
                          <CheckCircle2 className="h-3 w-3" />
                          Top Match
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                      {opportunity.company}
                    </p>
                  </div>
                  <div className="text-right shrink-0 space-y-1.5 sm:space-y-2 flex-shrink-0">
                    <p className="text-lg sm:text-2xl font-bold text-emerald-600">
                      {opportunity.compensation}
                    </p>
                    <button
                      onClick={() => toggleSave(opportunity.id)}
                      className={`flex items-center justify-center h-7 sm:h-8 w-7 sm:w-8 rounded-lg transition-colors mx-auto sm:mx-0 ${
                        savedOpportunities.includes(opportunity.id)
                          ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      <Bookmark className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
                    </button>
                  </div>
                </div>

                {/* Skills */}
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {opportunity.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[0.65rem] sm:text-xs font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-4 gap-2 sm:gap-4 py-2.5 sm:py-4 border-y border-slate-200 dark:border-slate-700">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-0.5 sm:mb-1">
                      <Target className="h-3 sm:h-4 w-3 sm:w-4 text-blue-600" />
                    </div>
                    <p className="text-lg sm:text-2xl font-bold text-blue-600">
                      {opportunity.match}%
                    </p>
                    <p className="text-[0.6rem] sm:text-xs text-muted-foreground">
                      Match
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-0.5 sm:mb-1">
                      <Users className="h-3 sm:h-4 w-3 sm:w-4 text-violet-600" />
                    </div>
                    <p className="text-lg sm:text-2xl font-bold text-violet-600">
                      {opportunity.team}/100
                    </p>
                    <p className="text-[0.6rem] sm:text-xs text-muted-foreground">
                      Team
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-0.5 sm:mb-1">
                      <AlertCircle className="h-3 sm:h-4 w-3 sm:w-4" />
                    </div>
                    <p
                      className={`text-xs sm:text-2xl font-bold capitalize ${getRiskColor(opportunity.risk)}`}
                    >
                      {opportunity.risk}
                    </p>
                    <p className="text-[0.6rem] sm:text-xs text-muted-foreground">
                      Risk
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-0.5 sm:mb-1">
                      <Clock className="h-3 sm:h-4 w-3 sm:w-4 text-orange-600" />
                    </div>
                    <p className="text-[0.65rem] sm:text-sm font-bold text-orange-600 break-words">
                      {opportunity.time}
                    </p>
                    <p className="text-[0.6rem] sm:text-xs text-muted-foreground">
                      Time
                    </p>
                  </div>
                </div>

                {/* Why this is a good fit */}
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 px-3 sm:px-4 py-2 sm:py-3 flex gap-2 sm:gap-3">
                  <span className="text-base sm:text-lg shrink-0">💼</span>
                  <div className="min-w-0">
                    <p className="text-[0.65rem] sm:text-xs font-semibold text-blue-900 dark:text-blue-300">
                      Why this is a good fit:
                    </p>
                    <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-400 mt-0.5 sm:mt-1">
                      {opportunity.description}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-1 sm:pt-2">
                  <button className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold text-xs sm:text-sm hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors flex items-center justify-center gap-1.5 sm:gap-2">
                    <CheckCircle2 className="h-3.5 sm:h-4 w-3.5 sm:w-4" />
                    Apply Now
                  </button>
                  <button className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-foreground font-semibold text-xs sm:text-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors hidden sm:inline-block">
                    Learn More
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Stats */}
          <div className="rounded-lg sm:rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 px-4 sm:px-6 py-4 sm:py-6">
            <div className="grid grid-cols-3 gap-3 sm:gap-6 text-center">
              <div className="space-y-1 sm:space-y-2">
                <p className="text-2xl sm:text-4xl font-bold text-blue-600">
                  {filteredOpportunities.length}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Active Opportunities
                </p>
              </div>
              <div className="space-y-1 sm:space-y-2">
                <p className="text-2xl sm:text-4xl font-bold text-blue-600">
                  {highMatchCount}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  High Match (85%+)
                </p>
              </div>
              <div className="space-y-1 sm:space-y-2">
                <p className="text-2xl sm:text-4xl font-bold text-emerald-600">
                  {potentialEarnings}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Potential Monthly Earnings
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default OpportunitiesPage;
