import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, UserCircle, Settings as SettingsIcon, LogOut, Check } from "lucide-react";
import { toast } from "sonner";
import { useUser, useActiveRoles, type Role } from "@/contexts/UserContext";
import { roleDashboardPath, roleOnboardingPath } from "./roleRoutes";

const roleLabel: Record<Role, string> = {
  founder: "Founder",
  collaborator: "Collaborator",
  investor: "Investor",
  org: "Organization",
};

export function TopBarRoleMenu() {
  const navigate = useNavigate();
  const { collaboratorProfile } = useUser();
  const { activeRoles, currentRole } = useActiveRoles();
  const [open, setOpen] = useState(false);

  const initials = collaboratorProfile.name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);

  const handleRoleClick = (role: Role) => {
    setOpen(false);
    if (activeRoles.has(role)) navigate(roleDashboardPath[role]);
    else                       navigate(roleOnboardingPath[role]);
  };

  const handleLogout = () => {
    setOpen(false);
    toast("Signed out (mock)");
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-amber-500 text-slate-900 font-semibold flex items-center justify-center text-sm tabular-nums">
          {initials}
        </div>
        <div className="text-left hidden md:block">
          <div className="text-sm font-medium text-slate-900">{collaboratorProfile.name}</div>
          <div className="text-xs text-slate-500">{roleLabel[currentRole]} · {collaboratorProfile.discipline}</div>
        </div>
        <ChevronDown className="w-4 h-4 text-slate-500" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="font-semibold text-slate-900">{collaboratorProfile.name}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {roleLabel[currentRole]} · {collaboratorProfile.discipline} · {collaboratorProfile.subSkills.slice(0, 2).join(" · ")}
              </div>
            </div>

            <button type="button" onClick={() => { setOpen(false); navigate("/collaborator/profile"); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
              <UserCircle className="w-4 h-4" /> View profile
            </button>
            <button type="button" onClick={() => { setOpen(false); navigate("/collaborator/settings"); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
              <SettingsIcon className="w-4 h-4" /> Settings
            </button>

            <div className="border-t border-slate-100 px-4 py-2">
              <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Switch role</div>
            </div>

            {(["founder", "collaborator", "investor", "org"] as Role[]).map((role) => {
              const active = activeRoles.has(role);
              const isCurrent = role === currentRole;
              return (
                <button key={role} type="button" onClick={() => handleRoleClick(role)}
                  disabled={isCurrent}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-default">
                  <span className="text-slate-700">{roleLabel[role]}</span>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    {isCurrent ? <>✓ current</> : active ? <><Check className="w-3 h-3" /> active</> : <>Activate</>}
                  </span>
                </button>
              );
            })}

            <button type="button" onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 border-t border-slate-100">
              <LogOut className="w-4 h-4" /> Log out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
