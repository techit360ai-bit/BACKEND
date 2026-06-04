import { Link } from "react-router-dom";
import { Lock, ArrowLeft } from "lucide-react";
import { useActiveRoles } from "@/contexts/UserContext";
import { canAccessMentorship, eligibleRolesSummary, type MentorRole } from "./access";
import { MentorshipLayout } from "./MentorshipLayout";

/**
 * Access boundary for the Mentorship Hub.
 *
 * Today only investors get in (see `access.ts`), but the gate is role-driven so
 * industry leaders, veteran founders, and orgs can be onboarded later by
 * flipping a policy flag — no change needed here. When allowed, it renders the
 * full hub; otherwise a themed panel explaining who can mentor.
 */
export function MentorshipGate() {
  const { currentRole } = useActiveRoles();
  // currentRole is one of the app roles ("founder" | "collaborator" | "investor" | "org").
  // Map "org" → "organization" to match the mentorship policy's role names.
  const role: MentorRole = currentRole === "org" ? "organization" : currentRole;
  const access = canAccessMentorship({ role });

  if (access.allowed) {
    return <MentorshipLayout />;
  }

  const liveRoles = eligibleRolesSummary().filter((r) => r.live);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <h1 className="mb-2 text-xl font-semibold">Mentorship Hub</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          {access.reason ?? "Mentorship access isn't open to your role yet."}
        </p>

        <div className="mb-6 rounded-lg bg-muted/50 p-4 text-left">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Who can mentor today
          </p>
          <ul className="space-y-1 text-sm">
            {liveRoles.map((r) => (
              <li key={r.role} className="flex gap-2">
                <span className="font-medium capitalize">{r.role}:</span>
                <span className="text-muted-foreground">{r.rationale}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            More roles (industry leaders, veteran founders, organizations) can apply in a future
            release.
          </p>
        </div>

        <Link
          to="/investor"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Investor
        </Link>
      </div>
    </div>
  );
}
