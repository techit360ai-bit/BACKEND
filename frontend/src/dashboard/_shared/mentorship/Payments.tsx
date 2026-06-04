import { Download, DollarSign, TrendingUp, CreditCard, Award } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/dashboard/investors/section/components/ui/card";
import { Badge } from "@/dashboard/investors/section/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/dashboard/investors/section/components/ui/tabs";
import { ACCENT_SOLID, ACCENT_TEXT, NEUTRAL_BTN, statusBadge } from "./theme";

interface Transaction {
  id: string;
  mentee: string;
  amount: number;
  type: "payment" | "equity";
  status: "completed" | "pending" | "processing";
  date: string;
  description: string;
}

interface EquityDeal {
  id: string;
  mentee: string;
  percentage: number;
  valuationCap?: number;
  startDate: string;
  terms: string;
  status: "active" | "vested" | "pending";
}

const mockTransactions: Transaction[] = [
  {
    id: "1",
    mentee: "Sarah Johnson",
    amount: 2000,
    type: "payment",
    status: "completed",
    date: "2026-04-01",
    description: "Monthly mentorship fee - April 2026",
  },
  {
    id: "2",
    mentee: "Michael Chen",
    amount: 500,
    type: "payment",
    status: "completed",
    date: "2026-04-05",
    description: "Task completion reward",
  },
  {
    id: "3",
    mentee: "Emma Williams",
    amount: 2000,
    type: "payment",
    status: "processing",
    date: "2026-04-10",
    description: "Monthly mentorship fee - April 2026",
  },
  {
    id: "4",
    mentee: "David Park",
    amount: 1500,
    type: "payment",
    status: "pending",
    date: "2026-04-15",
    description: "Milestone payment",
  },
];

const mockEquityDeals: EquityDeal[] = [
  {
    id: "1",
    mentee: "Sarah Johnson",
    percentage: 5,
    valuationCap: 1000000,
    startDate: "2026-01-15",
    terms: "4-year vesting with 1-year cliff",
    status: "active",
  },
  {
    id: "2",
    mentee: "James Wilson",
    percentage: 3.5,
    valuationCap: 2000000,
    startDate: "2026-02-01",
    terms: "3-year vesting, monthly",
    status: "active",
  },
  {
    id: "3",
    mentee: "Lisa Anderson",
    percentage: 2,
    startDate: "2026-03-10",
    terms: "2-year vesting, quarterly",
    status: "pending",
  },
];

export function Payments() {
  const totalEarnings = mockTransactions
    .filter((t) => t.status === "completed")
    .reduce((sum, t) => sum + t.amount, 0);

  const pendingPayments = mockTransactions
    .filter((t) => t.status === "pending" || t.status === "processing")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalEquity = mockEquityDeals.reduce((sum, deal) => sum + deal.percentage, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 text-3xl">Payments &amp; Equity</h1>
        <p className="text-muted-foreground">Track your earnings and equity agreements</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Earnings</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">${totalEarnings.toLocaleString()}</div>
            <p className="mt-1 text-xs text-muted-foreground">All-time completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
              <CreditCard className={`h-4 w-4 ${ACCENT_TEXT}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">${pendingPayments.toLocaleString()}</div>
            <p className="mt-1 text-xs text-muted-foreground">To be processed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Equity</CardTitle>
              <Award className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{totalEquity}%</div>
            <p className="mt-1 text-xs text-muted-foreground">Across {mockEquityDeals.length} deals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
              <TrendingUp className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">$4,500</div>
            <p className="mt-1 text-xs text-green-600 dark:text-green-400">+18% from last month</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="transactions" className="w-full">
        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="equity">Equity Deals</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl">Transaction History</h2>
            <button className={`flex items-center gap-2 rounded-lg px-4 py-2 ${NEUTRAL_BTN}`}>
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-border bg-muted/50">
                    <tr>
                      {["Date", "Mentee", "Description", "Amount", "Status"].map((h) => (
                        <th
                          key={h}
                          className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {mockTransactions.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-accent">
                        <td className="whitespace-nowrap px-6 py-4 text-sm">
                          {new Date(transaction.date).toLocaleDateString()}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium">
                          {transaction.mentee}
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {transaction.description}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold">
                          ${transaction.amount.toLocaleString()}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <Badge className={statusBadge(transaction.status)}>
                            {transaction.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Equity Deals Tab */}
        <TabsContent value="equity" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl">Equity Agreements</h2>
            <button className="rounded-lg bg-purple-600 px-4 py-2 text-white transition-colors hover:bg-purple-700">
              Create Agreement
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {mockEquityDeals.map((deal) => (
              <Card key={deal.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{deal.mentee}</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Started: {new Date(deal.startDate).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge className={statusBadge(deal.status)}>{deal.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg bg-purple-50 p-3 dark:bg-purple-500/10">
                    <span className="text-sm font-medium">Equity Stake</span>
                    <span className="text-xl font-semibold text-purple-600 dark:text-purple-400">
                      {deal.percentage}%
                    </span>
                  </div>

                  {deal.valuationCap && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Valuation Cap</span>
                      <span className="font-medium">${(deal.valuationCap / 1000000).toFixed(1)}M</span>
                    </div>
                  )}

                  <div>
                    <span className="text-sm text-muted-foreground">Vesting Terms</span>
                    <p className="mt-1 text-sm font-medium">{deal.terms}</p>
                  </div>

                  <div className="border-t border-border pt-2">
                    <button className={`w-full rounded-lg px-4 py-2 text-sm ${NEUTRAL_BTN}`}>
                      View Agreement
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10">
            <CardContent className="p-4">
              <p className="text-sm text-amber-800 dark:text-amber-300">
                <strong>Legal Notice:</strong> All equity agreements should be reviewed by legal
                counsel. Ensure proper documentation including vesting schedules, cliff periods, and
                termination clauses. TECHIT provides templates but does not provide legal advice.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl">Invoices</h2>
            <button className={`rounded-lg px-4 py-2 transition-colors ${ACCENT_SOLID}`}>
              Create Invoice
            </button>
          </div>

          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">No invoices generated yet</p>
              <button className={`mt-4 px-4 py-2 ${ACCENT_TEXT}`}>
                Generate your first invoice
              </button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
