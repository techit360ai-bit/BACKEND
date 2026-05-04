import {
  CreditCard,
  TrendingUp,
  Zap,
  Database,
  Sparkles,
  Rocket,
  Clock,
  BarChart3,
  X,
  Play,
  ShoppingCart,
} from "lucide-react";
import { useState } from "react";
import Sidebar from "../components/Sidebar";
import MobileMenuButton from "../components/MobileMenuButton";
import PaymentModal from "../components/PaymentModal";

const recentUsage = [
  {
    id: 1,
    icon: Sparkles,
    title: "AI code generation",
    time: "2 min ago",
    credits: "-12",
    color: "bg-violet-500/20",
    iconColor: "text-violet-400",
  },
  {
    id: 2,
    icon: Rocket,
    title: "Deploy pipeline",
    time: "15 min ago",
    credits: "-10",
    color: "bg-cyan-500/20",
    iconColor: "text-cyan-400",
  },
  {
    id: 3,
    icon: Zap,
    title: "Automation run",
    time: "1 hour ago",
    credits: "-8",
    color: "bg-teal-500/20",
    iconColor: "text-teal-400",
  },
  {
    id: 4,
    icon: Database,
    title: "Database backup",
    time: "3 hours ago",
    credits: "-5",
    color: "bg-rose-500/20",
    iconColor: "text-rose-400",
  },
  {
    id: 5,
    icon: BarChart3,
    title: "API analytics",
    time: "5 hours ago",
    credits: "-3",
    color: "bg-violet-500/20",
    iconColor: "text-violet-400",
  },
];

const bottomCards = [
  {
    title: "Upgrade Plan",
    description: "Get more credits monthly",
    icon: CreditCard,
    color: "border-violet-500/50",
  },
  {
    title: "Usage Analytics",
    description: "See detailed breakdowns",
    icon: TrendingUp,
    color: "border-cyan-500/50",
  },
  {
    title: "Run Automation",
    description: "Preview credit cost",
    icon: Clock,
    color: "border-teal-500/50",
  },
];

const creditPackages = [
  {
    id: 1,
    name: "Starter",
    credits: 200,
    price: "₦2,000",
    usdPrice: "$2",
    popular: false,
  },
  {
    id: 2,
    name: "Builder",
    credits: 550,
    price: "₦5,000",
    usdPrice: "$5",
    popular: true,
  },
  {
    id: 3,
    name: "Pro",
    credits: 1200,
    price: "₦10,000",
    usdPrice: "$10",
    popular: false,
  },
  {
    id: 4,
    name: "Studio",
    credits: 7500,
    price: "₦50,000",
    usdPrice: "$50",
    popular: false,
  },
];

const pricingPlans = [
  {
    id: 1,
    name: "Free",
    priceNGN: "₦0",
    priceUSD: "$0",
    credits: "50 credits",
    popular: false,
    features: [
      "50 credits monthly",
      "Basic AI features",
      "Community support",
      "1 active project",
    ],
  },
  {
    id: 2,
    name: "Maker",
    priceNGN: "₦3,000",
    priceUSD: "$3",
    credits: "300 credits",
    popular: false,
    features: [
      "300 credits monthly",
      "All AI features",
      "Priority support",
      "5 active projects",
      "Advanced analytics",
    ],
  },
  {
    id: 3,
    name: "Team",
    priceNGN: "₦10,000",
    priceUSD: "$10",
    credits: "1,200 credits",
    popular: true,
    features: [
      "1,200 credits monthly",
      "Everything in Maker",
      "Team collaboration",
      "Unlimited projects",
      "Custom automations",
      "API access",
    ],
  },
  {
    id: 4,
    name: "Studio",
    priceNGN: "₦30,000",
    priceUSD: "$30",
    credits: "5,000 credits",
    popular: false,
    features: [
      "5,000 credits monthly",
      "Everything in Team",
      "Dedicated support",
      "Custom integrations",
      "SLA guarantee",
      "Advanced security",
    ],
  },
];

const pricingFeatures = [
  {
    icon: Clock,
    title: "Credits Never Expire",
    description:
      "Use your credits anytime. They roll over month to month, so you never lose what you paid for.",
  },
  {
    icon: Zap,
    title: "Flexible Usage",
    description:
      "Use credits across all features: AI code generation, automation, pipelines, and more.",
  },
  {
    icon: Rocket,
    title: "Scale As You Grow",
    description:
      "Start small and upgrade anytime. Buy extra credits when you need them.",
  },
];

// Type for a pricing plan (used by PaymentModal)
type PricingPlan = (typeof pricingPlans)[0];

export default function Wallet() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewUsageOpen, setIsViewUsageOpen] = useState(false);
  const [isPlansOpen, setIsPlansOpen] = useState(false);
  const [currency, setCurrency] = useState<"NGN" | "USD">("NGN");

  // PaymentModal state — holds the plan the user clicked "Get Started" on
  const [paymentPlan, setPaymentPlan] = useState<PricingPlan | null>(null);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);
  const openViewUsage = () => setIsViewUsageOpen(true);
  const closeViewUsage = () => setIsViewUsageOpen(false);
  const openPlans = () => setIsPlansOpen(true);
  const closePlans = () => setIsPlansOpen(false);

  // Opens PaymentModal for the selected plan (also closes Plans modal)
  const handleGetStarted = (plan: PricingPlan) => {
    closePlans();
    setPaymentPlan(plan);
  };

  return (
    <div className="min-h-dvh w-full flex bg-background text-foreground">
      <Sidebar />

      {/* Main content */}
      <main className="flex-1 min-h-dvh overflow-y-auto bg-linear-to-b from-slate-50 via-violet-50/30 to-slate-50 dark:from-slate-950 dark:via-slate-900/50 dark:to-slate-950">
        {/* Top Navigation */}
        <div className="border-b border-violet-200/50 dark:border-violet-800/50 bg-linear-to-r from-sky-50 to-violet-50 dark:from-slate-900/50 dark:to-purple-900/50 sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-4 lg:px-8 py-4 flex items-center justify-between gap-8">
            <div className="flex items-center gap-8">
              <MobileMenuButton />
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold bg-linear-to-r from-violet-600 to-cyan-600 dark:from-violet-400 dark:to-cyan-400 bg-clip-text text-transparent">
                    TechIT
                  </span>
                </div>
                <nav className="flex items-center gap-6 text-sm">
                  <button className="text-violet-600 dark:text-violet-400 font-medium border-b-2 border-violet-600 dark:border-violet-400 pb-1">
                    Wallet
                  </button>
                  <button className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                    Pricing
                  </button>
                  <button className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                    Analytics
                  </button>
                </nav>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-linear-to-r from-violet-100 to-cyan-100 dark:from-violet-950/40 dark:to-cyan-950/40 px-4 py-2 rounded-full border border-violet-300 dark:border-violet-800/50">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                1,240 Credits
              </span>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8 space-y-8">
          {/* Main Credit Card */}
          <div className="rounded-3xl bg-linear-to-br from-violet-600 via-violet-500 to-cyan-500 border border-violet-400/50 dark:border-violet-600/50 px-8 py-8 space-y-6 shadow-xl shadow-violet-500/20">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard className="h-5 w-5 text-cyan-400" />
                  <span className="text-sm text-slate-300">TechIT Credits</span>
                </div>
                <h2 className="text-5xl font-bold text-white">1,240</h2>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs text-slate-400 mb-1">Monthly</p>
                  <p className="text-2xl font-bold text-cyan-400">320</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400 mb-1">Bonus</p>
                  <p className="text-2xl font-bold text-emerald-400">180</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <button
                onClick={openModal}
                className="w-full rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-2.5 transition-colors"
              >
                Buy Credits
              </button>
              <button
                onClick={openViewUsage}
                className="w-full rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700 text-white font-semibold py-2.5 transition-colors"
              >
                View Usage
              </button>
              <button
                onClick={openPlans}
                className="w-full rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700 text-white font-semibold py-2.5 transition-colors"
              >
                Plans
              </button>
              <button className="w-full rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700 text-white font-semibold py-2.5 transition-colors">
                History
              </button>
            </div>
          </div>

          {/* Charts and Recent Usage */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Credits Spent Chart */}
            <div className="lg:col-span-2 rounded-2xl bg-slate-900/80 border border-slate-800 px-6 py-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Credits Spent
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Last 7 days</p>
                </div>
                <TrendingUp className="h-5 w-5 text-emerald-400" />
              </div>

              <div className="h-64 w-full">
                <svg viewBox="0 0 700 250" className="w-full h-full">
                  <line
                    x1="0"
                    y1="50"
                    x2="700"
                    y2="50"
                    stroke="#334155"
                    strokeWidth="1"
                    strokeDasharray="5,5"
                  />
                  <line
                    x1="0"
                    y1="100"
                    x2="700"
                    y2="100"
                    stroke="#334155"
                    strokeWidth="1"
                    strokeDasharray="5,5"
                  />
                  <line
                    x1="0"
                    y1="150"
                    x2="700"
                    y2="150"
                    stroke="#334155"
                    strokeWidth="1"
                    strokeDasharray="5,5"
                  />
                  <line
                    x1="0"
                    y1="200"
                    x2="700"
                    y2="200"
                    stroke="#334155"
                    strokeWidth="1"
                    strokeDasharray="5,5"
                  />
                  <defs>
                    <linearGradient
                      id="lineGradient"
                      x1="0%"
                      y1="0%"
                      x2="0%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
                      <stop
                        offset="100%"
                        stopColor="#06b6d4"
                        stopOpacity="0.05"
                      />
                    </linearGradient>
                  </defs>
                  <polyline
                    points="50,87.5 150,80 250,142.5 350,125 450,75 550,35 650,87.5"
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <polygon
                    points="50,87.5 150,80 250,142.5 350,125 450,75 550,35 650,87.5 650,250 50,250"
                    fill="url(#lineGradient)"
                  />
                  {[
                    { x: 50, y: 87.5, value: 150 },
                    { x: 150, y: 80, value: 140 },
                    { x: 250, y: 142.5, value: 95 },
                    { x: 350, y: 125, value: 110 },
                    { x: 450, y: 75, value: 160 },
                    { x: 550, y: 35, value: 180 },
                    { x: 650, y: 87.5, value: 150 },
                  ].map((point, idx) => (
                    <g key={idx} className="group cursor-pointer">
                      <circle cx={point.x} cy={point.y} r="5" fill="#06b6d4" />
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r="7"
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth="2"
                        opacity="0"
                        className="group-hover:opacity-100 transition-opacity"
                      />
                      <text
                        x={point.x}
                        y={point.y - 15}
                        textAnchor="middle"
                        fill="white"
                        fontSize="12"
                        opacity="0"
                        className="group-hover:opacity-100 transition-opacity"
                      >
                        {point.value}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>Feb 13</span>
                <span>Feb 14</span>
                <span>Feb 15</span>
                <span>Feb 16</span>
                <span>Feb 17</span>
                <span>Feb 18</span>
                <span>Feb 19</span>
              </div>
            </div>

            {/* Recent Usage */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 px-6 py-6 space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-cyan-400" />
                <h3 className="text-lg font-semibold text-white">
                  Recent Usage
                </h3>
              </div>
              <div className="space-y-3">
                {recentUsage.map((item) => {
                  const IconComponent = item.icon;
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 rounded-lg ${item.color} px-3 py-3 border border-slate-700/50`}
                    >
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.color}`}
                      >
                        <IconComponent
                          className={`h-4 w-4 ${item.iconColor}`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {item.title}
                        </p>
                        <p className="text-xs text-slate-400">{item.time}</p>
                      </div>
                      <span className="text-sm font-semibold text-cyan-400 whitespace-nowrap">
                        {item.credits}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {bottomCards.map((card, idx) => {
              const IconComponent = card.icon;
              return (
                <div
                  key={idx}
                  className={`rounded-2xl bg-slate-900/80 border ${card.color} px-6 py-6 space-y-3 hover:border-opacity-100 transition-all cursor-pointer group`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-white group-hover:text-cyan-400 transition-colors">
                        {card.title}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1">
                        {card.description}
                      </p>
                    </div>
                    <IconComponent className="h-5 w-5 text-slate-400 group-hover:text-cyan-400 transition-colors" />
                  </div>
                  <div className="flex items-center text-xs text-cyan-400 group-hover:gap-1 transition-all">
                    <span>Learn more</span>
                    <span>→</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/*  Buy Credits Modal  */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={closeModal}
            />
            <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-6">
              <button
                onClick={closeModal}
                className="absolute top-4 right-4 p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="h-6 w-6 text-slate-400 hover:text-white" />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Buy TechIT Credits
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Choose the perfect pack for your needs
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {creditPackages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className={`relative rounded-xl border p-6 space-y-4 transition-all ${
                      pkg.popular
                        ? "border-cyan-500/50 bg-slate-800/50"
                        : "border-slate-700 bg-slate-800/30 hover:bg-slate-800/50"
                    }`}
                  >
                    {pkg.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-cyan-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                        Most Popular
                      </div>
                    )}
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        {pkg.name}
                      </h3>
                    </div>
                    <div>
                      <p className="text-4xl font-bold text-cyan-400">
                        {pkg.credits}
                      </p>
                      <p className="text-xs text-slate-400">credits</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-white">
                        {pkg.price}
                      </p>
                      <p className="text-xs text-slate-400">/ {pkg.usdPrice}</p>
                    </div>
                    <button
                      className={`w-full rounded-lg py-2.5 font-semibold transition-colors ${
                        pkg.popular
                          ? "bg-cyan-500 hover:bg-cyan-600 text-white"
                          : "bg-slate-700 hover:bg-slate-600 text-white"
                      }`}
                    >
                      Select Pack
                    </button>
                  </div>
                ))}
              </div>
              <div className="rounded-lg bg-slate-800/50 border border-slate-700 px-4 py-3 flex items-start gap-3">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/20 mt-0.5 shrink-0">
                  <span className="text-xs text-cyan-400">✓</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    Credits never expire
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Use your credits anytime for AI automation, pipelines, and
                    more
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/*  View Usage Modal */}
        {isViewUsageOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={closeViewUsage}
            />
            <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-sm w-full space-y-6">
              <button
                onClick={closeViewUsage}
                className="absolute top-4 right-4 p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="h-6 w-6 text-slate-400 hover:text-white" />
              </button>
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-purple-600 to-purple-800">
                    <Play className="h-8 w-8 text-white fill-white" />
                  </div>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    AI Data Processing
                  </h2>
                  <p className="text-sm text-slate-400 mt-2">
                    This automation will analyze and process your dataset
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-cyan-500/50 bg-slate-800/50 px-6 py-4 text-center space-y-1">
                <p className="text-sm text-slate-400">This automation costs</p>
                <p className="text-4xl font-bold text-cyan-400">12 credits</p>
                <p className="text-xs text-slate-400">≈ ₦120 / $0.12</p>
              </div>
              <div className="space-y-3">
                <button className="w-full rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-3 transition-colors flex items-center justify-center gap-2">
                  <Play className="h-4 w-4 fill-white" />
                  Run Automation
                </button>
                <button
                  onClick={closeViewUsage}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-white font-semibold py-3 transition-colors"
                >
                  Cancel
                </button>
                <button className="w-full rounded-xl border border-cyan-500/50 bg-slate-800/30 hover:bg-slate-800/50 text-cyan-400 font-semibold py-3 transition-colors flex items-center justify-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Buy More Credits
                </button>
              </div>
              <div className="text-center pt-2">
                <p className="text-xs text-slate-400">
                  Current balance:{" "}
                  <span className="text-white font-semibold">
                    1,240 credits
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/*  Pricing Plans Modal  */}
        {isPlansOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm -z-10"
              onClick={closePlans}
            />
            <div className="relative bg-linear-to-b from-slate-950 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col">
              <button
                onClick={closePlans}
                className="absolute top-4 right-4 p-2 hover:bg-slate-800 rounded-lg transition-colors z-10"
              >
                <X className="h-6 w-6 text-slate-400 hover:text-white" />
              </button>
              <div className="overflow-y-auto flex-1 px-6 sm:px-8 pt-6 sm:pt-8">
                <div className="text-center space-y-2 pb-8">
                  <div className="inline-block bg-cyan-500/20 border border-cyan-500/50 rounded-full px-4 py-1">
                    <span className="text-sm font-semibold text-cyan-400">
                      Simple, transparent pricing
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white">
                    Power your software execution with{" "}
                    <span className="text-cyan-400">TechIT Credits</span>
                  </h2>
                  <p className="text-sm sm:text-base text-slate-400">
                    Run AI, automation, pipelines, and deployments using
                    flexible credits. Only pay for what you use.
                  </p>
                </div>

                {/* Currency Toggle */}
                <div className="flex items-center justify-center gap-3 pb-6">
                  <button
                    onClick={() => setCurrency("NGN")}
                    className={`px-6 py-2 rounded-full font-semibold transition-all text-sm ${
                      currency === "NGN"
                        ? "bg-cyan-500 text-white"
                        : "bg-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    ₦ NGN
                  </button>
                  <button
                    onClick={() => setCurrency("USD")}
                    className={`px-6 py-2 rounded-full font-semibold transition-all text-sm ${
                      currency === "USD"
                        ? "bg-cyan-500 text-white"
                        : "bg-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    $ USD
                  </button>
                </div>

                {/* Pricing Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6">
                  {pricingPlans.map((plan) => (
                    <div
                      key={plan.id}
                      className={`relative rounded-2xl border p-5 space-y-4 transition-all ${
                        plan.popular
                          ? "border-cyan-500/50 bg-slate-800/80 sm:col-span-2 lg:col-span-1"
                          : "border-slate-700 bg-slate-900/50 hover:border-slate-600"
                      }`}
                    >
                      {plan.popular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-cyan-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                          Most Popular
                        </div>
                      )}
                      <div>
                        <h3 className="text-base font-bold text-white">
                          {plan.name}
                        </h3>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-cyan-400">
                          {currency === "NGN" ? plan.priceNGN : plan.priceUSD}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {plan.credits}
                        </p>
                      </div>
                      <div className="space-y-2">
                        {plan.features.slice(0, 3).map((feature, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2 text-xs"
                          >
                            <div className="flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500/20 mt-0.5 shrink-0">
                              <span className="text-xs text-cyan-400">✓</span>
                            </div>
                            <span className="text-slate-300">{feature}</span>
                          </div>
                        ))}
                      </div>

                      {/* ── Get Started → opens PaymentModal ── */}
                      <button
                        onClick={() => handleGetStarted(plan)}
                        className={`w-full rounded-lg py-2 font-semibold transition-all text-xs ${
                          plan.popular
                            ? "bg-linear-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white"
                            : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
                        }`}
                      >
                        Get Started
                      </button>
                    </div>
                  ))}
                </div>

                {/* Features Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pb-6">
                  {pricingFeatures.map((feature, idx) => {
                    const IconComponent = feature.icon;
                    return (
                      <div
                        key={idx}
                        className="rounded-xl bg-linear-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50 p-3 sm:p-4 space-y-2 hover:border-slate-600 transition-all"
                      >
                        <IconComponent className="h-5 w-5 text-cyan-400" />
                        <h4 className="text-xs sm:text-sm font-semibold text-white">
                          {feature.title}
                        </h4>
                        <p className="text-xs text-slate-400">
                          {feature.description}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Custom Plan Section */}
                <div className="rounded-2xl bg-linear-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/20 p-4 sm:p-6 text-center space-y-2 pb-8">
                  <h3 className="text-lg sm:text-xl font-bold text-white">
                    Need a custom plan?
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300">
                    We offer custom pricing for large teams and enterprises with
                    specific needs.
                  </p>
                  <button className="mx-auto rounded-lg bg-white hover:bg-slate-100 text-slate-900 font-semibold px-4 sm:px-6 py-2 transition-colors text-xs">
                    Contact Sales
                  </button>
                </div>
              </div>

              {/* Fixed Footer */}
              <div className="border-t border-slate-700 p-4 bg-linear-to-t from-slate-950 to-transparent">
                <button
                  onClick={closePlans}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-white font-semibold py-3 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {paymentPlan && (
          <PaymentModal
            isOpen={!!paymentPlan}
            onClose={() => setPaymentPlan(null)}
            plan={paymentPlan}
            currency={currency}
          />
        )}
      </main>
    </div>
  );
}
