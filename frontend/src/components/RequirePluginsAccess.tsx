import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useActiveRoles } from "@/contexts/UserContext";

/**
 * Route guard for the Plugins & MCP control panel.
 *
 * The page can invoke tools and APPROVE destructive actions, so it is an
 * owner/admin-level surface — not for every user. We restrict it to the
 * workspace-owner personas the app actually uses today: `founder` and `org`.
 * Collaborators and investors are redirected to the home page.
 *
 * NOTE: this app has no real login wired yet (AuthProvider isn't mounted and the
 * backend has no /auth endpoints), so we gate on `useActiveRoles()` — the same
 * persona model the rest of the app uses. When real auth + RBAC
 * (Viewer/Editor/Admin/Owner) lands, tighten the `allowed` check below to
 * `profile.role === 'admin' || profile.role === 'owner'`.
 */
export function RequirePluginsAccess({ children }: { children: ReactNode }) {
  const { activeRoles } = useActiveRoles();
  const allowed = activeRoles.has("founder") || activeRoles.has("org");

  if (!allowed) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
