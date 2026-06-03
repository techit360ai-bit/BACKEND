import {
  CreditCard,
  TrendingUp,
  Download,
  DollarSign,
  Zap,
  AlertCircle,
  CheckCircle2,
  ArrowUpRight,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const usageData = [
  { month: "Oct", ai: 8400, testing: 2100, marketplace: 1200 },
  { month: "Nov", ai: 9800, testing: 2400, marketplace: 1500 },
  { month: "Dec", ai: 11200, testing: 2800, marketplace: 1800 },
  { month: "Jan", ai: 13400, testing: 3200, marketplace: 2100 },
  { month: "Feb", ai: 15600, testing: 3600, marketplace: 2400 },
  { month: "Mar", ai: 18200, testing: 4100, marketplace: 2800 },
];

const currentPeriod = {
  aiCredits: 18200,
  testing: 4100,
  marketplace: 2800,
  total: 25100,
};

const billingHistory = [
  {
    date: "Mar 1, 2026",
    amount: "$2,510",
    status: "Paid",
    invoice: "INV-2026-03",
  },
  {
    date: "Feb 1, 2026",
    amount: "$2,160",
    status: "Paid",
    invoice: "INV-2026-02",
  },
  {
    date: "Jan 1, 2026",
    amount: "$1,870",
    status: "Paid",
    invoice: "INV-2026-01",
  },
  {
    date: "Dec 1, 2025",
    amount: "$1,560",
    status: "Paid",
    invoice: "INV-2025-12",
  },
];

const usageBreakdown = [
  { category: "AI Credits", usage: 18200, limit: 50000, cost: "$1,820" },
  { category: "Testing Campaigns", usage: 4100, limit: 10000, cost: "$410" },
  { category: "Marketplace Spend", usage: 2800, limit: "∞", cost: "$280" },
];

export function Billing() {
  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Billing & Usage</h1>
          <p className="text-muted-foreground mt-2">
            Manage subscription, track usage, and view billing history
          </p>
        </div>
        <button className="mt-4 sm:mt-0 inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
          <CreditCard className="w-5 h-5" />
          Update Payment
        </button>
      </div>

      {/* Current Plan */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-8 mb-8">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold text-foreground">Enterprise Plan</h2>
              <span className="px-3 py-1 bg-indigo-600 text-white rounded-full text-xs font-medium">
                Active
              </span>
            </div>
            <p className="text-foreground mb-4">
              Unlimited projects, teams, and AI operations
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-foreground">$2,510</span>
              <span className="text-muted-foreground">/month</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button className="px-6 py-3 bg-background text-foreground rounded-lg hover:bg-background transition-colors font-medium border border-border">
              View All Plans
            </button>
            <button className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium">
              Upgrade Plan
            </button>
          </div>
        </div>
      </div>

      {/* Current Usage Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-background rounded-xl shadow-sm p-6 border border-border">
          <Zap className="w-6 h-6 text-purple-600 mb-3" />
          <p className="text-3xl font-bold text-foreground">
            {currentPeriod.aiCredits.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground mt-1">AI Credits Used</p>
        </div>
        <div className="bg-background rounded-xl shadow-sm p-6 border border-border">
          <CheckCircle2 className="w-6 h-6 text-green-600 mb-3" />
          <p className="text-3xl font-bold text-foreground">
            {currentPeriod.testing.toLocaleString()}
          </p>
          <p className="text-sm text-muted-foreground mt-1">Testing Credits</p>
        </div>
        <div className="bg-background rounded-xl shadow-sm p-6 border border-border">
          <DollarSign className="w-6 h-6 text-blue-600 mb-3" />
          <p className="text-3xl font-bold text-foreground">
            ${(currentPeriod.marketplace / 100).toFixed(0)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">Marketplace Spend</p>
        </div>
        <div className="bg-background rounded-xl shadow-sm p-6 border border-border">
          <TrendingUp className="w-6 h-6 text-orange-600 mb-3" />
          <p className="text-3xl font-bold text-foreground">
            ${(currentPeriod.total / 100).toFixed(0)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">Total This Month</p>
        </div>
      </div>

      {/* Usage Chart */}
      <div className="bg-background rounded-xl shadow-sm border border-border p-6 mb-8">
        <h2 className="text-lg font-bold text-foreground mb-6">Usage Trends</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={usageData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="ai" stackId="a" fill="#8b5cf6" name="AI Credits" />
            <Bar dataKey="testing" stackId="a" fill="#10b981" name="Testing" />
            <Bar dataKey="marketplace" stackId="a" fill="#3b82f6" name="Marketplace" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Usage Breakdown */}
      <div className="bg-background rounded-xl shadow-sm border border-border p-6 mb-8">
        <h2 className="text-lg font-bold text-foreground mb-6">Usage Breakdown</h2>
        <div className="space-y-6">
          {usageBreakdown.map((item) => (
            <div key={item.category}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground">
                      {item.category}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {item.usage.toLocaleString()}
                      {item.limit !== "∞" && ` / ${item.limit.toLocaleString()}`}
                    </span>
                  </div>
                  <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        item.category === "AI Credits"
                          ? "bg-purple-500"
                          : item.category === "Testing Campaigns"
                          ? "bg-green-500"
                          : "bg-blue-500"
                      }`}
                      style={{
                        width:
                          item.limit === "∞"
                            ? "100%"
                            : `${(item.usage / Number(item.limit)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <span className="ml-6 text-sm font-bold text-foreground">
                  {item.cost}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Billing History */}
        <div className="bg-background rounded-xl shadow-sm border border-border p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-foreground">Billing History</h2>
            <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
              View All
            </button>
          </div>
          <div className="space-y-4">
            {billingHistory.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between pb-4 border-b border-border last:border-0"
              >
                <div>
                  <p className="font-medium text-foreground">{item.amount}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.date}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                    {item.status}
                  </span>
                  <button className="p-1.5 hover:bg-muted/40 rounded">
                    <Download className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Method */}
        <div className="bg-background rounded-xl shadow-sm border border-border p-6">
          <h2 className="text-lg font-bold text-foreground mb-6">Payment Method</h2>
          <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl p-6 text-white mb-4">
            <div className="flex items-start justify-between mb-8">
              <div>
                <p className="text-xs opacity-80 mb-1">Card Number</p>
                <p className="font-mono">•••• •••• •••• 4242</p>
              </div>
              <CreditCard className="w-8 h-8" />
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs opacity-80 mb-1">Cardholder</p>
                <p className="font-medium">Organization Admin</p>
              </div>
              <div className="text-right">
                <p className="text-xs opacity-80 mb-1">Expires</p>
                <p className="font-medium">12/28</p>
              </div>
            </div>
          </div>
          <button className="w-full px-4 py-3 border border-border text-foreground rounded-lg hover:bg-background transition-colors font-medium">
            Update Payment Method
          </button>
        </div>
      </div>

      {/* Usage Alert */}
      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-medium text-yellow-900 mb-1">
              Approaching Usage Limit
            </h3>
            <p className="text-sm text-yellow-800">
              Your AI credits usage is at 36% of your monthly limit. Consider
              upgrading if you need more capacity.
            </p>
          </div>
          <button className="inline-flex items-center gap-1 text-sm font-medium text-yellow-900 hover:text-yellow-950">
            Upgrade
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
