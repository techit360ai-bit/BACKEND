import { createContext, useContext, useState, type ReactNode } from "react";

export interface PortfolioCompany {
  id: string;
  name: string;
  stage: string;
  outcome: "Active" | "Exited" | "Failed" | "Acquired";
}

export interface InvestorOnboardingData {
  // Step 1
  investorType: string;
  location: string;
  fundSize: string;
  yearsInvesting: number;

  // Step 2
  industries: string[];
  stage: string;
  checkSize: string;

  // Step 3
  portfolio: PortfolioCompany[];

  // Step 4
  riskAppetite: string;

  // Step 5
  dashboardMetrics: string[];
}

interface InvestorOnboardingContextType {
  data: InvestorOnboardingData;
  updateData: (updates: Partial<InvestorOnboardingData>) => void;
}

const InvestorOnboardingContext = createContext<
  InvestorOnboardingContextType | undefined
>(undefined);

export function InvestorOnboardingProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [data, setData] = useState<InvestorOnboardingData>({
    investorType: "",
    location: "",
    fundSize: "",
    yearsInvesting: 0,
    industries: [],
    stage: "",
    checkSize: "",
    portfolio: [],
    riskAppetite: "Validated Prototypes",
    dashboardMetrics: [
      "Execution Velocity",
      "Market Readiness",
      "Revenue Traction",
      "Beta Retention",
    ],
  });

  const updateData = (updates: Partial<InvestorOnboardingData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  return (
    <InvestorOnboardingContext.Provider value={{ data, updateData }}>
      {children}
    </InvestorOnboardingContext.Provider>
  );
}

export function useInvestorOnboarding() {
  const context = useContext(InvestorOnboardingContext);
  if (!context) {
    throw new Error(
      "useInvestorOnboarding must be used within an InvestorOnboardingProvider",
    );
  }
  return context;
}
