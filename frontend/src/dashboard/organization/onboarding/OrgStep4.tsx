import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOrgProfile, type OrgTeamMember } from "@/contexts/UserContext";
import { OrgProgressBar } from "./OrgProgressBar";
import { Users, Plus, X, Crown } from "lucide-react";

export function OrgStep4() {
  const navigate = useNavigate();
  const { orgProfile, updateOrgProfile } = useOrgProfile();
  const [members, setMembers] = useState<OrgTeamMember[]>(
    orgProfile.teamMembers,
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Programme Manager");

  const addMember = () => {
    if (!name.trim() || !email.trim()) return;
    const m: OrgTeamMember = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
    };
    setMembers([...members, m]);
    setName("");
    setEmail("");
    setRole("Programme Manager");
  };

  const removeMember = (id: string) =>
    setMembers((prev) => prev.filter((m) => m.id !== id));

  const handleNext = () => {
    updateOrgProfile({ teamMembers: members });
    navigate("/org/onboarding/step-5");
  };
  const handleBack = () => navigate("/org/onboarding/step-3");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900/80 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-3xl">
        <OrgProgressBar currentStep={4} totalSteps={5} />

        <div className="mb-10">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight mb-2 flex items-center gap-3">
            <Users className="w-9 h-9 text-indigo-600" />
            Team & Contacts
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-400">
            Add the people who will run programmes and review applications.
          </p>
        </div>

        {/* Add member form */}
        <div className="bg-white dark:bg-slate-800/60 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-6 mb-8">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
            Add a team member
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="h-12 bg-slate-50 dark:bg-slate-900/60 border-2 border-slate-200 dark:border-slate-700 rounded-lg px-4 text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition-colors"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="work@email.com"
              className="h-12 bg-slate-50 dark:bg-slate-900/60 border-2 border-slate-200 dark:border-slate-700 rounded-lg px-4 text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition-colors"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="h-12 bg-slate-50 dark:bg-slate-900/60 border-2 border-slate-200 dark:border-slate-700 rounded-lg px-4 text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition-colors"
            >
              <option>Programme Manager</option>
              <option>Admin</option>
              <option>Mentor Lead</option>
              <option>Partnerships</option>
              <option>Finance</option>
              <option>Marketing</option>
            </select>
          </div>
          <button
            onClick={addMember}
            disabled={!name.trim() || !email.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add member
          </button>
        </div>

        {/* Member list */}
        <div className="space-y-2.5">
          {members.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No team members yet — you can add them later from Settings.
              </p>
            </div>
          ) : (
            members.map((m, idx) => (
              <div
                key={m.id}
                className="flex items-center gap-4 bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {m.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {m.name}
                    </p>
                    {idx === 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] font-mono uppercase tracking-wider">
                        <Crown className="w-3 h-3" />
                        Owner
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {m.email} · {m.role}
                  </p>
                </div>
                <button
                  onClick={() => removeMember(m.id)}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                  aria-label="Remove"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="mt-12 flex justify-between gap-4">
          <button
            onClick={handleBack}
            className="px-6 py-4 rounded-xl border-2 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold hover:border-indigo-400 transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleNext}
            className="px-10 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
