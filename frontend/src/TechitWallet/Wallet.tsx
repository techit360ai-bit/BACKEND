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

const recentUsage = [
  {
    id: 1,
    icon: Sparkles,
    title: "AI code generation",
    time: "2 min ago",
    credits: "-12",
    color: "bg-orange-500/20",
    iconColor: "text-orange-400",
  },
  {
    id: 2,
    icon: Rocket,
    title: "Deploy pipeline",
    time: "15 min ago",
    credits: "-10",
    color: "bg-pink-500/20",
    iconColor: "text-pink-400",
  },
  {
    id: 3,
    icon: Zap,
    title: "Automation run",
    time: "1 hour ago",
    credits: "-8",
    color: "bg-yellow-500/20",
    iconColor: "text-yellow-400",
  },
  {
    id: 4,
    icon: Database,
    title: "Database backup",
    time: "3 hours ago",
    credits: "-5",
    color: "bg-purple-500/20",
    iconColor: "text-purple-400",
  },
  {
    id: 5,
    icon: BarChart3,
    title: "API analytics",
    time: "5 hours ago",
    credits: "-3",
    color: "bg-blue-500/20",
    iconColor: "text-blue-400",
  },
];

const bottomCards = [
  {
    title: "Upgrade Plan",
    description: "Get more credits monthly",
    icon: CreditCard,
    color: "border-blue-500/50",
  },
  {
    title: "Usage Analytics",
    description: "See detailed breakdowns",
    icon: TrendingUp,
    color: "border-purple-500/50",
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

export default function Wallet() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewUsageOpen, setIsViewUsageOpen] = useState(false);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);
  const openViewUsage = () => setIsViewUsageOpen(true);
  const closeViewUsage = () => setIsViewUsageOpen(false);

  return (
    <div className="min-h-dvh w-full flex bg-background text-foreground">
      <Sidebar />

      {/* Main content */}
      <main className="flex-1 min-h-dvh overflow-y-auto bg-gradient-to-b from-slate-100 via-indigo-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        {/* Top Navigation */}
        <div className="border-b border-slate-800 dark:border-slate-800 bg-slate-950 dark:bg-slate-950 sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-4 lg:px-8 py-4 flex items-center justify-between gap-8">
            <div className="flex items-center gap-8">
              <MobileMenuButton />
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-white">TechIT</span>
                </div>
                <nav className="flex items-center gap-6 text-sm">
                  <button className="text-cyan-400 font-medium border-b-2 border-cyan-400 pb-1">
                    Wallet
                  </button>
                  <button className="text-slate-400 hover:text-white transition-colors">
                    Pricing
                  </button>
                  <button className="text-slate-400 hover:text-white transition-colors">
                    Analytics
                  </button>
                </nav>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-slate-900 px-4 py-2 rounded-full border border-slate-800">
              <span className="text-sm font-semibold text-white">
                1,240 Credits
              </span>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8 space-y-8">
          {/* Main Credit Card */}
          <div className="rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-800 border border-indigo-600/50 px-8 py-8 space-y-6">
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
              <button className="w-full rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700 text-white font-semibold py-2.5 transition-colors">
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

              <div className="h-64 flex items-end justify-between gap-2">
                {[150, 140, 95, 110, 160, 180, 150].map((value, idx) => (
                  <div
                    key={idx}
                    className="flex-1 rounded-t-lg bg-gradient-to-t from-cyan-500 to-cyan-400/60 opacity-80 hover:opacity-100 transition-opacity relative group"
                    style={{ height: `${(value / 200) * 100}%` }}
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 px-2 py-1 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {value}
                    </div>
                  </div>
                ))}
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

        {/* Buy Credits Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Blurred background */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={closeModal}
            />

            {/* Modal Content */}
            <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-6">
              {/* Close Button */}
              <button
                onClick={closeModal}
                className="absolute top-4 right-4 p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="h-6 w-6 text-slate-400 hover:text-white" />
              </button>

              {/* Modal Header */}
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Buy TechIT Credits
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Choose the perfect pack for your needs
                </p>
              </div>

              {/* Credit Packages Grid */}
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

              {/* Footer Note */}
              <div className="rounded-lg bg-slate-800/50 border border-slate-700 px-4 py-3 flex items-start gap-3">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/20 mt-0.5 flex-shrink-0">
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

        {/* View Usage Modal - Automation Preview */}
        {isViewUsageOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Blurred background */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={closeViewUsage}
            />

            {/* Modal Content */}
            <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-sm w-full space-y-6">
              {/* Close Button */}
              <button
                onClick={closeViewUsage}
                className="absolute top-4 right-4 p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="h-6 w-6 text-slate-400 hover:text-white" />
              </button>

              {/* Modal Header */}
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-purple-800">
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

              {/* Credit Cost Box */}
              <div className="rounded-lg border border-cyan-500/50 bg-slate-800/50 px-6 py-4 text-center space-y-1">
                <p className="text-sm text-slate-400">This automation costs</p>
                <p className="text-4xl font-bold text-cyan-400">12 credits</p>
                <p className="text-xs text-slate-400">≈ ₦120 / $0.12</p>
              </div>

              {/* Action Buttons */}
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

              {/* Current Balance */}
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
      </main>
    </div>
  );
}
