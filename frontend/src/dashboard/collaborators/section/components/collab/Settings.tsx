// frontend/src/dashboard/collaborators/section/components/collab/Settings.tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { User, Briefcase, Bell, UserCog, LogOut } from "lucide-react";
import { useCollaboratorProfile, useActiveRoles, type CollaboratorDiscipline, type Role } from "@/contexts/UserContext";
import { roleDashboardPath, roleOnboardingPath } from "./TopBarRoleMenu";

const disciplines: CollaboratorDiscipline[] = [
  "Engineering", "Design", "Product", "Data & ML",
  "DevOps", "Security", "Marketing", "Research",
];

const subSkillsByDiscipline: Record<CollaboratorDiscipline, string[]> = {
  "Engineering": ["React", "TypeScript", "Node.js", "Python", "Go", "Rust", "System design", "Performance", "Mobile (RN/iOS/Android)", "Backend APIs", "Testing", "GraphQL", "Realtime", "Web3"],
  "Design":      ["Product", "Visual", "Brand", "UX research", "Design systems", "Motion", "Illustration", "Prototyping", "3D", "Webflow/Framer", "Figma", "Pitch decks", "Marketing pages", "Iconography"],
  "Product":     ["Discovery", "Roadmapping", "PRDs", "Analytics", "Pricing", "GTM", "Growth experiments", "A/B testing", "Stakeholder mgmt", "Customer interviews", "Spec writing", "Prioritisation", "OKRs", "PMing AI features"],
  "Data & ML":   ["Modelling", "MLOps", "NLP", "CV", "RAG", "Fine-tuning", "Evals", "Recommenders", "Time series", "Forecasting", "SQL", "dbt", "Notebooks", "Dashboards"],
  "DevOps":      ["AWS", "GCP", "Azure", "K8s", "Terraform", "CI/CD", "Observability", "Incident response", "Cost optimization", "Container orchestration", "Edge/CDN", "Serverless", "Networking", "Backups"],
  "Security":    ["AppSec", "Pen testing", "SAST/DAST", "Threat modelling", "IAM", "Compliance (SOC2/ISO/GDPR)", "Secrets mgmt", "Audit logging", "Zero trust", "Crypto", "Incident response", "Bug bounty", "Cloud security", "Red team"],
  "Marketing":   ["Content", "SEO", "Paid ads", "Lifecycle", "Email", "Brand", "Social", "Community", "PR", "Launches", "Partnerships", "Analytics", "Creator marketing", "Founder-led"],
  "Research":    ["User research", "Market research", "Behavioural research", "Quant", "Qual", "Surveys", "Diary studies", "Usability", "Interviews", "Competitive analysis", "Synthesis", "Repository", "Insights", "Strategy"],
};

const sections = [
  { id: "identity",      label: "Account & Identity",   icon: User },
  { id: "skills",        label: "Skills & Availability", icon: Briefcase },
  { id: "notifications", label: "Notifications",         icon: Bell },
  { id: "roles",         label: "Roles & Switching",     icon: UserCog },
];

const roleLabel: Record<Role, string> = {
  founder: "Founder",
  collaborator: "Collaborator",
  investor: "Investor",
  org: "Organization",
};

const roleBlurb: Record<Role, string> = {
  founder: "Lead a startup, recruit your team.",
  collaborator: "Build for equity across projects.",
  investor: "Spot opportunities, build a portfolio.",
  org: "Run programs, hackathons, talent pools.",
};

export function Settings() {
  const navigate = useNavigate();
  const { collaboratorProfile, updateCollaboratorProfile } = useCollaboratorProfile();
  const { activeRoles, currentRole } = useActiveRoles();

  // Identity form state
  const [iName,      setIName]      = useState(collaboratorProfile.name);
  const [iTitle,     setITitle]     = useState(collaboratorProfile.title);
  const [iLocation,  setILocation]  = useState(collaboratorProfile.location);
  const [iYears,     setIYears]     = useState(collaboratorProfile.yearsExperience);
  const [iHeadline,  setIHeadline]  = useState(collaboratorProfile.headline);
  const [iAvatar,    setIAvatar]    = useState(collaboratorProfile.avatarUrl);
  const [iEmail,     setIEmail]     = useState("alex.chen@example.com");
  const [iPw1, setIPw1]             = useState("");
  const [iPw2, setIPw2]             = useState("");

  // Skills form state
  const [sDisc,      setSDisc]      = useState<CollaboratorDiscipline | "">(collaboratorProfile.discipline);
  const [sSub,       setSSub]       = useState<string[]>(collaboratorProfile.subSkills);
  const [sStack,     setSStack]     = useState<string[]>(collaboratorProfile.techStack);
  const [sStackDraft, setSStackDraft] = useState("");
  const [sHours,     setSHours]     = useState(collaboratorProfile.weeklyHours);
  const [sCommit,    setSCommit]    = useState<typeof collaboratorProfile.commitmentStyle>(collaboratorProfile.commitmentStyle);
  const [sPref,      setSPref]      = useState(collaboratorProfile.equityPreference);
  const [sFloor,     setSFloor]     = useState(collaboratorProfile.minCashFloor);
  const [sVesting,   setSVesting]   = useState<typeof collaboratorProfile.vestingComfort>(collaboratorProfile.vestingComfort);

  // Notifications form state
  const [nPrefs, setNPrefs] = useState(collaboratorProfile.notifications);

  // Anchor scroll on mount
  const identityRef      = useRef<HTMLDivElement>(null);
  const skillsRef        = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const rolesRef         = useRef<HTMLDivElement>(null);
  const sectionRefs: Record<string, React.RefObject<HTMLDivElement | null>> = {
    identity: identityRef, skills: skillsRef, notifications: notificationsRef, roles: rolesRef,
  };

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash && sectionRefs[hash]?.current) {
      sectionRefs[hash].current!.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveIdentity = () => {
    updateCollaboratorProfile({
      name: iName, title: iTitle, location: iLocation,
      yearsExperience: iYears, headline: iHeadline, avatarUrl: iAvatar,
    });
    toast.success("Profile saved");
  };

  const saveSkills = () => {
    updateCollaboratorProfile({
      discipline: sDisc, subSkills: sSub, techStack: sStack,
      weeklyHours: sHours, commitmentStyle: sCommit,
      equityPreference: sPref, minCashFloor: sFloor, vestingComfort: sVesting,
    });
    toast.success("Skills & availability saved");
  };

  const saveNotifications = () => {
    updateCollaboratorProfile({ notifications: nPrefs });
    toast.success("Notification preferences saved");
  };

  const changePassword = () => {
    if (!iPw1 || iPw1 !== iPw2) { toast.error("Passwords don't match"); return; }
    setIPw1(""); setIPw2("");
    toast.success("Password updated (mock)");
  };

  const addStackChip = (v: string) => {
    const t = v.trim(); if (!t || sStack.includes(t)) { setSStackDraft(""); return; }
    setSStack([...sStack, t]); setSStackDraft("");
  };

  const toggleSubSkill = (s: string) => setSSub((cur) => cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]);

  const handleRoleAction = (role: Role) => {
    if (role === currentRole) return;
    if (activeRoles.has(role)) navigate(roleDashboardPath[role]);
    else                       navigate(roleOnboardingPath[role]);
  };

  const handleSignOut = () => toast("Signed out (mock)");

  const updateNotifGroup = (key: "opportunities" | "deadlines" | "payments" | "equityEvents", channel: "email" | "inApp", value: boolean) => {
    setNPrefs((cur) => ({ ...cur, [key]: { ...cur[key], [channel]: value } }));
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <nav className="lg:col-span-1">
          <ul className="space-y-1 sticky top-6">
            {sections.map((s) => {
              const Icon = s.icon;
              return (
                <li key={s.id}>
                  <a href={`#${s.id}`} onClick={() => sectionRefs[s.id]?.current?.scrollIntoView({ behavior: "smooth" })}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg">
                    <Icon className="w-4 h-4 text-slate-400" /> {s.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="lg:col-span-3 space-y-6">
          {/* Identity */}
          <section ref={identityRef} id="identity" className="border border-slate-200 bg-white rounded-xl p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Account & Identity</h2>
            <div className="space-y-4">
              <Row label="Avatar"><input type="file" accept="image/*" onChange={(e) => setIAvatar(e.target.files?.[0]?.name ?? "")} className="text-sm" />{iAvatar && <p className="text-xs text-slate-500 mt-1">Selected: {iAvatar}</p>}</Row>
              <Row label="Name"><Input value={iName} onChange={setIName} /></Row>
              <Row label="Professional title"><Input value={iTitle} onChange={setITitle} /></Row>
              <Row label="Location"><Input value={iLocation} onChange={setILocation} /></Row>
              <Row label="Years of experience"><Input value={String(iYears)} onChange={(v) => setIYears(Number(v) || 0)} type="number" /></Row>
              <Row label="Headline"><Input value={iHeadline} onChange={setIHeadline} /></Row>
              <Row label="Contact email"><Input value={iEmail} onChange={setIEmail} type="email" /></Row>
              <Row label="Change password">
                <div className="space-y-2">
                  <Input value={iPw1} onChange={setIPw1} type="password" placeholder="New password" />
                  <Input value={iPw2} onChange={setIPw2} type="password" placeholder="Confirm new password" />
                  <button onClick={changePassword} disabled={!iPw1 || iPw1 !== iPw2}
                    className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50">Update password</button>
                </div>
              </Row>
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={saveIdentity} className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg">Save</button>
            </div>
          </section>

          {/* Skills & Availability */}
          <section ref={skillsRef} id="skills" className="border border-slate-200 bg-white rounded-xl p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Skills & Availability</h2>

            <div className="mb-5">
              <p className="text-xs font-semibold text-slate-700 mb-2">Discipline</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {disciplines.map((d) => (
                  <button key={d} type="button" onClick={() => { setSDisc(d); setSSub([]); }}
                    className={`px-3 py-2 rounded-lg border-2 text-xs font-medium ${sDisc === d ? "border-amber-500 bg-amber-50 text-amber-700" : "border-slate-300 bg-white text-slate-600"}`}>{d}</button>
                ))}
              </div>
            </div>

            {sDisc && (
              <div className="mb-5">
                <p className="text-xs font-semibold text-slate-700 mb-2">Sub-skills <span className="text-slate-400 font-normal">({sSub.length} selected)</span></p>
                <div className="flex flex-wrap gap-1.5">
                  {subSkillsByDiscipline[sDisc].map((s) => (
                    <button key={s} type="button" onClick={() => toggleSubSkill(s)}
                      className={`px-2.5 py-1 rounded-full border text-xs ${sSub.includes(s) ? "border-amber-500 bg-amber-50 text-amber-700" : "border-slate-300 bg-white text-slate-600"}`}>{s}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-5">
              <p className="text-xs font-semibold text-slate-700 mb-2">Tech stack</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {sStack.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-xs text-slate-700">
                    {s}
                    <button onClick={() => setSStack(sStack.filter((x) => x !== s))} className="text-slate-400 hover:text-slate-700">×</button>
                  </span>
                ))}
              </div>
              <input value={sStackDraft} onChange={(e) => setSStackDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addStackChip(sStackDraft); } }}
                placeholder="Add a tool — hit Enter"
                className="w-full h-9 border border-slate-300 rounded-lg px-3 text-sm focus:outline-none focus:border-amber-500" />
            </div>

            <div className="mb-5">
              <p className="text-xs font-semibold text-slate-700 mb-2">Weekly hours <span className="text-amber-600 font-semibold">({sHours})</span></p>
              <input type="range" min={5} max={60} value={sHours} onChange={(e) => setSHours(Number(e.target.value))} className="w-full accent-amber-500" />
            </div>

            <div className="mb-5">
              <p className="text-xs font-semibold text-slate-700 mb-2">Commitment style</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { v: "deep" as const,     label: "One deeply" },
                  { v: "parallel" as const, label: "2–3 parallel" },
                  { v: "many" as const,     label: "Many short" },
                ]).map((opt) => (
                  <button key={opt.v} type="button" onClick={() => setSCommit(opt.v)}
                    className={`px-3 py-2 rounded-lg border-2 text-xs font-medium ${sCommit === opt.v ? "border-amber-500 bg-amber-50 text-amber-700" : "border-slate-300 bg-white text-slate-600"}`}>{opt.label}</button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <p className="text-xs font-semibold text-slate-700 mb-2">Equity vs cash <span className="text-amber-600 font-semibold">({sPref}% equity / {100 - sPref}% cash)</span></p>
              <input type="range" min={0} max={100} value={sPref} onChange={(e) => setSPref(Number(e.target.value))} className="w-full accent-amber-500" />
            </div>

            <div className="mb-5">
              <p className="text-xs font-semibold text-slate-700 mb-2">Min cash floor (per month)</p>
              <Input value={String(sFloor)} onChange={(v) => setSFloor(Number(v) || 0)} type="number" />
            </div>

            <div className="mb-2">
              <p className="text-xs font-semibold text-slate-700 mb-2">Vesting comfort</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { v: "1y-cliff-4y" as const, label: "1y cliff, 4y" },
                  { v: "standard" as const,    label: "Standard" },
                  { v: "custom" as const,      label: "Custom" },
                ]).map((opt) => (
                  <button key={opt.v} type="button" onClick={() => setSVesting(opt.v)}
                    className={`px-3 py-2 rounded-lg border-2 text-xs font-medium ${sVesting === opt.v ? "border-amber-500 bg-amber-50 text-amber-700" : "border-slate-300 bg-white text-slate-600"}`}>{opt.label}</button>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button onClick={saveSkills} className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg">Save</button>
            </div>
          </section>

          {/* Notifications */}
          <section ref={notificationsRef} id="notifications" className="border border-slate-200 bg-white rounded-xl p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Notifications</h2>
            <div className="space-y-3">
              <NotifGroup label="New opportunities matching your skills"
                email={nPrefs.opportunities.email} inApp={nPrefs.opportunities.inApp}
                onChange={(c, v) => updateNotifGroup("opportunities", c, v)} />
              <NotifGroup label="Task deadlines"
                email={nPrefs.deadlines.email} inApp={nPrefs.deadlines.inApp}
                onChange={(c, v) => updateNotifGroup("deadlines", c, v)} />
              <NotifGroup label="Payments & cash payouts"
                email={nPrefs.payments.email} inApp={nPrefs.payments.inApp}
                onChange={(c, v) => updateNotifGroup("payments", c, v)} />
              <NotifGroup label="Equity events (vesting, new grants, dilution)"
                email={nPrefs.equityEvents.email} inApp={nPrefs.equityEvents.inApp}
                onChange={(c, v) => updateNotifGroup("equityEvents", c, v)} />
            </div>
            <div className="mt-5">
              <p className="text-xs font-semibold text-slate-700 mb-2">Quiet hours</p>
              <select value={nPrefs.quietHours} onChange={(e) => setNPrefs((cur) => ({ ...cur, quietHours: e.target.value as typeof cur.quietHours }))}
                className="h-9 border border-slate-300 rounded-lg px-3 text-sm bg-white">
                <option value="off">Off</option>
                <option value="10pm-8am">10pm – 8am</option>
                <option value="weekends">Always quiet on weekends</option>
              </select>
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={saveNotifications} className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg">Save</button>
            </div>
          </section>

          {/* Roles & Switching */}
          <section ref={rolesRef} id="roles" className="border border-slate-200 bg-white rounded-xl p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Roles & Switching</h2>
            <div className="space-y-3">
              {(["collaborator", "founder", "investor", "org"] as Role[]).map((role) => {
                const active = activeRoles.has(role);
                const isCurrent = role === currentRole;
                return (
                  <div key={role} className={`flex items-center gap-4 p-4 border rounded-xl ${isCurrent ? "bg-amber-50 border-amber-300" : "border-slate-200 bg-white"}`}>
                    <span className={`w-2 h-2 rounded-full ${active ? "bg-emerald-500" : "bg-slate-300"}`}></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {roleLabel[role]}
                        {isCurrent && <span className="ml-2 text-xs text-amber-700 font-normal">current role</span>}
                      </p>
                      <p className="text-xs text-slate-500">{roleBlurb[role]}</p>
                    </div>
                    <button onClick={() => handleRoleAction(role)} disabled={isCurrent}
                      className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${
                        isCurrent
                          ? "bg-slate-200 text-slate-400 cursor-default"
                          : active
                            ? "bg-slate-900 text-white hover:bg-slate-800"
                            : "border border-amber-500 text-amber-700 hover:bg-amber-50"
                      }`}>
                      {isCurrent ? "Current" : active ? "Switch to" : "Activate role"}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 pt-6 border-t border-slate-100 flex justify-end">
              <button onClick={handleSignOut} className="flex items-center gap-1.5 text-sm text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg">
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, type = "text", placeholder }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} type={type} placeholder={placeholder}
      className="w-full h-10 border border-slate-300 rounded-lg px-3 text-sm focus:outline-none focus:border-amber-500" />
  );
}

function NotifGroup({ label, email, inApp, onChange }: { label: string; email: boolean; inApp: boolean; onChange: (channel: "email" | "inApp", value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-700">{label}</span>
      <div className="flex items-center gap-4 text-xs">
        <label className="flex items-center gap-1.5 text-slate-600">
          <input type="checkbox" checked={email} onChange={(e) => onChange("email", e.target.checked)} className="accent-amber-500" /> Email
        </label>
        <label className="flex items-center gap-1.5 text-slate-600">
          <input type="checkbox" checked={inApp} onChange={(e) => onChange("inApp", e.target.checked)} className="accent-amber-500" /> In-app
        </label>
      </div>
    </div>
  );
}
