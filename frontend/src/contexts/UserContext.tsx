import { createContext, useContext, useState, type ReactNode } from "react";

export interface PortfolioCompany {
  id: string;
  name: string;
  stage: string;
  outcome: "Active" | "Exited" | "Failed" | "Acquired";
}

export interface InvestorProfile {
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

export type OrgVerificationStatus = "unverified" | "pending" | "verified";

export interface OrgTeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

export type OrgPlan = "free" | "growth" | "enterprise";

export interface OrgProfile {
  // Step 1 — Identity
  orgName: string;
  orgType: string;
  location: string;
  registrationNumber: string;
  foundingYear: number;
  website: string;

  // Step 2 — Verification
  verificationStatus: OrgVerificationStatus;
  verificationDocs: string[]; // file names (mock — no real upload)
  businessEmailDomain: string;

  // Step 3 — Programmes & Focus
  programmes: string[]; // e.g. ["Hackathons", "Accelerator", "Grants", "Mentorship"]
  sectors: string[];
  geographies: string[];

  // Step 4 — Team
  teamMembers: OrgTeamMember[];

  // Step 5 — Plan
  plan: OrgPlan;
}

interface UserContextType {
  investorProfile: InvestorProfile;
  updateInvestorProfile: (updates: Partial<InvestorProfile>) => void;
  orgProfile: OrgProfile;
  updateOrgProfile: (updates: Partial<OrgProfile>) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [investorProfile, setInvestorProfile] = useState<InvestorProfile>({
    investorType: "Institutional", // Default value so dashboard is accessible
    location: "North America",
    fundSize: "$10M - $50M",
    yearsInvesting: 1,
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

  const updateInvestorProfile = (updates: Partial<InvestorProfile>) => {
    setInvestorProfile((prev) => ({ ...prev, ...updates }));
  };

  const [orgProfile, setOrgProfile] = useState<OrgProfile>({
    orgName: "TechIT Innovation Hub",
    orgType: "Innovation Hub",
    location: "Lagos, Nigeria",
    registrationNumber: "",
    foundingYear: 2022,
    website: "",
    verificationStatus: "unverified",
    verificationDocs: [],
    businessEmailDomain: "",
    programmes: ["Hackathons", "Mentorship"],
    sectors: ["AI", "FinTech"],
    geographies: ["West Africa"],
    teamMembers: [],
    plan: "growth",
  });

  const updateOrgProfile = (updates: Partial<OrgProfile>) => {
    setOrgProfile((prev) => ({ ...prev, ...updates }));
  };

  return (
    <UserContext.Provider
      value={{
        investorProfile,
        updateInvestorProfile,
        orgProfile,
        updateOrgProfile,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}

// Convenience hook for investor profile
export function useInvestorProfile() {
  const { investorProfile, updateInvestorProfile } = useUser();
  return { investorProfile, updateInvestorProfile };
}

// Convenience hook for organization profile
export function useOrgProfile() {
  const { orgProfile, updateOrgProfile } = useUser();
  return { orgProfile, updateOrgProfile };
}
