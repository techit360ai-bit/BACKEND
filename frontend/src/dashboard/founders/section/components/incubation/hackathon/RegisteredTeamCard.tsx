import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Copy, Check, X, Calendar } from "lucide-react";
import { toast } from "sonner";
import type { Hackathon } from "@/dashboard/_shared/opportunities/types";
import type { HackathonRegistration } from "@/contexts/UserContext";
import { useFounderProfile } from "@/contexts/UserContext";
import { computeMomentum, momentumColor } from "@/dashboard/_shared/hackathon/momentum";

const NEXT_ACTION_CTA: Record<
  ReturnType<typeof computeMomentum>["nextAction"],
  { label: string; stage: "brief" | "build" }
> = {
  "submit-brief": { label: "Submit brief →", stage: "brief" },
  "log-check-in": { label: "Log check-in →", stage: "build" },
  "build":        { label: "Open team", stage: "build" },
  "complete":     { label: "Open team", stage: "build" },
};

interface Props {
  registration: HackathonRegistration;
  hackathon: Hackathon;
}

function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - new Date().getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function inviteUrl(reg: HackathonRegistration): string {
  return `https://techit.ai/h/${reg.hackathonId}/team/${reg.teamId}?token=${reg.inviteToken}`;
}

export function RegisteredTeamCard({ registration, hackathon }: Props) {
  const navigate = useNavigate();
  const { updateHackathonRegistration } = useFounderProfile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const days = daysUntil(hackathon.startDate);
  const memberCount = registration.members.length + 1; // +1 for the leader
  const teamSize = memberCount + registration.openRoles.length;

  const momentum = useMemo(() => computeMomentum(registration, Date.now()), [registration]);
  const momColor = momentumColor(momentum.score);
  const cta = NEXT_ACTION_CTA[momentum.nextAction];

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteUrl(registration));
    setCopied(true);
    toast.success("Invite link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleRoster = () => {
    updateHackathonRegistration(registration.teamId, {
      rosterClosed: !registration.rosterClosed,
    });
    toast.success(registration.rosterClosed ? "Roster reopened" : "Roster closed");
  };

  return (
    <>
      <div className="border border-slate-200 rounded-xl p-5 bg-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <span className="text-2xl shrink-0" aria-hidden="true">{hackathon.poster}</span>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">{hackathon.title}</p>
              <h3 className="text-base font-semibold text-slate-900 truncate">{registration.teamName}</h3>
              <div className="flex items-center gap-3 text-xs text-slate-600 mt-1.5">
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{memberCount} of {teamSize}</span>
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Starts in {days} days</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{momentum.nextActionLabel}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className={`text-2xl font-bold leading-none ${momColor.text}`}>{momentum.score}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">Momentum</p>
            <div className="h-1.5 w-16 rounded-full bg-slate-100 mt-1">
              <div className={`h-1.5 rounded-full ${momColor.bar}`} style={{ width: `${momentum.score}%` }} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            Manage team →
          </button>
          <button
            type="button"
            onClick={() => navigate(`/matches?hackathon=${registration.hackathonId}`)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            Find collaborators →
          </button>
          <button
            type="button"
            onClick={() => navigate(`/incubation-hub?panel=hackathon&stage=${cta.stage}`)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700"
          >
            {cta.label}
          </button>
        </div>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-slate-900/40" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <div className="w-full max-w-md bg-white shadow-xl overflow-y-auto" role="dialog" aria-label="Manage team">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Manage team</h2>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-1 rounded hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">{hackathon.title}</p>
                <h3 className="text-lg font-semibold text-slate-900">{registration.teamName}</h3>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-700 uppercase tracking-wider mb-2">Members ({memberCount} of {teamSize})</p>
                <ul className="space-y-2">
                  <li className="flex items-center justify-between text-sm border border-slate-200 rounded-lg px-3 py-2">
                    <span className="text-slate-900">You · Leader</span>
                  </li>
                  {registration.members.map((m) => (
                    <li key={m.collaboratorId} className="flex items-center justify-between text-sm border border-slate-200 rounded-lg px-3 py-2">
                      <span className="text-slate-900">{m.name} · {m.role}</span>
                    </li>
                  ))}
                  {registration.openRoles.map((r) => (
                    <li key={r} className="flex items-center justify-between text-sm border border-dashed border-slate-300 rounded-lg px-3 py-2 text-slate-500">
                      <span>Open: {r}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-700 uppercase tracking-wider mb-2">Invite link</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={inviteUrl(registration)}
                    className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 text-slate-700 font-mono truncate"
                    aria-label="Invite link"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="text-xs font-medium px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
              <div>
                <button
                  type="button"
                  onClick={handleToggleRoster}
                  className="text-xs font-medium px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  {registration.rosterClosed ? "Reopen roster" : "Close roster"}
                </button>
                <p className="text-xs text-slate-500 mt-1.5">
                  {registration.rosterClosed
                    ? "Roster is closed. Invite link shows 'team is full' to visitors."
                    : "Closing the roster prevents new members from joining via the invite link."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
