import { useMemo, useState } from "react";
import { Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { HackathonRegistration, CheckIn } from "@/contexts/UserContext";
import { useFounderProfile } from "@/contexts/UserContext";
import { computeMomentum } from "@/dashboard/_shared/hackathon/momentum";

interface Props {
  registration: HackathonRegistration;
}

const BASE32_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

function randomToken(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += BASE32_ALPHABET[bytes[i] % 32];
  return out;
}

const STATUS_META: Record<CheckIn["status"], { label: string; pill: string }> = {
  "on-track": { label: "On track", pill: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  "blocked":  { label: "Blocked",  pill: "bg-amber-50 text-amber-700 border border-amber-200" },
  "pivoted":  { label: "Pivoted",  pill: "bg-violet-50 text-violet-700 border border-violet-200" },
};

function relativeTime(iso: string, now: number): string {
  const diff = now - new Date(iso).getTime();
  const mins = Math.floor(diff / (1000 * 60));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 24) return remMins > 0 ? `${hours}h ${remMins}m ago` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const MAX_UPDATE = 140;

export function BuildStage({ registration }: Props) {
  const { addCheckIn } = useFounderProfile();
  const now = useMemo(() => Date.now(), [registration.checkIns.length]);

  const [status, setStatus] = useState<CheckIn["status"]>("on-track");
  const [update, setUpdate] = useState("");
  const [blocker, setBlocker] = useState("");

  const checkIns = registration.checkIns ?? [];
  const ordered = useMemo(
    () => [...checkIns].sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime()),
    [checkIns],
  );

  const momentum = computeMomentum(registration, now);
  const lastCheckIn = ordered[0];
  const showReminder = momentum.nextAction === "log-check-in" && !!registration.brief && checkIns.length > 0;

  const handleSubmit = () => {
    if (update.trim().length === 0) return;
    const checkIn: CheckIn = {
      id: randomToken(8),
      loggedAt: new Date().toISOString(),
      status,
      update: update.trim(),
      ...(status === "blocked" && blocker.trim() ? { blocker: blocker.trim() } : {}),
    };
    addCheckIn(registration.teamId, checkIn);
    toast.success("Check-in logged");
    setStatus("on-track");
    setUpdate("");
    setBlocker("");
  };

  return (
    <div className="max-w-6xl mx-auto">
      {showReminder && lastCheckIn && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-5">
          <Clock className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            <span className="font-medium">Time for a check-in</span> — last update {relativeTime(lastCheckIn.loggedAt, now)}.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline */}
        <div className="lg:col-span-2">
          <h2 className="text-base font-semibold text-slate-900 mb-3">Build timeline</h2>
          {ordered.length === 0 ? (
            <div className="border border-dashed border-slate-300 rounded-xl p-10 text-center">
              <p className="text-sm text-slate-500">No check-ins yet. Log your first one →</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {ordered.map((c) => {
                const meta = STATUS_META[c.status];
                return (
                  <li key={c.id} className="border border-slate-200 rounded-xl p-4 bg-white">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.pill}`}>{meta.label}</span>
                      <span className="text-xs text-slate-400">{relativeTime(c.loggedAt, now)}</span>
                    </div>
                    <p className="text-sm text-slate-800">{c.update}</p>
                    {c.blocker && (
                      <div className="flex items-start gap-2 mt-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                        <p className="text-xs text-slate-600">{c.blocker}</p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Log form */}
        <div className="lg:col-span-1">
          <div className="border border-slate-200 rounded-xl p-5 bg-white lg:sticky lg:top-6">
            <h3 className="text-base font-semibold text-slate-900 mb-4">Log check-in</h3>

            <fieldset className="mb-4">
              <legend className="text-xs font-medium text-slate-700 uppercase tracking-wider mb-2">Status</legend>
              <div className="space-y-1.5">
                {(["on-track", "blocked", "pivoted"] as const).map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value={s}
                      checked={status === s}
                      onChange={() => setStatus(s)}
                      className="accent-violet-600"
                    />
                    {STATUS_META[s].label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider mb-1.5">Update</label>
              <textarea
                rows={3}
                maxLength={MAX_UPDATE}
                value={update}
                onChange={(e) => setUpdate(e.target.value)}
                placeholder="What moved since the last check-in?"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
              />
              <div className="flex justify-end mt-1">
                <span className="text-xs text-slate-400">{update.length}/{MAX_UPDATE}</span>
              </div>
            </div>

            {status === "blocked" && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider mb-1.5">Blocker</label>
                <textarea
                  rows={2}
                  value={blocker}
                  onChange={(e) => setBlocker(e.target.value)}
                  placeholder="What's in the way?"
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
                />
              </div>
            )}

            <button
              type="button"
              disabled={update.trim().length === 0}
              onClick={handleSubmit}
              className={`w-full text-sm font-medium px-4 py-2 rounded-lg ${
                update.trim().length > 0
                  ? "bg-violet-600 text-white hover:bg-violet-700"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }`}
            >
              Log check-in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
