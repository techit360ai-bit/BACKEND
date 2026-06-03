import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Copy, Check, Mail, Send, ArrowLeft, Trophy } from "lucide-react";
import { toast } from "sonner";
import { OPPORTUNITIES } from "@/dashboard/_shared/opportunities/data";
import type { Hackathon } from "@/dashboard/_shared/opportunities/types";
import { useFounderProfile, type OpenRole } from "@/contexts/UserContext";

const BASE32_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

function randomToken(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += BASE32_ALPHABET[bytes[i] % 32];
  return out;
}

function isHackathon(o: { type: string }): o is Hackathon {
  return o.type === "hackathon";
}

export function RegisterStage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { founderProfile, registerForHackathon } = useFounderProfile();

  const allHackathons = useMemo(() => OPPORTUNITIES.filter(isHackathon), []);
  const initialHackathonId = searchParams.get("h") ?? "";
  const [hackathonId, setHackathonId] = useState(initialHackathonId);
  const hackathon = useMemo(
    () => allHackathons.find((h) => h.id === hackathonId),
    [allHackathons, hackathonId],
  );

  const [teamName, setTeamName] = useState("");
  const [teamSize, setTeamSize] = useState(3);
  const [selectedRoles, setSelectedRoles] = useState<OpenRole[]>(founderProfile.openRoles);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<{
    teamId: string;
    inviteToken: string;
    teamName: string;
    hackathonId: string;
  } | null>(null);

  if (!hackathon && !success) {
    return (
      <div className="border border-amber-200 bg-amber-50 rounded-xl p-5">
        <p className="text-sm text-amber-900">Pick a hackathon to register for.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          {allHackathons.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => setHackathonId(h.id)}
              className="text-left border border-border rounded-lg p-3 bg-background hover:border-violet-300"
            >
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Hackathon</p>
              <p className="text-sm font-semibold text-foreground">{h.title}</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{h.theme}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const toggleRole = (role: OpenRole) =>
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (teamName.trim().length < 3) e.teamName = "Team name must be at least 3 characters.";
    if (selectedRoles.length === 0) e.roles = "Select at least one role to fill.";
    if (teamSize < 2 || teamSize > 5) e.teamSize = "Team size must be between 2 and 5.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate() || !hackathon) return;
    const teamId = `team_${randomToken(6)}`;
    const inviteToken = randomToken(8);
    registerForHackathon({
      hackathonId: hackathon.id,
      teamId,
      teamName: teamName.trim(),
      teamSize,
      role: "leader",
      inviteToken,
      registeredAt: new Date().toISOString(),
      members: [],
      openRoles: selectedRoles,
      stage: "registered",
      checkIns: [],
    });
    setSuccess({ teamId, inviteToken, teamName: teamName.trim(), hackathonId: hackathon.id });
    toast.success("Registered for " + hackathon.title);
  };

  if (success) {
    return (
      <SuccessCard
        teamId={success.teamId}
        inviteToken={success.inviteToken}
        teamName={success.teamName}
        hackathonId={success.hackathonId}
        hackathonTitle={hackathon?.title ?? ""}
        onFindCollaborators={() => navigate(`/matches?hackathon=${success.hackathonId}`)}
      />
    );
  }

  return (
    <div className="border border-border rounded-xl p-6 bg-background max-w-2xl">
      <div className="flex items-center gap-3 mb-5">
        <Trophy className="w-5 h-5 text-violet-600" />
        <h2 className="text-base font-semibold text-foreground">Register for {hackathon!.title}</h2>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-xs font-medium text-foreground uppercase tracking-wider mb-1.5">
            Team name
          </label>
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="BrightBridge"
            className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-500"
          />
          {errors.teamName && <p className="text-xs text-rose-600 mt-1">{errors.teamName}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground uppercase tracking-wider mb-2">
            Team size
          </label>
          <div className="flex gap-2">
            {[2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setTeamSize(n)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg border ${
                  teamSize === n
                    ? "border-violet-500 bg-violet-50 text-violet-700"
                    : "border-border text-foreground hover:bg-background"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          {errors.teamSize && <p className="text-xs text-rose-600 mt-1">{errors.teamSize}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground uppercase tracking-wider mb-2">
            Roles to fill ({selectedRoles.length} selected)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {founderProfile.openRoles.map((role) => (
              <label key={role} className="flex items-center gap-2 text-sm border border-border rounded-lg px-3 py-2 cursor-pointer hover:bg-background">
                <input
                  type="checkbox"
                  checked={selectedRoles.includes(role)}
                  onChange={() => toggleRole(role)}
                  className="rounded text-violet-600 focus:ring-violet-500"
                />
                <span className="text-foreground">{role}</span>
              </label>
            ))}
          </div>
          {errors.roles && <p className="text-xs text-rose-600 mt-1">{errors.roles}</p>}
        </div>

        <div className="flex justify-between items-center pt-3 border-t border-border">
          <Link to="/incubation-hub?panel=hackathon" className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </Link>
          <button
            type="button"
            onClick={handleSubmit}
            className="text-xs font-medium px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700"
          >
            Confirm & generate invite link
          </button>
        </div>
      </div>
    </div>
  );
}

function SuccessCard({
  teamId,
  inviteToken,
  teamName,
  hackathonId,
  hackathonTitle,
  onFindCollaborators,
}: {
  teamId: string;
  inviteToken: string;
  teamName: string;
  hackathonId: string;
  hackathonTitle: string;
  onFindCollaborators: () => void;
}) {
  const url = `https://techit.ai/h/${hackathonId}/team/${teamId}?token=${inviteToken}`;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Invite link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const mailto = `mailto:?subject=${encodeURIComponent(`Join ${teamName} for ${hackathonTitle}`)}&body=${encodeURIComponent(url)}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(`Join ${teamName} for ${hackathonTitle}: ${url}`)}`;

  return (
    <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-3">
        <Check className="w-5 h-5 text-emerald-600" />
        <h2 className="text-base font-semibold text-emerald-900">You're registered as team leader for {hackathonTitle}</h2>
      </div>
      <p className="text-sm text-emerald-800 mb-4">Share this link with collaborators to invite them to {teamName}:</p>
      <div className="flex items-center gap-2 mb-4">
        <input
          type="text"
          readOnly
          value={url}
          className="flex-1 text-xs border border-emerald-200 rounded-lg px-3 py-2 bg-background text-foreground font-mono truncate"
          aria-label="Invite link"
        />
        <button
          type="button"
          onClick={handleCopy}
          className="text-xs font-medium px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <a href={mailto} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-emerald-300 text-emerald-800 bg-background hover:bg-emerald-50 flex items-center gap-1">
          <Mail className="w-3.5 h-3.5" />
          Email
        </a>
        <a href={wa} target="_blank" rel="noreferrer noopener" className="text-xs font-medium px-3 py-1.5 rounded-lg border border-emerald-300 text-emerald-800 bg-background hover:bg-emerald-50 flex items-center gap-1">
          <Send className="w-3.5 h-3.5" />
          WhatsApp
        </a>
        <button
          type="button"
          onClick={onFindCollaborators}
          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-violet-300 text-violet-700 bg-background hover:bg-violet-50"
        >
          Find Hackathon Collaborator →
        </button>
      </div>
    </div>
  );
}
