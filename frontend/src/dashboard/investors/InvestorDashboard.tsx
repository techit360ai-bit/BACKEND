import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInvestorProfile } from "@/contexts/UserContext";
import { InvestorSidebar } from "./components/InvestorSidebar";
import { MetricCard } from "./components/MetricCard";
import { ExecutionMomentumChart } from "./components/ExecutionMomentumChart";
import { HighMomentumCard } from "./components/HighMomentumCard";
import { PortfolioRiskChart } from "./components/PortfolioRiskChart";
import { AIInsights } from "./components/AIInsights";
import {
  LineChart as LineChartIcon,
  TrendingUp,
  CheckCircle,
  Shield,
  Zap,
} from "lucide-react";

export function InvestorDashboard() {
  const navigate = useNavigate();
  const { investorProfile } = useInvestorProfile();

  useEffect(() => {
    // If user hasn't completed onboarding, redirect to step 1
    if (!investorProfile.investorType) {
      navigate("/investor/onboarding/step-1");
    }
  }, [investorProfile.investorType, navigate]);

  return (
    <div className="flex min-h-screen bg-white dark:bg-slate-950">
      {/* Desktop Sidebar */}
      <InvestorSidebar />

      {/* Mobile Hamburger Menu */}
      <InvestorSidebar isMobile={true} />

      {/* Main Content */}
      <div className="flex-1 md:ml-64">
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 sticky top-0 z-20">
          <div className="px-4 md:px-8 py-6 md:py-8">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-2">
              Investor Dashboard
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Live startup execution intelligence
            </p>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="p-4 md:p-8 space-y-8 bg-white dark:bg-slate-950">
          {/* Metric Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <MetricCard
              icon={<LineChartIcon className="w-6 h-6" />}
              value="12"
              label="Watchlisted Startups"
              backgroundColor="from-blue-500/5 to-blue-600/5"
              borderColor="border-blue-500/30"
              iconBgColor="from-blue-500 to-blue-600"
            />
            <MetricCard
              icon={<TrendingUp className="w-6 h-6" />}
              value="8"
              label="80+ Readiness"
              backgroundColor="from-emerald-500/5 to-emerald-600/5"
              borderColor="border-emerald-500/30"
              iconBgColor="from-emerald-500 to-emerald-600"
            />
            <MetricCard
              icon={<Zap className="w-6 h-6" />}
              value="6"
              label="75+ Execution Velocity"
              backgroundColor="from-purple-500/5 to-purple-600/5"
              borderColor="border-purple-500/30"
              iconBgColor="from-purple-500 to-purple-600"
            />
            <MetricCard
              icon={<CheckCircle className="w-6 h-6" />}
              value="11"
              label="Revenue Validated"
              backgroundColor="from-amber-500/5 to-amber-600/5"
              borderColor="border-amber-500/30"
              iconBgColor="from-amber-500 to-amber-600"
            />
            <MetricCard
              icon={<Shield className="w-6 h-6" />}
              value="9"
              label="AI Governance Verified"
              backgroundColor="from-cyan-500/5 to-cyan-600/5"
              borderColor="border-cyan-500/30"
              iconBgColor="from-cyan-500 to-cyan-600"
            />
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Execution Momentum Chart - Takes 2 columns on larger screens */}
            <div className="lg:col-span-2">
              <ExecutionMomentumChart />
            </div>

            {/* High Momentum This Week - 1 column */}
            <div>
              <div className="bg-slate-900 dark:bg-slate-950 border border-slate-700 dark:border-slate-800 rounded-xl p-6">
                <HighMomentumCard />
              </div>
            </div>
          </div>

          {/* Portfolio Risk Distribution */}
          <PortfolioRiskChart />

          {/* AI Insights */}
          <AIInsights />
        </div>
      </div>
    </div>
  );
}

export default InvestorDashboard;
