import { createContext, useContext, useState, useMemo, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

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

export type CollaboratorDiscipline =
  | "Engineering"
  | "Design"
  | "Product"
  | "Data & ML"
  | "DevOps"
  | "Security"
  | "Marketing"
  | "Research";

export type Role = "founder" | "collaborator" | "investor" | "org";

export interface NotificationPrefs {
  opportunities: { email: boolean; inApp: boolean };
  deadlines:     { email: boolean; inApp: boolean };
  payments:      { email: boolean; inApp: boolean };
  equityEvents:  { email: boolean; inApp: boolean };
  quietHours:    "off" | "10pm-8am" | "weekends";
}

export interface CollaboratorProfile {
  // Step 1 — Identity
  name: string;
  title: string;
  location: string;
  yearsExperience: number;
  headline: string;
  avatarUrl: string;

  // Step 2 — Discipline & sub-skills
  discipline: CollaboratorDiscipline | "";
  subSkills: string[];

  // Step 3 — Tech stack
  techStack: string[];

  // Step 4 — Availability
  weeklyHours: number;
  timezone: string;
  earliestStart: "this-week" | "2-weeks" | "1-month";
  commitmentStyle: "deep" | "parallel" | "many";

  // Step 5 — Mission: Building for Equity
  equityPreference: number;
  minCashFloor: number;
  vestingComfort: "standard" | "1y-cliff-4y" | "custom";

  // Step 6 — Portfolio & goals
  links: { github: string; linkedin: string; portfolio: string; twitter: string };
  whyHere: string;
  pinnedWork: string[];

  // Status / settings
  onboardingComplete: boolean;
  notifications: NotificationPrefs;
}

interface UserContextType {
  investorProfile: InvestorProfile;
  updateInvestorProfile: (updates: Partial<InvestorProfile>) => void;
  orgProfile: OrgProfile;
  updateOrgProfile: (updates: Partial<OrgProfile>) => void;
  collaboratorProfile: CollaboratorProfile;
  updateCollaboratorProfile: (updates: Partial<CollaboratorProfile>) => void;
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

  const [collaboratorProfile, setCollaboratorProfile] = useState<CollaboratorProfile>({
    name: "Alex Chen",
    title: "Senior Frontend Engineer",
    location: "Lagos, Nigeria",
    yearsExperience: 7,
    headline: "I ship product-grade React systems quickly.",
    avatarUrl: "",
    discipline: "Engineering",
    subSkills: ["React", "TypeScript", "Node.js", "System design", "Performance"],
    techStack: ["React", "Next.js", "Postgres", "Vercel", "Tailwind", "tRPC"],
    weeklyHours: 20,
    timezone: "WAT",
    earliestStart: "this-week",
    commitmentStyle: "parallel",
    equityPreference: 65,
    minCashFloor: 2000,
    vestingComfort: "standard",
    links: {
      github: "github.com/alexchen",
      linkedin: "linkedin.com/in/alexchen",
      portfolio: "alexchen.dev",
      twitter: "@alexchen",
    },
    whyHere: "A product that becomes someone's daily tool, with skin in the game.",
    pinnedWork: [],
    onboardingComplete: true,
    notifications: {
      opportunities: { email: true, inApp: true },
      deadlines:     { email: true, inApp: true },
      payments:      { email: true, inApp: true },
      equityEvents:  { email: true, inApp: true },
      quietHours:    "off",
    },
  });

  /**
   * Shallow merge — for nested fields like `notifications` or `links`, callers must spread the
   * existing sub-object themselves, e.g. `updateCollaboratorProfile({ notifications: { ...prev.notifications, quietHours: "weekends" } })`.
   */
  const updateCollaboratorProfile = (updates: Partial<CollaboratorProfile>) => {
    setCollaboratorProfile((prev) => ({ ...prev, ...updates }));
  };

  return (
    <UserContext.Provider
      value={{
        investorProfile,
        updateInvestorProfile,
        orgProfile,
        updateOrgProfile,
        collaboratorProfile,
        updateCollaboratorProfile,
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

// Convenience hook for collaborator profile
export function useCollaboratorProfile() {
  const { collaboratorProfile, updateCollaboratorProfile } = useUser();
  return { collaboratorProfile, updateCollaboratorProfile };
}

export function useActiveRoles(): { activeRoles: Set<Role>; currentRole: Role } {
  const { collaboratorProfile, investorProfile, orgProfile } = useUser();
  const location = useLocation();

  const activeRoles = useMemo(() => {
    const s = new Set<Role>(["founder"]);
    if (collaboratorProfile.onboardingComplete)             s.add("collaborator");
    if (investorProfile.industries.length > 0)              s.add("investor");
    if (orgProfile.verificationStatus !== "unverified")     s.add("org");
    return s;
  }, [collaboratorProfile.onboardingComplete, investorProfile.industries.length, orgProfile.verificationStatus]);

  const path = location.pathname;
  let currentRole: Role = "founder";
  if (path.startsWith("/collaborator")) currentRole = "collaborator";
  else if (path.startsWith("/investor"))    currentRole = "investor";
  else if (path.startsWith("/org"))         currentRole = "org";

  return { activeRoles, currentRole };
}
