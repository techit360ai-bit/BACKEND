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

export type FounderStage = "Idea" | "MVP" | "Beta" | "Launch" | "Growth";
export type FounderExperience = "first-time" | "some-experience" | "serial";
export type LaunchStatus = "pre-launch" | "private-beta" | "public";
export type CompModel = "equity-heavy" | "cash-equity-mix" | "cash-heavy";
export type OwnershipPhilosophy = "equity-day-one" | "cash-first-equity-later" | "custom";
export type OpenRole =
  | "Frontend Engineer" | "Backend Engineer" | "Full-stack Engineer"
  | "ML Engineer" | "Designer (Product)" | "Designer (Visual)"
  | "Product Manager" | "Data Scientist" | "DevOps Engineer"
  | "Growth Marketer" | "Content / Copy" | "Founder Associate";

export interface FounderVerification {
  twitter:      { handle: string;   verified: boolean };
  linkedin:     { url: string;      verified: boolean };
  personalSite: { url: string;      verified: boolean };
  github:       { username: string; verified: boolean };
  nin: {
    country: string;
    docType: "nin" | "passport" | "driver-license";
    docNumber: string;
    status: "unverified" | "pending" | "verified";
  };
}

export interface FounderNotificationPrefs {
  applications:  { email: boolean; inApp: boolean };
  investors:     { email: boolean; inApp: boolean };
  workspace:     { email: boolean; inApp: boolean };
  opportunities: { email: boolean; inApp: boolean };
  quietHours:    "off" | "10pm-8am" | "weekends";
}

export interface FounderProfile {
  // Step 1
  name: string;
  title: string;
  location: string;
  yearsBuilding: number;
  founderType: FounderExperience;
  headline: string;
  avatarUrl: string;
  // Step 2
  startupName: string;
  oneLiner: string;
  stage: FounderStage;
  industries: string[];
  foundingYear: number;
  website: string;
  logoEmoji: string;
  // Step 3
  currentTeamSize: number;
  openRoles: OpenRole[];
  compensationOffered: CompModel;
  equityRangeMin: number;
  equityRangeMax: number;
  // Step 4
  launchStatus: LaunchStatus;
  users: number;
  revenueMonthly: number;
  fundingRaised: number;
  leadInvestor: string;
  nextMilestone: string;
  // Step 5
  whyBuilding: string;
  winningIn3Years: string;
  unfairAdvantage: string;
  ownershipPhilosophy: OwnershipPhilosophy;
  // Step 6
  links: { github: string; linkedin: string; twitter: string; personal: string };
  needsFromTechIT: string[];
  pinnedWork: string[];
  // Status
  onboardingComplete: boolean;
  verification: FounderVerification;
  notifications: FounderNotificationPrefs;
}

interface UserContextType {
  investorProfile: InvestorProfile;
  updateInvestorProfile: (updates: Partial<InvestorProfile>) => void;
  orgProfile: OrgProfile;
  updateOrgProfile: (updates: Partial<OrgProfile>) => void;
  collaboratorProfile: CollaboratorProfile;
  updateCollaboratorProfile: (updates: Partial<CollaboratorProfile>) => void;
  founderProfile: FounderProfile;
  updateFounderProfile: (updates: Partial<FounderProfile>) => void;
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

  const [founderProfile, setFounderProfile] = useState<FounderProfile>({
    name: "Sarah Chen",
    title: "Founder & CEO",
    location: "Lagos, Nigeria",
    yearsBuilding: 5,
    founderType: "first-time",
    headline: "Building the operating system for African SMEs.",
    avatarUrl: "",
    startupName: "AI Task Manager",
    oneLiner: "AI that turns Slack chaos into a Kanban board.",
    stage: "MVP",
    industries: ["AI/ML", "SaaS"],
    foundingYear: 2026,
    website: "techit.ai",
    logoEmoji: "🧠",
    currentTeamSize: 2,
    openRoles: ["Frontend Engineer", "ML Engineer", "Designer (Product)"],
    compensationOffered: "equity-heavy",
    equityRangeMin: 0.5,
    equityRangeMax: 2.5,
    launchStatus: "private-beta",
    users: 240,
    revenueMonthly: 0,
    fundingRaised: 0,
    leadInvestor: "",
    nextMilestone: "Hit 1,000 active users by August.",
    whyBuilding: "I watched my mother's bakery drown in WhatsApp orders. There's nothing built for African SMEs that talks the way they actually work.",
    winningIn3Years: "Default SaaS for any African SME under 50 employees. $10M ARR.",
    unfairAdvantage: "I ran SME ops for 4 years. I know the broken workflows by name.",
    ownershipPhilosophy: "equity-day-one",
    links: {
      github: "github.com/sarahchen",
      linkedin: "linkedin.com/in/sarahchen",
      twitter: "@sarahchen",
      personal: "sarahchen.com",
    },
    needsFromTechIT: ["Find collaborators", "Customer interviews"],
    pinnedWork: [],
    onboardingComplete: true,
    verification: {
      twitter:      { handle: "@sarahchen", verified: false },
      linkedin:     { url: "linkedin.com/in/sarahchen", verified: true },
      personalSite: { url: "sarahchen.com", verified: false },
      github:       { username: "sarahchen", verified: true },
      nin: { country: "Nigeria", docType: "nin", docNumber: "", status: "unverified" },
    },
    notifications: {
      applications:  { email: true, inApp: true },
      investors:     { email: true, inApp: true },
      workspace:     { email: false, inApp: true },
      opportunities: { email: true, inApp: true },
      quietHours:    "off",
    },
  });

  /**
   * Shallow merge — for nested fields like `verification`, `notifications`, or `links`,
   * callers must spread the existing sub-object themselves,
   * e.g. updateFounderProfile({ notifications: { ...prev.notifications, quietHours: "weekends" } }).
   */
  const updateFounderProfile = (updates: Partial<FounderProfile>) => {
    setFounderProfile((prev) => ({ ...prev, ...updates }));
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
        founderProfile,
        updateFounderProfile,
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
  const { founderProfile, collaboratorProfile, investorProfile, orgProfile } = useUser();
  const location = useLocation();

  const activeRoles = useMemo(() => {
    const s = new Set<Role>();
    if (founderProfile.onboardingComplete)              s.add("founder");
    if (collaboratorProfile.onboardingComplete)         s.add("collaborator");
    if (investorProfile.industries.length > 0)          s.add("investor");
    if (orgProfile.verificationStatus !== "unverified") s.add("org");
    return s;
  }, [founderProfile.onboardingComplete, collaboratorProfile.onboardingComplete, investorProfile.industries.length, orgProfile.verificationStatus]);

  const path = location.pathname;
  let currentRole: Role = "founder";
  if (path.startsWith("/collaborator")) currentRole = "collaborator";
  else if (path.startsWith("/investor")) currentRole = "investor";
  else if (path.startsWith("/org"))      currentRole = "org";
  // everything else (/dashboard, /incubation-hub, /chat, /matchresults, /founder/*) → founder

  return { activeRoles, currentRole };
}

export function useFounderProfile() {
  const { founderProfile, updateFounderProfile } = useUser();
  return { founderProfile, updateFounderProfile };
}
