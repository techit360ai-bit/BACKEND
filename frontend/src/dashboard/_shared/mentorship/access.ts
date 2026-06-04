// Access control for the Mentorship Hub.
//
// Today the hub lives in the investor section, but it is built so that other
// roles — industry leaders, veteran founders, domain experts — can be granted
// access in the future based on criteria (years of experience, verification,
// reputation, etc.). Centralizing the rule here means every consumer asks the
// same question and we only change one place when the criteria expand.

export type MentorRole =
  | "investor"
  | "founder"
  | "collaborator"
  | "industry-leader"
  | "organization";

/** Minimal shape the gate needs — callers pass whatever profile they have. */
export interface MentorAccessInput {
  role: MentorRole;
  yearsExperience?: number;
  verified?: boolean;
  reputationScore?: number;
}

/** Per-role policy. Roles absent from this map have no access yet. */
interface RolePolicy {
  /** Access is allowed at all for this role. */
  enabled: boolean;
  /** Optional future criteria; undefined = no threshold. */
  minYearsExperience?: number;
  requiresVerified?: boolean;
  minReputationScore?: number;
  /** Why this role can mentor — shown in UI copy. */
  rationale: string;
}

// PRIMARY: investors have access now, no extra criteria.
// FUTURE: flip `enabled` to true (and tune thresholds) to onboard more roles.
export const MENTOR_ROLE_POLICY: Record<MentorRole, RolePolicy> = {
  investor: {
    enabled: true,
    rationale: "Investors mentor founders on capital strategy and growth.",
  },
  "industry-leader": {
    enabled: false,
    minYearsExperience: 10,
    requiresVerified: true,
    rationale: "Seasoned industry leaders with deep domain experience.",
  },
  founder: {
    enabled: false,
    minYearsExperience: 8,
    requiresVerified: true,
    rationale: "Veteran founders who have built and scaled companies.",
  },
  organization: {
    enabled: false,
    requiresVerified: true,
    rationale: "Verified organizations running structured programs.",
  },
  collaborator: {
    enabled: false,
    minYearsExperience: 10,
    rationale: "Highly experienced collaborators acting as technical mentors.",
  },
};

export interface AccessResult {
  allowed: boolean;
  reason?: string;
}

/**
 * The single source of truth for "can this user enter the Mentorship Hub?".
 * Investor → allowed today. Other roles → gated behind future criteria.
 */
export function canAccessMentorship(input: MentorAccessInput): AccessResult {
  const policy = MENTOR_ROLE_POLICY[input.role];
  if (!policy || !policy.enabled) {
    return { allowed: false, reason: "Mentorship access isn't open to this role yet." };
  }
  if (policy.minYearsExperience !== undefined) {
    if ((input.yearsExperience ?? 0) < policy.minYearsExperience) {
      return {
        allowed: false,
        reason: `Requires ${policy.minYearsExperience}+ years of experience.`,
      };
    }
  }
  if (policy.requiresVerified && !input.verified) {
    return { allowed: false, reason: "Requires a verified profile." };
  }
  if (policy.minReputationScore !== undefined) {
    if ((input.reputationScore ?? 0) < policy.minReputationScore) {
      return {
        allowed: false,
        reason: `Requires a reputation score of ${policy.minReputationScore}+.`,
      };
    }
  }
  return { allowed: true };
}

/** Roles that currently have (or could soon have) mentor access — for UI hints. */
export function eligibleRolesSummary(): { role: MentorRole; live: boolean; rationale: string }[] {
  return (Object.keys(MENTOR_ROLE_POLICY) as MentorRole[]).map((role) => ({
    role,
    live: MENTOR_ROLE_POLICY[role].enabled,
    rationale: MENTOR_ROLE_POLICY[role].rationale,
  }));
}
