import type { Role } from "@/contexts/UserContext";

export const roleDashboardPath: Record<Role, string> = {
  founder: "/dashboard",
  collaborator: "/collaborator/dashboard",
  investor: "/investor/dashboard",
  org: "/org/dashboard",
};

export const roleOnboardingPath: Record<Role, string> = {
  founder: "/founder/setup",
  collaborator: "/collaborator/onboarding/step-1",
  investor: "/investor/onboarding/step-1",
  org: "/org/onboarding/step-1",
};
