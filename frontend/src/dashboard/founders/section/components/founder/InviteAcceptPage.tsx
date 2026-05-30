import { useMemo, useState } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import { Copy, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useFounderProfile } from "@/contexts/UserContext";
import { OPPORTUNITIES } from "@/dashboard/_shared/opportunities/data";
import type { Hackathon } from "@/dashboard/_shared/opportunities/types";

type InviteState =
  | { kind: "ok"; hackathon: Hackathon; teamName: string; leaderName: string; openRoles: string[]; memberCount: number; teamSize: number }
  | { kind: "leader"; hackathonId: string; teamId: string; inviteToken: string }
  | { kind: "token-mismatch" }
  | { kind: "not-found" }
  | { kind: "team-full"; hackathonId: string }
  | { kind: "roster-closed" }
  | { kind: "hackathon-missing" };

export default function InviteAcceptPage() {
  const { hackathonId, teamId } = useParams<{ hackathonId: string; teamId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const navigate = useNavigate();
  const { founderProfile, addHackathonMember } = useFounderProfile();

  const state = useMemo<InviteState>(() => {
    if (!hackathonId || !teamId) return { kind: "not-found" };
    const hackathon = OPPORTUNITIES.find(
      (o): o is Hackathon => o.type === "hackathon" && o.id === hackathonId,
    );
    const reg = founderProfile.hackathonRegistrations.find(
      (r) => r.hackathonId === hackathonId && r.teamId === teamId,
    );
    if (!reg) return { kind: "not-found" };
    if (!hackathon) return { kind: "hackathon-missing" };
    if (reg.inviteToken !== token) return { kind: "token-mismatch" };
    if (reg.role === "leader") {
      return { kind: "leader", hackathonId, teamId, inviteToken: reg.inviteToken };
    }
    if (reg.rosterClosed) return { kind: "roster-closed" };
    const memberCount = reg.members.length + 1;
    const teamSize = memberCount + reg.openRoles.length;
    if (memberCount >= teamSize) return { kind: "team-full", hackathonId };
    return {
      kind: "ok",
      hackathon,
      teamName: reg.teamName,
      leaderName: founderProfile.name,
      openRoles: reg.openRoles,
      memberCount,
      teamSize,
    };
  }, [hackathonId, teamId, token, founderProfile.hackathonRegistrations, founderProfile.name]);

  if (state.kind === "leader") {
    const url = `https://techit.ai/h/${state.hackathonId}/team/${state.teamId}?token=${state.inviteToken}`;
    return (
      <Wrapper>
        <h1 className="text-xl font-semibold text-slate-900">You're the leader of this team</h1>
        <p className="text-sm text-slate-600 mt-2">
          Share this invite link with collaborators instead of clicking it yourself.
        </p>
        <div className="flex items-center gap-2 mt-4">
          <input readOnly value={url} className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-700" />
          <button
            type="button"
            onClick={() => { navigator.clipboard.writeText(url); toast.success("Invite link copied"); }}
            className="text-xs font-medium px-3 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-1"
          >
            <Copy className="w-3.5 h-3.5" /> Copy
          </button>
        </div>
        <Link to="/incubation-hub?panel=hackathon" className="inline-block mt-6 text-sm font-medium text-violet-700 hover:underline">
          ← Back to your hackathon panel
        </Link>
      </Wrapper>
    );
  }

  if (state.kind === "ok") {
    return <AcceptForm state={state} teamId={teamId!} addHackathonMember={addHackathonMember} navigate={navigate} />;
  }

  const messages: Record<Exclude<InviteState["kind"], "ok" | "leader">, { title: string; body: React.ReactNode }> = {
    "token-mismatch":     { title: "This invite link is invalid or has expired.", body: <BackLink to="/opportunity-hub" /> },
    "not-found":          { title: "We can't find that team.", body: <p className="text-sm text-slate-600 mt-2">The invite link may be from a hackathon you're not signed in for. <BackLink to="/opportunity-hub" /></p> },
    "team-full":          { title: "This team is already full.", body: <Link to={`/opportunity-hub/${(state as { hackathonId: string }).hackathonId}`} className="inline-block mt-4 text-sm font-medium text-violet-700 hover:underline">Find another team in the hackathon →</Link> },
    "roster-closed":      { title: "This team's roster is closed.", body: <BackLink to="/opportunity-hub" /> },
    "hackathon-missing":  { title: "This hackathon is no longer available.", body: <BackLink to="/opportunity-hub" /> },
  };
  const m = messages[state.kind];
  return (
    <Wrapper>
      <h1 className="text-xl font-semibold text-slate-900">{m.title}</h1>
      {m.body}
    </Wrapper>
  );
}

function AcceptForm({
  state,
  teamId,
  addHackathonMember,
  navigate,
}: {
  state: Extract<InviteState, { kind: "ok" }>;
  teamId: string;
  addHackathonMember: (teamId: string, m: { collaboratorId: string; name: string; role: string; acceptedAt: string }) => void;
  navigate: (path: string) => void;
}) {
  const [selectedRole, setSelectedRole] = useState<string>(state.openRoles[0] ?? "");
  const handleJoin = () => {
    addHackathonMember(teamId, {
      collaboratorId: "mock_self",
      name: "Sample Collaborator",
      role: selectedRole,
      acceptedAt: new Date().toISOString(),
    });
    toast.success(`Joined ${state.teamName} for ${state.hackathon.title}.`);
    navigate("/incubation-hub?panel=hackathon");
  };
  const handleDecline = () => {
    toast.info("Invite declined.");
    navigate("/opportunity-hub");
  };
  return (
    <Wrapper>
      <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">You're invited to join</p>
      <div className="flex items-center gap-3 mt-2">
        <span className="text-3xl" aria-hidden="true">{state.hackathon.poster}</span>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{state.hackathon.title}</h1>
          <p className="text-xs text-slate-500">{state.hackathon.organizer.name} · {state.hackathon.startDate} → {state.hackathon.endDate}</p>
        </div>
      </div>
      <hr className="my-5 border-slate-200" />
      <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Team</p>
      <h2 className="text-base font-semibold text-slate-900 mt-1">{state.teamName}</h2>
      <p className="text-xs text-slate-500 mt-0.5">Led by {state.leaderName}</p>
      <p className="text-xs text-slate-500 mt-3 font-medium uppercase tracking-wider">
        Members ({state.memberCount} of {state.teamSize}) · {state.openRoles.length} role{state.openRoles.length === 1 ? "" : "s"} open
      </p>
      <ul className="mt-2 space-y-1.5">
        {state.openRoles.map((r) => (
          <li key={r} className="text-sm text-slate-700 border border-dashed border-slate-200 rounded-lg px-3 py-2">○ {r}</li>
        ))}
      </ul>
      <hr className="my-5 border-slate-200" />
      <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider mb-1.5">Choose your role</label>
      <select
        value={selectedRole}
        onChange={(e) => setSelectedRole(e.target.value)}
        disabled={state.openRoles.length === 1}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
      >
        {state.openRoles.map((r) => (<option key={r} value={r}>{r}</option>))}
      </select>
      <div className="flex items-center justify-between gap-3 mt-6">
        <button type="button" onClick={handleDecline} className="text-sm font-medium px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">
          Decline
        </button>
        <button type="button" onClick={handleJoin} className="text-sm font-medium px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700">
          Join team & continue →
        </button>
      </div>
    </Wrapper>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-6">
      <div className="max-w-xl mx-auto">
        <Link to="/opportunity-hub" className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Opportunity Hub
        </Link>
        <div className="border border-slate-200 rounded-xl bg-white p-6">{children}</div>
      </div>
    </div>
  );
}

function BackLink({ to }: { to: string }) {
  return (
    <Link to={to} className="inline-block mt-4 text-sm font-medium text-violet-700 hover:underline">
      ← Back to Opportunity Hub
    </Link>
  );
}
