// frontend/src/dashboard/founders/section/components/founder/Settings.tsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  User, Briefcase, BadgeCheck, Bell, UserCog, LogOut, Github, Check, Upload,
} from "lucide-react";
import {
  useFounderProfile, useActiveRoles,
  type Role, type FounderExperience, type FounderStage, type LaunchStatus,
  type CompModel, type OwnershipPhilosophy, type OpenRole, type FounderVerification,
} from "@/contexts/UserContext";
import { roleDashboardPath, roleOnboardingPath } from "@/lib/roleRoutes";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/dashboard/collaborators/section/components/ui/dialog";

const sections = [
  { id: "identity",      label: "Account & Identity",  icon: User },
  { id: "startup",       label: "Startup & Roles",     icon: Briefcase },
  { id: "verification",  label: "Verification",        icon: BadgeCheck },
  { id: "notifications", label: "Notifications",       icon: Bell },
  { id: "roles",         label: "Roles & Switching",   icon: UserCog },
] as const;

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

const FOUNDER_TYPES: { v: FounderExperience; label: string }[] = [
  { v: "first-time", label: "First time" },
  { v: "some-experience", label: "Some experience" },
  { v: "serial", label: "Serial" },
];

const STAGES: FounderStage[] = ["Idea", "MVP", "Beta", "Launch", "Growth"];

const INDUSTRIES = ["AI/ML", "SaaS", "FinTech", "HealthTech", "E-Commerce", "Edtech", "CleanTech", "Web3"];

const ALL_ROLES: OpenRole[] = [
  "Frontend Engineer", "Backend Engineer", "Full-stack Engineer",
  "ML Engineer", "Designer (Product)", "Designer (Visual)",
  "Product Manager", "Data Scientist", "DevOps Engineer",
  "Growth Marketer", "Content / Copy", "Founder Associate",
];

const COMP_OPTIONS: { v: CompModel; label: string }[] = [
  { v: "equity-heavy",     label: "Equity-heavy" },
  { v: "cash-equity-mix",  label: "Cash + equity" },
  { v: "cash-heavy",       label: "Cash-heavy" },
];

const LAUNCH_OPTIONS: { v: LaunchStatus; label: string }[] = [
  { v: "pre-launch",   label: "Pre-launch" },
  { v: "private-beta", label: "Private beta" },
  { v: "public",       label: "Public" },
];

const PHILOSOPHY_OPTIONS: { v: OwnershipPhilosophy; label: string }[] = [
  { v: "equity-day-one",          label: "Collaborators earn equity from day one" },
  { v: "cash-first-equity-later", label: "Cash-first now, equity at seed" },
  { v: "custom",                  label: "Custom (negotiate per-person)" },
];

export function Settings() {
  const navigate = useNavigate();
  const { founderProfile, updateFounderProfile } = useFounderProfile();
  const { activeRoles, currentRole } = useActiveRoles();

  // Identity state
  const [iName, setIName]         = useState(founderProfile.name);
  const [iTitle, setITitle]       = useState(founderProfile.title);
  const [iLocation, setILocation] = useState(founderProfile.location);
  const [iYears, setIYears]       = useState(founderProfile.yearsBuilding);
  const [iType, setIType]         = useState<FounderExperience>(founderProfile.founderType);
  const [iHeadline, setIHeadline] = useState(founderProfile.headline);
  const [iAvatar, setIAvatar]     = useState(founderProfile.avatarUrl);
  const [iEmail, setIEmail]       = useState("sarah.chen@example.com");
  const [iGithub, setIGithub]     = useState(founderProfile.links.github);
  const [iLinkedin, setILinkedin] = useState(founderProfile.links.linkedin);
  const [iTwitter, setITwitter]   = useState(founderProfile.links.twitter);
  const [iPersonal, setIPersonal] = useState(founderProfile.links.personal);
  const [iPw1, setIPw1]           = useState("");
  const [iPw2, setIPw2]           = useState("");

  // Startup state
  const [sName, setSName]               = useState(founderProfile.startupName);
  const [sOneLiner, setSOneLiner]       = useState(founderProfile.oneLiner);
  const [sStage, setSStage]             = useState<FounderStage>(founderProfile.stage);
  const [sIndustries, setSIndustries]   = useState<string[]>(founderProfile.industries);
  const [sFoundingYear, setSFoundingYear] = useState(founderProfile.foundingYear);
  const [sWebsite, setSWebsite]         = useState(founderProfile.website);
  const [sLogoEmoji, setSLogoEmoji]     = useState(founderProfile.logoEmoji);
  const [sTeamSize, setSTeamSize]       = useState(founderProfile.currentTeamSize);
  const [sRoles, setSRoles]             = useState<OpenRole[]>(founderProfile.openRoles);
  const [sComp, setSComp]               = useState<CompModel>(founderProfile.compensationOffered);
  const [sEqMin, setSEqMin]             = useState(founderProfile.equityRangeMin);
  const [sEqMax, setSEqMax]             = useState(founderProfile.equityRangeMax);
  const [sLaunch, setSLaunch]           = useState<LaunchStatus>(founderProfile.launchStatus);
  const [sUsers, setSUsers]             = useState(founderProfile.users);
  const [sRevenue, setSRevenue]         = useState(founderProfile.revenueMonthly);
  const [sFunding, setSFunding]         = useState(founderProfile.fundingRaised);
  const [sInvestor, setSInvestor]       = useState(founderProfile.leadInvestor);
  const [sMilestone, setSMilestone]     = useState(founderProfile.nextMilestone);
  const [sWhy, setSWhy]                 = useState(founderProfile.whyBuilding);
  const [sWinning, setSWinning]         = useState(founderProfile.winningIn3Years);
  const [sAdvantage, setSAdvantage]     = useState(founderProfile.unfairAdvantage);
  const [sPhilosophy, setSPhilosophy]   = useState<OwnershipPhilosophy>(founderProfile.ownershipPhilosophy);

  // Verification state
  const [ver, setVer] = useState<FounderVerification>(founderProfile.verification);
  const [githubDialogOpen, setGithubDialogOpen] = useState(false);

  // Notifications state
  const [nPrefs, setNPrefs] = useState(founderProfile.notifications);

  // Anchor scrolling
  const refs = {
    identity:      useRef<HTMLDivElement>(null),
    startup:       useRef<HTMLDivElement>(null),
    verification:  useRef<HTMLDivElement>(null),
    notifications: useRef<HTMLDivElement>(null),
    roles:         useRef<HTMLDivElement>(null),
  };

  useEffect(() => {
    const hash = window.location.hash.slice(1) as keyof typeof refs;
    if (hash && refs[hash]?.current) {
      refs[hash].current!.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save handlers
  const saveIdentity = () => {
    updateFounderProfile({
      name: iName, title: iTitle, location: iLocation, yearsBuilding: iYears,
      founderType: iType, headline: iHeadline, avatarUrl: iAvatar,
      links: { github: iGithub, linkedin: iLinkedin, twitter: iTwitter, personal: iPersonal },
    });
    toast.success("Profile saved");
  };

  const saveStartup = () => {
    updateFounderProfile({
      startupName: sName, oneLiner: sOneLiner, stage: sStage, industries: sIndustries,
      foundingYear: sFoundingYear, website: sWebsite, logoEmoji: sLogoEmoji,
      currentTeamSize: sTeamSize, openRoles: sRoles, compensationOffered: sComp,
      equityRangeMin: sEqMin, equityRangeMax: sEqMax,
      launchStatus: sLaunch, users: sUsers, revenueMonthly: sRevenue, fundingRaised: sFunding,
      leadInvestor: sInvestor, nextMilestone: sMilestone,
      whyBuilding: sWhy, winningIn3Years: sWinning, unfairAdvantage: sAdvantage,
      ownershipPhilosophy: sPhilosophy,
    });
    toast.success("Startup details saved");
  };

  const saveNotifications = () => {
    updateFounderProfile({ notifications: nPrefs });
    toast.success("Notification preferences saved");
  };

  const updatePassword = () => {
    if (!iPw1 || iPw1 !== iPw2) {
      toast.error("Passwords don't match");
      return;
    }
    setIPw1(""); setIPw2("");
    toast.success("Password updated (mock)");
  };

  // Verification handlers
  const flipSocial = (key: "twitter" | "linkedin" | "personalSite", verified: boolean) => {
    setVer((cur) => {
      const next = { ...cur, [key]: { ...cur[key], verified } } as FounderVerification;
      updateFounderProfile({ verification: next });
      return next;
    });
    toast(verified ? `${labelFor(key)} verified` : `${labelFor(key)} unverified`);
  };

  const connectGithub = () => {
    setVer((cur) => {
      const next: FounderVerification = { ...cur, github: { ...cur.github, verified: true, username: cur.github.username || "sarahchen" } };
      updateFounderProfile({ verification: next });
      return next;
    });
    setGithubDialogOpen(false);
    toast.success("GitHub connected");
  };

  const disconnectGithub = () => {
    setVer((cur) => {
      const next: FounderVerification = { ...cur, github: { ...cur.github, verified: false } };
      updateFounderProfile({ verification: next });
      return next;
    });
    toast("GitHub disconnected");
  };

  const submitNin = () => {
    setVer((cur) => {
      const next: FounderVerification = { ...cur, nin: { ...cur.nin, status: "pending" } };
      updateFounderProfile({ verification: next });
      return next;
    });
    toast("Submitted — under review");
    // DEMO ONLY: auto-verify after 5s. Remove when a real verification API lands.
    setTimeout(() => {
      setVer((cur) => {
        const next: FounderVerification = { ...cur, nin: { ...cur.nin, status: "verified" } };
        updateFounderProfile({ verification: next });
        return next;
      });
      toast.success("Identity verified");
    }, 5000);
  };

  // Notification toggle — full nested spread
  const toggleNotif = (key: "applications" | "investors" | "workspace" | "opportunities", channel: "email" | "inApp", value: boolean) => {
    setNPrefs((cur) => ({ ...cur, [key]: { ...cur[key], [channel]: value } }));
  };

  // Role handlers
  const handleRoleAction = (role: Role) => {
    if (role === currentRole) return;
    if (activeRoles.has(role)) navigate(roleDashboardPath[role]);
    else                       navigate(roleOnboardingPath[role]);
  };

  // Industry / role chip toggles
  const toggleIndustry = (s: string) => setSIndustries((cur) => cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]);
  const toggleRole = (r: OpenRole) => setSRoles((cur) => {
    if (cur.includes(r)) return cur.filter((x) => x !== r);
    if (cur.length >= 5) return cur;
    return [...cur, r];
  });

  // RENDER
  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Settings</h1>

      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-6">
        {/* Sub-nav */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <nav className="space-y-1">
            {sections.map((s) => {
              const Icon = s.icon;
              return (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    refs[s.id].current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    history.replaceState(null, "", `#${s.id}`);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100"
                >
                  <Icon className="w-4 h-4 text-slate-500" />
                  {s.label}
                </a>
              );
            })}
          </nav>
        </aside>

        {/* Sections */}
        <div className="space-y-8">
          {/* IDENTITY */}
          <section ref={refs.identity} id="identity" className="border border-slate-200 bg-white rounded-xl p-6 scroll-mt-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Account & Identity</h2>
            <p className="text-sm text-slate-500 mb-6">Edit your name, role, and contact details.</p>
            <div className="space-y-4">
              <Row label="Avatar">
                <label className="flex items-center gap-3 text-sm text-slate-600 cursor-pointer">
                  <Upload className="w-4 h-4 text-slate-500" />
                  <span>Upload a photo</span>
                  <input type="file" className="hidden" onChange={(e) => setIAvatar(e.target.files?.[0]?.name ?? "")} />
                </label>
                {iAvatar && <p className="text-xs text-slate-500 mt-1 ml-7">Selected: {iAvatar}</p>}
              </Row>
              <Row label="Name"><Input value={iName} onChange={setIName} /></Row>
              <Row label="Professional title"><Input value={iTitle} onChange={setITitle} /></Row>
              <Row label="Location"><Input value={iLocation} onChange={setILocation} /></Row>
              <Row label="Years building"><Input value={String(iYears)} onChange={(v) => setIYears(Number(v) || 0)} type="number" /></Row>
              <Row label="Founder type">
                <div className="grid grid-cols-3 gap-2">
                  {FOUNDER_TYPES.map((t) => (
                    <button key={t.v} type="button" onClick={() => setIType(t.v)}
                      className={`px-3 py-2 rounded-lg border text-sm ${iType === t.v ? "border-violet-500 bg-violet-50 text-violet-700" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </Row>
              <Row label="Headline"><Input value={iHeadline} onChange={setIHeadline} /></Row>
              <Row label="Contact email"><Input value={iEmail} onChange={setIEmail} type="email" /></Row>
              <Row label="GitHub"><Input value={iGithub} onChange={setIGithub} /></Row>
              <Row label="LinkedIn"><Input value={iLinkedin} onChange={setILinkedin} /></Row>
              <Row label="X / Twitter"><Input value={iTwitter} onChange={setITwitter} /></Row>
              <Row label="Personal site"><Input value={iPersonal} onChange={setIPersonal} /></Row>
              <Row label="Change password">
                <div className="space-y-2">
                  <Input value={iPw1} onChange={setIPw1} type="password" placeholder="New password" />
                  <Input value={iPw2} onChange={setIPw2} type="password" placeholder="Confirm new password" />
                  <button type="button" onClick={updatePassword} disabled={!iPw1 || iPw1 !== iPw2}
                    className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50">Update password</button>
                </div>
              </Row>
            </div>
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={saveIdentity} className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-lg">Save</button>
            </div>
          </section>

          {/* STARTUP */}
          <section ref={refs.startup} id="startup" className="border border-slate-200 bg-white rounded-xl p-6 scroll-mt-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Startup & Roles</h2>
            <p className="text-sm text-slate-500 mb-6">Everything about what you're building and who you're hiring.</p>

            <div className="space-y-6">
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Startup details</p>
                <Row label="Startup name"><Input value={sName} onChange={setSName} /></Row>
                <Row label="One-liner"><Input value={sOneLiner} onChange={setSOneLiner} /></Row>
                <Row label="Stage">
                  <div className="grid grid-cols-5 gap-2">
                    {STAGES.map((st) => (
                      <button key={st} type="button" onClick={() => setSStage(st)}
                        className={`px-3 py-2 rounded-lg border text-sm ${sStage === st ? "border-violet-500 bg-violet-50 text-violet-700" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}>
                        {st}
                      </button>
                    ))}
                  </div>
                </Row>
                <Row label={`Industries (${sIndustries.length} of 1–3)`}>
                  <div className="flex flex-wrap gap-2">
                    {INDUSTRIES.map((ind) => (
                      <button key={ind} type="button" onClick={() => toggleIndustry(ind)}
                        className={`px-3 py-1.5 rounded-full border text-xs ${sIndustries.includes(ind) ? "border-violet-500 bg-violet-50 text-violet-700" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}>
                        {ind}
                      </button>
                    ))}
                  </div>
                </Row>
                <Row label="Founding year"><Input value={String(sFoundingYear)} onChange={(v) => setSFoundingYear(Number(v) || 0)} type="number" /></Row>
                <Row label="Website"><Input value={sWebsite} onChange={setSWebsite} /></Row>
                <Row label="Logo emoji"><Input value={sLogoEmoji} onChange={setSLogoEmoji} /></Row>
              </div>

              <hr className="border-slate-100" />

              <div className="space-y-4">
                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Team & roles</p>
                <Row label="Current team size"><Input value={String(sTeamSize)} onChange={(v) => setSTeamSize(Number(v) || 0)} type="number" /></Row>
                <Row label={`Open roles (${sRoles.length} of 5)`}>
                  <div className="flex flex-wrap gap-2">
                    {ALL_ROLES.map((r) => (
                      <button key={r} type="button" onClick={() => toggleRole(r)}
                        className={`px-3 py-1.5 rounded-full border text-xs ${sRoles.includes(r) ? "border-violet-500 bg-violet-50 text-violet-700" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                </Row>
                <Row label="Compensation offered">
                  <div className="grid grid-cols-3 gap-2">
                    {COMP_OPTIONS.map((c) => (
                      <button key={c.v} type="button" onClick={() => setSComp(c.v)}
                        className={`px-3 py-2 rounded-lg border text-sm ${sComp === c.v ? "border-violet-500 bg-violet-50 text-violet-700" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </Row>
                <Row label="Equity range">
                  <div className="flex items-center gap-2">
                    <Input value={String(sEqMin)} onChange={(v) => setSEqMin(Number(v) || 0)} type="number" />
                    <span className="text-slate-500">to</span>
                    <Input value={String(sEqMax)} onChange={(v) => setSEqMax(Number(v) || 0)} type="number" />
                    <span className="text-sm text-slate-500">%</span>
                  </div>
                </Row>
              </div>

              <hr className="border-slate-100" />

              <div className="space-y-4">
                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Traction</p>
                <Row label="Launch status">
                  <div className="grid grid-cols-3 gap-2">
                    {LAUNCH_OPTIONS.map((l) => (
                      <button key={l.v} type="button" onClick={() => setSLaunch(l.v)}
                        className={`px-3 py-2 rounded-lg border text-sm ${sLaunch === l.v ? "border-violet-500 bg-violet-50 text-violet-700" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}>
                        {l.label}
                      </button>
                    ))}
                  </div>
                </Row>
                <Row label="Users / customers"><Input value={String(sUsers)} onChange={(v) => setSUsers(Number(v) || 0)} type="number" /></Row>
                <Row label="Revenue (monthly $)"><Input value={String(sRevenue)} onChange={(v) => setSRevenue(Number(v) || 0)} type="number" /></Row>
                <Row label="Funding raised ($)"><Input value={String(sFunding)} onChange={(v) => setSFunding(Number(v) || 0)} type="number" /></Row>
                <Row label="Lead investor"><Input value={sInvestor} onChange={setSInvestor} /></Row>
                <Row label="Next milestone"><Input value={sMilestone} onChange={setSMilestone} /></Row>
              </div>

              <hr className="border-slate-100" />

              <div className="space-y-4">
                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Mission</p>
                <Row label="Why building"><Textarea value={sWhy} onChange={setSWhy} /></Row>
                <Row label="Winning in 3 years"><Textarea value={sWinning} onChange={setSWinning} /></Row>
                <Row label="Unfair advantage"><Textarea value={sAdvantage} onChange={setSAdvantage} /></Row>
                <Row label="Ownership philosophy">
                  <div className="space-y-2">
                    {PHILOSOPHY_OPTIONS.map((opt) => (
                      <button key={opt.v} type="button" onClick={() => setSPhilosophy(opt.v)}
                        className={`block w-full text-left px-3 py-2 rounded-lg border text-sm ${sPhilosophy === opt.v ? "border-violet-500 bg-violet-50 text-violet-700" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </Row>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={saveStartup} className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-lg">Save</button>
            </div>
          </section>
          {/* VERIFICATION */}
          <section ref={refs.verification} id="verification" className="border border-slate-200 bg-white rounded-xl p-6 scroll-mt-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Verification</h2>
            <p className="text-sm text-slate-500 mb-6">Verified founders see more matches and can receive prize money / equity grants.</p>

            <div className="space-y-6">
              {/* Social */}
              <div className="border border-slate-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-slate-900 mb-3">Social media</p>
                <div className="space-y-3">
                  {(["twitter", "linkedin", "personalSite"] as const).map((key) => {
                    const v = ver[key];
                    return (
                      <div key={key} className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700">{labelFor(key)}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {v.verified
                              ? (key === "twitter" ? (v as { handle: string }).handle : (v as { url: string }).url)
                              : "Not verified"}
                          </p>
                        </div>
                        {v.verified ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                              <Check className="w-3 h-3" /> Verified
                            </span>
                            <button type="button" onClick={() => flipSocial(key, false)} className="text-xs text-slate-500 hover:text-red-600">Unverify</button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => flipSocial(key, true)} className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50">Verify</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* GitHub */}
              <div className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Github className="w-5 h-5 text-slate-700" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">GitHub</p>
                      <p className="text-xs text-slate-500">{ver.github.verified ? `@${ver.github.username}` : "Verifies code ownership and contribution history."}</p>
                    </div>
                  </div>
                  {ver.github.verified ? (
                    <button type="button" onClick={disconnectGithub} className="text-xs text-red-600 hover:underline">Disconnect</button>
                  ) : (
                    <button type="button" onClick={() => setGithubDialogOpen(true)} className="text-xs px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-lg">Continue to GitHub →</button>
                  )}
                </div>
                {ver.github.verified && (
                  <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-slate-100 text-xs text-slate-600">
                    <div>1.2K followers</div>
                    <div>340 stars</div>
                    <div>top: techit-ai</div>
                    <div>last commit 2h ago</div>
                  </div>
                )}
              </div>

              {/* NIN */}
              <div className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Identity (NIN / passport)</p>
                    <p className="text-xs text-slate-500">Required for prize payouts and equity grants.</p>
                  </div>
                  {ver.nin.status === "verified" && (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                      <Check className="w-3 h-3" /> Verified
                    </span>
                  )}
                  {ver.nin.status === "pending" && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Under review</span>
                  )}
                </div>
                {ver.nin.status === "unverified" && (
                  <div className="space-y-3">
                    <Row label="Country">
                      <Input value={ver.nin.country} onChange={(v) => setVer((cur) => ({ ...cur, nin: { ...cur.nin, country: v } }))} />
                    </Row>
                    <Row label="Document type">
                      <div className="grid grid-cols-3 gap-2">
                        {(["nin", "passport", "driver-license"] as const).map((dt) => (
                          <button key={dt} type="button" onClick={() => setVer((cur) => ({ ...cur, nin: { ...cur.nin, docType: dt } }))}
                            className={`px-3 py-2 rounded-lg border text-sm capitalize ${ver.nin.docType === dt ? "border-violet-500 bg-violet-50 text-violet-700" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}>
                            {dt.replace(/-/g, " ")}
                          </button>
                        ))}
                      </div>
                    </Row>
                    <Row label="Document number">
                      <Input value={ver.nin.docNumber} onChange={(v) => setVer((cur) => ({ ...cur, nin: { ...cur.nin, docNumber: v } }))} />
                    </Row>
                    <button type="button" onClick={submitNin} className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-lg">
                      Submit for verification
                    </button>
                  </div>
                )}
                {ver.nin.status === "pending" && (
                  <p className="text-sm text-slate-600">Usually 1–3 business days. We'll notify you when it's done.</p>
                )}
              </div>
            </div>

            <Dialog open={githubDialogOpen} onOpenChange={setGithubDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Continue to GitHub</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-slate-600">
                  TechIT will request read access to your public profile and repositories to verify code ownership. This is a mock OAuth flow — no real authorization happens.
                </p>
                <DialogFooter>
                  <button type="button" onClick={() => setGithubDialogOpen(false)} className="px-4 py-2 text-sm rounded-lg border border-slate-300 hover:bg-slate-50">Cancel</button>
                  <button type="button" onClick={connectGithub} className="px-4 py-2 text-sm bg-slate-900 text-white hover:bg-slate-800 rounded-lg">Continue</button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </section>

          {/* NOTIFICATIONS */}
          <section ref={refs.notifications} id="notifications" className="border border-slate-200 bg-white rounded-xl p-6 scroll-mt-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Notifications</h2>
            <p className="text-sm text-slate-500 mb-6">When and how we tell you about things.</p>
            <div className="space-y-4">
              {([
                { k: "applications",  label: "Collaborator applications", desc: "Someone applied to one of your open roles." },
                { k: "investors",     label: "Investor activity",         desc: "Profile views, intro requests, term sheets." },
                { k: "workspace",     label: "Workspace activity",        desc: "PRs, deploys, daily standup summaries." },
                { k: "opportunities", label: "Hackathons & opportunities", desc: "New programs from organizations matching your stage." },
              ] as const).map((g) => (
                <div key={g.k} className="border border-slate-200 rounded-lg p-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{g.label}</p>
                    <p className="text-xs text-slate-500">{g.desc}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <label className="flex items-center gap-1.5 text-slate-700">
                      <input type="checkbox" checked={nPrefs[g.k].email} onChange={(e) => toggleNotif(g.k, "email", e.target.checked)} className="accent-violet-600" />
                      Email
                    </label>
                    <label className="flex items-center gap-1.5 text-slate-700">
                      <input type="checkbox" checked={nPrefs[g.k].inApp} onChange={(e) => toggleNotif(g.k, "inApp", e.target.checked)} className="accent-violet-600" />
                      In-app
                    </label>
                  </div>
                </div>
              ))}

              <div className="border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">Quiet hours</p>
                  <p className="text-xs text-slate-500">When to suppress notifications.</p>
                </div>
                <select value={nPrefs.quietHours} onChange={(e) => setNPrefs((cur) => ({ ...cur, quietHours: e.target.value as typeof cur.quietHours }))}
                  className="text-sm border border-slate-300 rounded-lg px-2 py-1.5 bg-white">
                  <option value="off">Off</option>
                  <option value="10pm-8am">10pm – 8am</option>
                  <option value="weekends">Weekends</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={saveNotifications} className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-lg">Save</button>
            </div>
          </section>

          {/* ROLES */}
          <section ref={refs.roles} id="roles" className="border border-slate-200 bg-white rounded-xl p-6 scroll-mt-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Roles & Switching</h2>
            <p className="text-sm text-slate-500 mb-6">Activate other roles or switch between the ones you have.</p>

            <div className="space-y-3">
              {(["founder", "collaborator", "investor", "org"] as Role[]).map((role) => {
                const active = activeRoles.has(role);
                const isCurrent = role === currentRole;
                return (
                  <div key={role} className={`flex items-center justify-between gap-4 border rounded-lg p-4 ${isCurrent ? "border-violet-300 bg-violet-50/50" : "border-slate-200 bg-white"}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{roleLabel[role]}</p>
                        {isCurrent && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-600 text-white">Current</span>}
                        {!isCurrent && active && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">Active</span>}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{roleBlurb[role]}</p>
                    </div>
                    {!isCurrent && (
                      <button type="button" onClick={() => handleRoleAction(role)}
                        className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 shrink-0">
                        {active ? "Switch to" : "Activate"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100">
              <button type="button" onClick={() => toast("Signed out (mock)")}
                className="text-sm text-red-600 hover:text-red-700 inline-flex items-center gap-1.5">
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ─── HELPERS ─────────────────────────────────────────────
function labelFor(key: "twitter" | "linkedin" | "personalSite"): string {
  if (key === "twitter") return "X / Twitter";
  if (key === "linkedin") return "LinkedIn";
  return "Personal site";
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-3 items-start">
      <label className="text-sm text-slate-700 font-medium md:pt-2">{label}</label>
      <div>{children}</div>
    </div>
  );
}

function Input({ value, onChange, type = "text", placeholder }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <input type={type} value={value} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 tabular-nums"
    />
  );
}

function Textarea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500" />
  );
}
