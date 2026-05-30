import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Sparkles, Target, LayoutGrid, CheckCircle2, DollarSign,
  FileText, Gauge, TrendingUp, Compass, BarChart3,
  Zap, Users, Map, ClipboardList, Cpu, Star,
  Brain, Send, Upload, RefreshCw, Download,
  ChevronRight, AlertTriangle, CheckCircle, ArrowUpRight,
  Rocket, Code2, Palette, Megaphone, Activity, ChevronLeft,
  Briefcase, ArrowLeft, Lightbulb,
} from "lucide-react";

const PROBLEM_AREAS = [
  { id: "ai", label: "AI", emoji: "🤖" },
  { id: "healthcare", label: "Healthcare", emoji: "🏥" },
  { id: "greentech", label: "Green Tech", emoji: "🌱" },
  { id: "deeptech", label: "Deep Tech", emoji: "🧬" },
  { id: "web3", label: "Web3", emoji: "⛓️" },
];

// ─── Sub-components ───────────────────────────────────────────

function ProgressBar({
  value,
  colorFrom = "#38bdf8",
  colorTo = "#0284c7",
}: {
  value: number;
  colorFrom?: string;
  colorTo?: string;
}) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(value), 350);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(14,165,233,0.1)" }}>
      <div
        className="h-full rounded-full transition-all duration-1000 ease-out"
        style={{
          width: `${width}%`,
          background: `linear-gradient(90deg, ${colorFrom}, ${colorTo})`,
        }}
      />
    </div>
  );
}

function CircularProgress({
  value,
  size = 60,
  stroke = "#0ea5e9",
}: {
  value: number;
  size?: number;
  stroke?: string;
}) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const [p, setP] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setP(value), 450);
    return () => clearTimeout(t);
  }, [value]);
  const offset = circ - (p / 100) * circ;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(14,165,233,0.12)" strokeWidth="5" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={stroke} strokeWidth="5"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1.1s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-bold" style={{ color: stroke }}>{value}%</span>
      </div>
    </div>
  );
}

// ─── Data ─────────────────────────────────────────────────────

const navItems = [
  { icon: <Sparkles size={14} />, title: "Unicorn Potential",        desc: "Score unicorn trajectory" },
  { icon: <Target size={14} />,   title: "PMF Analysis",             desc: "Validate product-market fit" },
  { icon: <LayoutGrid size={14} />, title: "SWOT Analysis",          desc: "Identify key strategic factors" },
  { icon: <CheckCircle2 size={14} />, title: "Market Validation",    desc: "Confirm real market demand" },
  { icon: <DollarSign size={14} />, title: "Monetization Logic",     desc: "Revenue model analysis" },
  { icon: <FileText size={14} />, title: "Business Plan Generation", desc: "Full business plan output" },
  { icon: <Gauge size={14} />,    title: "Feasibility",              desc: "Technical & market feasibility" },
  { icon: <TrendingUp size={14} />, title: "Finance Strategy",       desc: "Financial projections & strategy" },
  { icon: <Compass size={14} />,  title: "Startup Strategy",         desc: "Go-to-market planning" },
  { icon: <BarChart3 size={14} />, title: "Market Intelligence",     desc: "Competitive intelligence" },
  { icon: <Zap size={14} />,      title: "Impact Predictor",         desc: "Predict startup impact score" },
  { icon: <Users size={14} />,    title: "Investor Intelligence",    desc: "Investor matching & profiling" },
  { icon: <Map size={14} />,      title: "Execution Roadmap",        desc: "Milestone-based roadmap" },
  { icon: <ClipboardList size={14} />, title: "Market Survey",       desc: "Survey design & analysis" },
  { icon: <Cpu size={14} />,      title: "Tech Architecture",        desc: "System design blueprint" },
  { icon: <Star size={14} />,     title: "Project Recommendation",   desc: "Personalized recommendations" },
];

const metrics = [
  { label: "Problem Clarity",       value: 92, from: "#38bdf8", to: "#0284c7" },
  { label: "Market Size",           value: 85, from: "#a78bfa", to: "#7c3aed" },
  { label: "Technical Feasibility", value: 84, from: "#34d399", to: "#059669" },
  { label: "Unicorn Potential",     value: 91, from: "#38bdf8", to: "#0369a1" },
  { label: "Market Fit Score",      value: 88, from: "#6ee7b7", to: "#0d9488" },
];

const circleMetrics = [
  { label: "Problem\nClarity",       value: 92, stroke: "#0ea5e9" },
  { label: "Unicorn\nScore",         value: 91, stroke: "#8b5cf6" },
  { label: "Market\nFit",           value: 88, stroke: "#10b981" },
  { label: "Market\nSize",          value: 85, stroke: "#f59e0b" },
  { label: "Tech\nFeasibility",     value: 84, stroke: "#6366f1" },
];

const risks = [
  { label: "Risk Analysis",        value: 28, level: "Low",    from: "#6ee7b7", to: "#059669" },
  { label: "Competition",          value: 45, level: "Medium", from: "#fcd34d", to: "#d97706" },
  { label: "Technical Complexity", value: 35, level: "Medium", from: "#fcd34d", to: "#d97706" },
  { label: "Time to Market",       value: 52, level: "Medium", from: "#fcd34d", to: "#d97706" },
];

const roadmap = [
  { phase: "Validate with Users", period: "Month 1–2", detail: "User interviews, problem validation, survey rollout across 5 pilot universities" },
  { phase: "Build MVP",           period: "Month 3–5", detail: "Core feature development, AI engine integration, matchmaking algorithm" },
  { phase: "Beta Testing",        period: "Month 6–7", detail: "Closed beta with 200 student founders, feedback loops, iteration" },
  { phase: "Launch & Iterate",    period: "Month 8+",  detail: "Public launch, growth loops, partnership expansion, investor outreach" },
];

const teamRoles = [
  {
    icon: <Code2 size={16} />,
    role: "Technical Co-founder",
    skills: ["React", "Node.js", "AI/ML", "System Design"],
    bg: "bg-sky-50", border: "border-sky-100", iconBg: "bg-sky-100 text-sky-600",
  },
  {
    icon: <Palette size={16} />,
    role: "Product Designer",
    skills: ["UI/UX", "Figma", "User Research", "Prototyping"],
    bg: "bg-violet-50", border: "border-violet-100", iconBg: "bg-violet-100 text-violet-600",
  },
  {
    icon: <Megaphone size={16} />,
    role: "Marketing Lead",
    skills: ["Growth", "Content", "Partnerships", "SEO"],
    bg: "bg-emerald-50", border: "border-emerald-100", iconBg: "bg-emerald-100 text-emerald-600",
  },
];

const insights = [
  { type: "success", text: "Strong demand among student founders and technical talent in Africa" },
  { type: "success", text: "High scalability through AI matchmaking engine" },
  { type: "success", text: "Clear monetization via premium features and investor network fees" },
  { type: "warning", text: "Competition from global platforms — need strong local focus" },
];

// ─── Main Component ───────────────────────────────────────────

export function MainIncubationPanel() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState("Business Plan Generation");
  const [copilotText, setCopilotText] = useState("");
  const [isDocPreviewOpen, setIsDocPreviewOpen] = useState(true);

  // Structured idea form (replaces the freeform textarea)
  const [ideaTitle, setIdeaTitle] = useState("");
  const [ideaSolution, setIdeaSolution] = useState("");
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);

  const toggleArea = (id: string) =>
    setSelectedAreas((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );

  return (
    <>
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes spin-slow { to { transform: rotate(360deg); } }
        .spin-slow { animation: spin-slow 4s linear infinite; }
        @keyframes ping-soft { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.15); } }
        .ping-soft { animation: ping-soft 2s ease-in-out infinite; }
      `}</style>

      <div
        className="h-screen flex overflow-hidden"
        style={{ fontFamily: "'Inter', sans-serif", background: "#F0F9FF" }}
      >
        {/* ══════════════ LEFT SIDEBAR ══════════════ */}
        <aside className="w-[264px] flex-shrink-0 flex flex-col border-r overflow-hidden" style={{ borderColor: "rgba(14,165,233,0.12)", background: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)" }}>

          {/* Branding */}
          <div className="px-4 pt-5 pb-4 flex-shrink-0 border-b" style={{ borderColor: "rgba(14,165,233,0.08)" }}>
            <Link
              to="/dashboard"
              className="flex items-center gap-1.5 text-[10px] text-sky-500 hover:text-sky-700 font-semibold mb-3 transition-colors"
            >
              <ArrowLeft size={11} />
              Back to TechIT
            </Link>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0" style={{ background: "linear-gradient(135deg, #38bdf8, #0284c7, #1e40af)" }}>
                <Brain size={17} className="text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-sky-900 leading-tight">TechIT Network</div>
                <div className="text-[9px] text-sky-400 leading-tight font-medium mt-0.5">AI-Powered Startup Incubation</div>
              </div>
            </div>
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border" style={{ background: "linear-gradient(135deg, #f0f9ff, #e0f2fe)", borderColor: "rgba(14,165,233,0.15)" }}>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 ping-soft flex-shrink-0" />
              <span className="text-[10px] font-semibold text-sky-700">AI Engine Active</span>
              <Sparkles size={9} className="text-sky-400 ml-auto flex-shrink-0" />
            </div>
          </div>

          {/* Nav items */}
          <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5 scrollbar-hide">
            {navItems.map((item) => {
              const isActive = activeNav === item.title;
              return (
                <button
                  key={item.title}
                  onClick={() => setActiveNav(item.title)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl transition-all duration-150 flex items-start gap-2.5 group ${
                    isActive ? "shadow-md" : "hover:bg-sky-50"
                  }`}
                  style={isActive ? { background: "linear-gradient(135deg, #38bdf8, #0284c7)", boxShadow: "0 4px 12px rgba(2,132,199,0.25)" } : {}}
                >
                  <div className={`mt-0.5 flex-shrink-0 ${isActive ? "text-white" : "text-sky-400 group-hover:text-sky-600"}`}>
                    {item.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-[11px] font-semibold leading-tight ${isActive ? "text-white" : "text-sky-900"}`}>
                      {item.title}
                    </div>
                    <div className={`text-[9px] mt-0.5 leading-tight truncate ${isActive ? "text-sky-100" : "text-sky-400"}`}>
                      {item.desc}
                    </div>
                  </div>
                  {isActive && <ChevronRight size={11} className="text-white/70 mt-0.5 flex-shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* AI Copilot */}
          <div className="flex-shrink-0 border-t p-3" style={{ borderColor: "rgba(14,165,233,0.1)" }}>
            <div className="rounded-2xl border p-3" style={{ background: "linear-gradient(135deg, #f0f9ff, #e0f2fe)", borderColor: "rgba(14,165,233,0.18)" }}>
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #38bdf8, #0284c7)" }}>
                  <Brain size={12} className="text-white" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-sky-900">AI Copilot</div>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 ping-soft" />
                    <span className="text-[9px] text-emerald-600 font-semibold">Live</span>
                  </div>
                </div>
              </div>
              <textarea
                value={copilotText}
                onChange={(e) => setCopilotText(e.target.value)}
                placeholder="Ask AI Copilot anything about your startup..."
                className="w-full text-[10px] rounded-xl px-3 py-2 resize-none text-sky-900 placeholder-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-300 border"
                style={{ background: "rgba(255,255,255,0.8)", borderColor: "rgba(14,165,233,0.2)" }}
                rows={2}
              />
              <button
                className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-white text-[11px] font-bold transition-all hover:opacity-90 active:scale-95"
                style={{ background: "linear-gradient(135deg, #0ea5e9, #0284c7)", boxShadow: "0 3px 10px rgba(2,132,199,0.3)" }}
              >
                <Send size={10} />
                Send to Copilot
              </button>
            </div>
          </div>
        </aside>

        {/* ══════════════ CENTER PANEL ══════════════ */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">

          {/* Header */}
          <header className="flex-shrink-0 px-6 py-3.5 border-b flex items-center justify-between" style={{ borderColor: "rgba(14,165,233,0.12)", background: "rgba(255,255,255,0.7)", backdropFilter: "blur(12px)" }}>
            <div>
              <h1 className="text-base font-bold text-sky-900 leading-tight">Real-Time AI Analysis</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 ping-soft" />
                <span className="text-[10px] text-emerald-600 font-semibold">Live Processing</span>
                <span className="text-[10px] text-sky-300 mx-1">·</span>
                <span className="text-[10px] text-sky-400">Business Plan Generation</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Rotating AI indicator */}
              <div className="relative w-8 h-8">
                <div className="absolute inset-0 rounded-full border-2 border-dashed border-sky-300 spin-slow" />
                <div className="absolute inset-1.5 rounded-full flex items-center justify-center" style={{ background: "rgba(14,165,233,0.1)" }}>
                  <Activity size={9} className="text-sky-500" />
                </div>
              </div>
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-[11px] font-bold transition-all hover:opacity-90 active:scale-95"
                style={{ background: "linear-gradient(135deg, #0ea5e9, #0284c7)", boxShadow: "0 3px 10px rgba(2,132,199,0.25)" }}
              >
                <Download size={12} />
                Export Report
              </button>
            </div>
          </header>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-hide">

            {/* Analysis Complete Banner */}
            <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl border" style={{ background: "linear-gradient(135deg, #ecfdf5, #d1fae5)", borderColor: "rgba(16,185,129,0.2)" }}>
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle size={15} className="text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-emerald-900">Idea Analysis & Evaluation Complete</div>
                <div className="text-[10px] text-emerald-600 font-medium mt-0.5">Business Plan Generation · Just now</div>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-200/60 flex-shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 ping-soft" />
                <span className="text-[9px] font-bold text-emerald-800">Success</span>
              </div>
            </div>

            {/* Hero Score Card */}
            <div
              className="rounded-3xl p-5 relative overflow-hidden shadow-xl"
              style={{ background: "linear-gradient(135deg, #0369a1 0%, #1e40af 50%, #1e3a8a 100%)", boxShadow: "0 20px 40px rgba(2,132,199,0.3)" }}
            >
              {/* Decorative blobs */}
              <div className="absolute top-0 right-0 w-56 h-56 rounded-full -translate-y-20 translate-x-20" style={{ background: "rgba(255,255,255,0.05)" }} />
              <div className="absolute bottom-0 left-8 w-36 h-36 rounded-full translate-y-16" style={{ background: "rgba(255,255,255,0.04)" }} />
              <div className="absolute top-1/2 left-1/2 w-20 h-20 rounded-full -translate-x-8" style={{ background: "rgba(56,189,248,0.08)" }} />

              <div className="relative z-10">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <div className="text-[9px] text-sky-300 font-bold uppercase tracking-widest mb-1.5">Startup Analysis</div>
                    <h2 className="text-lg font-black text-white leading-tight tracking-tight">HEALTH CARE APP</h2>
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className="px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wide"
                        style={{ background: "rgba(52,211,153,0.2)", color: "#6ee7b7", border: "1px solid rgba(52,211,153,0.3)" }}
                      >
                        High Potential
                      </span>
                      <span className="text-[10px] text-sky-300 font-medium">Ready for MVP</span>
                    </div>
                  </div>
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}>
                    <Rocket size={22} className="text-sky-200" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  {/* Unicorn score */}
                  <div className="p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(8px)" }}>
                    <div className="text-[9px] text-sky-300 font-semibold uppercase tracking-wider mb-2">Unicorn Potential</div>
                    <div className="flex items-end gap-1 mb-3">
                      <span className="text-4xl font-black text-white leading-none">91</span>
                      <span className="text-base text-sky-300 font-bold mb-0.5">/100</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.15)" }}>
                      <div className="h-full rounded-full transition-all duration-1000" style={{ width: "91%", background: "linear-gradient(90deg, #7dd3fc, #ffffff)" }} />
                    </div>
                  </div>
                  {/* Market fit */}
                  <div className="p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(8px)" }}>
                    <div className="text-[9px] text-sky-300 font-semibold uppercase tracking-wider mb-2">Market Fit Score</div>
                    <div className="flex items-end gap-1 mb-3">
                      <span className="text-4xl font-black text-white leading-none">88</span>
                      <span className="text-base text-sky-300 font-bold mb-0.5">/100</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.15)" }}>
                      <div className="h-full rounded-full transition-all duration-1000" style={{ width: "88%", background: "linear-gradient(90deg, #6ee7b7, #a7f3d0)" }} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <ArrowUpRight size={13} className="text-emerald-300 flex-shrink-0" />
                  <span className="text-[10px] text-sky-200 font-medium">Top 9% of startups analyzed this month · AI confidence 94%</span>
                </div>
              </div>
            </div>

            {/* Detailed Evaluation */}
            <div className="bg-white rounded-3xl border p-5 shadow-sm" style={{ borderColor: "rgba(14,165,233,0.12)" }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-sky-900">Detailed Evaluation</h3>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: "rgba(14,165,233,0.08)" }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-sky-500 ping-soft" />
                  <span className="text-[9px] font-bold text-sky-600">AI Confidence: 94%</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-3.5">
                {metrics.map((m) => (
                  <div key={m.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-semibold text-sky-700">{m.label}</span>
                      <span className="text-[11px] font-black text-sky-900">{m.value}%</span>
                    </div>
                    <ProgressBar value={m.value} colorFrom={m.from} colorTo={m.to} />
                  </div>
                ))}
              </div>

              {/* Circular indicators */}
              <div className="mt-5 pt-4 flex items-center justify-around" style={{ borderTop: "1px solid rgba(14,165,233,0.08)" }}>
                {circleMetrics.map((c) => (
                  <div key={c.label} className="flex flex-col items-center gap-1.5">
                    <CircularProgress value={c.value} stroke={c.stroke} size={56} />
                    <div className="text-center">
                      {c.label.split("\n").map((line, i) => (
                        <div key={i} className="text-[8px] text-sky-400 font-medium leading-tight">{line}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk Analysis */}
            <div className="bg-white rounded-3xl border p-5 shadow-sm" style={{ borderColor: "rgba(14,165,233,0.12)" }}>
              <h3 className="text-sm font-bold text-sky-900 mb-4">Risk Indicators</h3>
              <div className="grid grid-cols-2 gap-3">
                {risks.map((r) => (
                  <div key={r.label} className="p-3 rounded-2xl border" style={{ background: "rgba(240,249,255,0.5)", borderColor: "rgba(14,165,233,0.1)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-semibold text-sky-700">{r.label}</span>
                      <span
                        className="text-[8px] font-black px-1.5 py-0.5 rounded-md"
                        style={
                          r.level === "Low"
                            ? { background: "#d1fae5", color: "#065f46" }
                            : { background: "#fef3c7", color: "#92400e" }
                        }
                      >
                        {r.level}
                      </span>
                    </div>
                    <ProgressBar value={r.value} colorFrom={r.from} colorTo={r.to} />
                    <div className="text-[9px] text-sky-400 font-medium mt-1.5">{r.value}% risk exposure</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Key AI Insights — glassmorphism */}
            <div
              className="rounded-3xl p-5 shadow-lg"
              style={{
                background: "linear-gradient(135deg, rgba(255,255,255,0.85), rgba(240,249,255,0.85))",
                backdropFilter: "blur(16px)",
                border: "1px solid rgba(56,189,248,0.25)",
                boxShadow: "0 8px 32px rgba(2,132,199,0.1), inset 0 1px 0 rgba(255,255,255,0.6)",
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #38bdf8, #0284c7)" }}>
                  <Brain size={12} className="text-white" />
                </div>
                <h3 className="text-sm font-bold text-sky-900">Key AI Insights</h3>
                <div className="ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded-lg" style={{ background: "rgba(14,165,233,0.1)" }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-sky-500 ping-soft" />
                  <span className="text-[8px] font-bold text-sky-600 uppercase tracking-wide">AI Generated</span>
                </div>
              </div>
              <div className="space-y-2">
                {insights.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 px-3 py-2.5 rounded-xl"
                    style={
                      item.type === "success"
                        ? { background: "rgba(236,253,245,0.8)", border: "1px solid rgba(16,185,129,0.2)" }
                        : { background: "rgba(255,251,235,0.8)", border: "1px solid rgba(245,158,11,0.2)" }
                    }
                  >
                    {item.type === "success"
                      ? <CheckCircle size={12} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                      : <AlertTriangle size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    }
                    <span className={`text-[11px] leading-relaxed font-medium ${item.type === "success" ? "text-emerald-900" : "text-amber-900"}`}>
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Roadmap */}
            <div className="bg-white rounded-3xl border p-5 shadow-sm" style={{ borderColor: "rgba(14,165,233,0.12)" }}>
              <h3 className="text-sm font-bold text-sky-900 mb-4">AI-Generated Roadmap</h3>
              <div>
                {roadmap.map((step, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0"
                        style={
                          i === 0
                            ? { background: "linear-gradient(135deg, #38bdf8, #0284c7)", color: "#fff", boxShadow: "0 4px 12px rgba(2,132,199,0.3)" }
                            : { background: "rgba(14,165,233,0.1)", color: "#0369a1" }
                        }
                      >
                        {i + 1}
                      </div>
                      {i < roadmap.length - 1 && (
                        <div className="w-px h-10 mt-1" style={{ background: "linear-gradient(to bottom, rgba(14,165,233,0.25), rgba(14,165,233,0.05))" }} />
                      )}
                    </div>
                    <div className={i < roadmap.length - 1 ? "pb-5" : ""}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-bold text-sky-900">{step.phase}</span>
                        <span
                          className="text-[8px] px-1.5 py-0.5 rounded-md font-semibold"
                          style={{ background: "rgba(14,165,233,0.08)", color: "#0369a1", border: "1px solid rgba(14,165,233,0.12)" }}
                        >
                          {step.period}
                        </span>
                      </div>
                      <p className="text-[10px] text-sky-500 leading-relaxed">{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Team Composition */}
            <div className="bg-white rounded-3xl border p-5 shadow-sm" style={{ borderColor: "rgba(14,165,233,0.12)" }}>
              <h3 className="text-sm font-bold text-sky-900 mb-3">Recommended Team Composition</h3>
              <div className="grid grid-cols-3 gap-3">
                {teamRoles.map((member) => (
                  <div key={member.role} className={`p-3 rounded-2xl border ${member.bg} ${member.border}`}>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2.5 ${member.iconBg}`}>
                      {member.icon}
                    </div>
                    <div className="text-[10px] font-bold text-sky-900 mb-2 leading-tight">{member.role}</div>
                    <div className="flex flex-wrap gap-1">
                      {member.skills.map((s) => (
                        <span
                          key={s}
                          className="text-[8px] px-1.5 py-0.5 rounded-md font-semibold"
                          style={{ background: "rgba(255,255,255,0.8)", color: "#0369a1", border: "1px solid rgba(14,165,233,0.15)" }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Next AI Actions */}
            <div className="bg-white rounded-3xl border p-5 shadow-sm" style={{ borderColor: "rgba(14,165,233,0.12)" }}>
              <h3 className="text-sm font-bold text-sky-900 mb-3">Next AI Actions</h3>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { label: "Generate Pitch Deck", icon: <FileText size={15} />, primary: true },
                  { label: "Build MVP Roadmap",   icon: <Map size={15} />,      primary: false },
                  { label: "Explore Pivot Ideas", icon: <Compass size={15} />,  primary: false },
                ].map((action) => (
                  <button
                    key={action.label}
                    className="flex flex-col items-center gap-2 p-3 rounded-2xl text-[11px] font-bold transition-all hover:scale-105 active:scale-95"
                    style={
                      action.primary
                        ? { background: "linear-gradient(135deg, #0ea5e9, #0284c7)", color: "#fff", boxShadow: "0 4px 14px rgba(2,132,199,0.3)" }
                        : { background: "rgba(240,249,255,0.8)", color: "#0369a1", border: "1px solid rgba(14,165,233,0.15)" }
                    }
                  >
                    {action.icon}
                    <span className="text-center leading-tight">{action.label}</span>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-semibold text-sky-600 transition-all hover:bg-sky-100 active:scale-95"
                  style={{ background: "rgba(240,249,255,0.6)", border: "1px solid rgba(14,165,233,0.12)" }}
                >
                  <RefreshCw size={12} />
                  Revise Idea
                </button>
                <button
                  onClick={() => navigate("/matches")}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-semibold text-sky-600 transition-all hover:bg-sky-100 active:scale-95"
                  style={{ background: "rgba(240,249,255,0.6)", border: "1px solid rgba(14,165,233,0.12)" }}
                >
                  <Users size={12} />
                  Find Collaborators
                </button>
              </div>
            </div>

            <div className="h-1" />
          </div>

          {/* Sticky structured idea form footer */}
          <div
            className="flex-shrink-0 border-t p-4"
            style={{ borderColor: "rgba(14,165,233,0.12)", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb size={14} className="text-sky-500" />
              <h4 className="text-[12px] font-bold text-sky-900">Enter your startup idea</h4>
              <span className="text-[9px] text-sky-400 ml-1">AI will analyse and refine</span>
            </div>

            <div className="grid grid-cols-12 gap-3">
              {/* Idea title */}
              <div className="col-span-12 lg:col-span-5">
                <label className="block text-[9px] font-bold text-sky-700 uppercase tracking-wider mb-1.5">
                  Startup Idea
                </label>
                <input
                  type="text"
                  value={ideaTitle}
                  onChange={(e) => setIdeaTitle(e.target.value)}
                  placeholder="e.g., AI-powered diagnostics for rural clinics"
                  className="w-full text-[12px] rounded-xl px-3 py-2.5 text-sky-900 placeholder-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-300 transition-all"
                  style={{
                    background: "rgba(240,249,255,0.7)",
                    border: "1px solid rgba(14,165,233,0.18)",
                  }}
                />
              </div>

              {/* Solution */}
              <div className="col-span-12 lg:col-span-7">
                <label className="block text-[9px] font-bold text-sky-700 uppercase tracking-wider mb-1.5">
                  Solution you are proposing
                </label>
                <textarea
                  value={ideaSolution}
                  onChange={(e) => setIdeaSolution(e.target.value)}
                  placeholder="How does it work and who does it help?"
                  rows={2}
                  className="w-full text-[12px] rounded-xl px-3 py-2.5 resize-none text-sky-900 placeholder-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-300 transition-all"
                  style={{
                    background: "rgba(240,249,255,0.7)",
                    border: "1px solid rgba(14,165,233,0.18)",
                  }}
                />
              </div>

              {/* Problem area chips */}
              <div className="col-span-12">
                <label className="block text-[9px] font-bold text-sky-700 uppercase tracking-wider mb-1.5">
                  Problem area you are solving
                </label>
                <div className="flex flex-wrap gap-2">
                  {PROBLEM_AREAS.map((area) => {
                    const active = selectedAreas.includes(area.id);
                    return (
                      <button
                        key={area.id}
                        type="button"
                        onClick={() => toggleArea(area.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all active:scale-95 ${
                          active ? "text-white shadow-md" : "text-sky-700 hover:bg-sky-50"
                        }`}
                        style={
                          active
                            ? { background: "linear-gradient(135deg, #38bdf8, #0284c7)", border: "1px solid transparent" }
                            : { background: "rgba(240,249,255,0.7)", border: "1px solid rgba(14,165,233,0.2)" }
                        }
                      >
                        <span>{area.emoji}</span>
                        {area.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Actions row */}
              <div className="col-span-12 flex flex-wrap items-center gap-2 pt-1">
                <button
                  disabled={!ideaTitle || !ideaSolution || selectedAreas.length === 0}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-[11px] font-bold transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  style={{ background: "linear-gradient(135deg, #0ea5e9, #0284c7)", boxShadow: "0 3px 10px rgba(2,132,199,0.3)" }}
                >
                  <Activity size={12} />
                  Run Analysis
                </button>
                <button
                  onClick={() => navigate("/workspaces")}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-[11px] font-bold transition-all hover:opacity-90 active:scale-95 whitespace-nowrap"
                  style={{ background: "linear-gradient(135deg, #10b981, #059669)", boxShadow: "0 3px 10px rgba(5,150,105,0.3)" }}
                  title="Create a collaborative workspace for this project"
                >
                  <Briefcase size={12} />
                  Create Workspace
                </button>
                <button
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sky-600 text-[11px] font-bold transition-all hover:bg-sky-100 active:scale-95 whitespace-nowrap"
                  style={{ background: "rgba(240,249,255,0.8)", border: "1px solid rgba(14,165,233,0.18)" }}
                >
                  <Upload size={12} />
                  Upload Docs
                </button>
                <span className="text-[9px] text-sky-400 ml-auto">
                  {selectedAreas.length > 0
                    ? `${selectedAreas.length} area${selectedAreas.length === 1 ? "" : "s"} selected`
                    : "Select at least one area to enable analysis"}
                </span>
              </div>
            </div>
          </div>
        </main>

        {/* ══════════════ RIGHT PANEL ══════════════ */}
        {isDocPreviewOpen && (
          <aside
            className="w-[420px] flex-shrink-0 flex flex-col border-l overflow-hidden"
            style={{ borderColor: "rgba(14,165,233,0.12)", background: "rgba(255,255,255,0.82)", backdropFilter: "blur(12px)" }}
          >
            {/* Header */}
            <div className="flex-shrink-0 px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "rgba(14,165,233,0.1)" }}>
              <div>
                <h3 className="text-sm font-bold text-sky-900">Document Preview</h3>
                <p className="text-[9px] text-sky-400 font-medium mt-0.5">AI-Generated Report</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1.5 rounded-xl text-white text-[10px] font-bold transition-all hover:opacity-90 active:scale-95"
                  style={{ background: "linear-gradient(135deg, #0ea5e9, #0284c7)", boxShadow: "0 3px 8px rgba(2,132,199,0.3)" }}
                >
                  Publish
                </button>
                <button
                  onClick={() => setIsDocPreviewOpen(false)}
                  className="w-7 h-7 rounded-xl flex items-center justify-center transition-all hover:bg-sky-100 active:scale-95"
                  style={{ background: "rgba(240,249,255,0.8)", border: "1px solid rgba(14,165,233,0.15)" }}
                  title="Collapse panel"
                >
                  <ChevronRight size={14} className="text-sky-600" />
                </button>
              </div>
            </div>

          {/* Scrollable doc content */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 scrollbar-hide">

            {/* Doc header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-sky-900 leading-tight">TechIT Network</h2>
                <p className="text-[10px] text-sky-500 font-medium mt-0.5">AI-Powered Startup Incubation Ecosystem</p>
              </div>
              <span
                className="px-2.5 py-1 rounded-xl text-[9px] font-black flex-shrink-0"
                style={{ background: "#d1fae5", color: "#065f46" }}
              >
                High Potential
              </span>
            </div>

            {/* Section helper */}
            {([
              {
                title: "Idea Summary",
                content: (
                  <p className="text-[11px] text-sky-700 leading-relaxed">
                    TechIT Network is an intelligent platform that connects student founders, technical talent, mentors, collaborators, and investors in one unified AI-driven incubation ecosystem focused on emerging markets.
                  </p>
                ),
              },
              {
                title: "AI Analysis Summary",
                content: (
                  <>
                    <div className="grid grid-cols-2 gap-2.5 mb-3">
                      <div className="p-3 rounded-2xl border" style={{ background: "rgba(240,249,255,0.5)", borderColor: "rgba(14,165,233,0.12)" }}>
                        <p className="text-[8px] text-sky-400 font-semibold uppercase mb-1">Market Fit</p>
                        <p className="text-2xl font-black text-emerald-600">82%</p>
                      </div>
                      <div className="p-3 rounded-2xl border" style={{ background: "rgba(240,249,255,0.5)", borderColor: "rgba(14,165,233,0.12)" }}>
                        <p className="text-[8px] text-sky-400 font-semibold uppercase mb-1">Unicorn</p>
                        <p className="text-2xl font-black text-sky-600">64%</p>
                      </div>
                    </div>
                    <ul className="space-y-2">
                      {[
                        { type: "success", text: "Strong product-market alignment with student innovators" },
                        { type: "success", text: "Scalable AI matchmaking engine" },
                        { type: "warning", text: "Need differentiation from global competitors" },
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className={`text-[11px] font-black flex-shrink-0 mt-px ${item.type === "success" ? "text-emerald-500" : "text-amber-500"}`}>
                            {item.type === "success" ? "✓" : "⚠"}
                          </span>
                          <span className="text-[10px] text-sky-700 leading-relaxed">{item.text}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ),
              },
              {
                title: "Business Plan Excerpt",
                content: (
                  <div className="space-y-2.5">
                    {[
                      { label: "Executive Summary", body: "TechIT aims to become the leading startup incubation platform in Africa by leveraging AI to reduce execution friction and increase success rates." },
                      { label: "Market Opportunity", body: "Over 500,000 student founders and technical talent across African universities seeking structured support." },
                      { label: "Monetization", body: "Freemium model + premium incubation services + investor matchmaking fees." },
                    ].map((item) => (
                      <p key={item.label} className="text-[11px] text-sky-700 leading-relaxed">
                        <strong className="text-sky-900 font-bold">{item.label}: </strong>{item.body}
                      </p>
                    ))}
                  </div>
                ),
              },
              {
                title: "Recommendations & Risks",
                content: (
                  <p className="text-[11px] text-sky-700 leading-relaxed">
                    Focus initial launch on 5 key universities. Primary risk is user acquisition — mitigated through university partnerships and AI-powered hackathons.
                  </p>
                ),
              },
            ] as { title: string; content: React.ReactNode }[]).map((section) => (
              <section key={section.title}>
                <h4
                  className="text-[8px] font-black text-sky-700 uppercase tracking-widest pb-2 mb-3"
                  style={{ borderBottom: "1px solid rgba(14,165,233,0.12)" }}
                >
                  {section.title}
                </h4>
                {section.content}
              </section>
            ))}

          </div>
          </aside>
        )}

        {/* Collapse toggle button when panel is closed */}
        {!isDocPreviewOpen && (
          <button
            onClick={() => setIsDocPreviewOpen(true)}
            className="fixed top-4 right-4 w-10 h-10 rounded-2xl flex items-center justify-center shadow-xl transition-all hover:scale-105 active:scale-95 z-50"
            style={{ background: "linear-gradient(135deg, #0ea5e9, #0284c7)", boxShadow: "0 4px 16px rgba(2,132,199,0.35)" }}
            title="Show document preview"
          >
            <ChevronLeft size={18} className="text-white" />
          </button>
        )}
      </div>
    </>
  );
}
