import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOrgProfile } from "@/contexts/UserContext";
import { OrgProgressBar } from "./OrgProgressBar";
import { Building2, MapPin, Globe, Hash, Calendar } from "lucide-react";

const orgTypes = [
  "Accelerator",
  "Incubator",
  "University",
  "Innovation Hub",
  "Corporate",
  "Foundation",
  "Government Agency",
  "Non-profit",
];

export function OrgStep1() {
  const navigate = useNavigate();
  const { orgProfile, updateOrgProfile } = useOrgProfile();
  const [orgName, setOrgName] = useState(orgProfile.orgName);
  const [orgType, setOrgType] = useState(orgProfile.orgType);
  const [location, setLocation] = useState(orgProfile.location);
  const [registrationNumber, setRegistrationNumber] = useState(
    orgProfile.registrationNumber,
  );
  const [foundingYear, setFoundingYear] = useState(orgProfile.foundingYear);
  const [website, setWebsite] = useState(orgProfile.website);

  const handleNext = () => {
    updateOrgProfile({
      orgName,
      orgType,
      location,
      registrationNumber,
      foundingYear,
      website,
    });
    navigate("/org/onboarding/step-2");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900/80 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-3xl">
        <OrgProgressBar currentStep={1} totalSteps={5} />

        <div className="mb-10">
          <h1 className="text-4xl font-bold text-foreground dark:text-white tracking-tight mb-2">
            Organisation Identity
          </h1>
          <p className="text-base text-muted-foreground dark:text-muted-foreground/70">
            Tell us about your organisation so TechIT can serve the right
            builders and partners.
          </p>
        </div>

        <div className="space-y-7">
          <Field label="Organisation name" icon={Building2}>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="e.g. Lagos Innovation Hub"
              className="w-full h-14 bg-background dark:bg-card/60 border-2 border-border dark:border-border rounded-xl px-5 text-base text-foreground dark:text-white outline-none focus:border-indigo-500 transition-colors"
            />
          </Field>

          <div>
            <label className="block mb-3 text-foreground dark:text-white font-semibold">
              Organisation type
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {orgTypes.map((t) => (
                <button
                  key={t}
                  onClick={() => setOrgType(t)}
                  className={`px-4 py-3 rounded-xl border-2 transition-all text-sm font-semibold ${
                    orgType === t
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                      : "border-border dark:border-border bg-background dark:bg-card/40 text-foreground dark:text-muted-foreground/50 hover:border-indigo-300"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Headquarters" icon={MapPin}>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, country"
                className="w-full h-14 bg-background dark:bg-card/60 border-2 border-border dark:border-border rounded-xl px-5 text-base text-foreground dark:text-white outline-none focus:border-indigo-500 transition-colors"
              />
            </Field>
            <Field label="Website" icon={Globe}>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://"
                className="w-full h-14 bg-background dark:bg-card/60 border-2 border-border dark:border-border rounded-xl px-5 text-base text-foreground dark:text-white outline-none focus:border-indigo-500 transition-colors"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Registration number" icon={Hash}>
              <input
                type="text"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                placeholder="Government-issued ID"
                className="w-full h-14 bg-background dark:bg-card/60 border-2 border-border dark:border-border rounded-xl px-5 text-base text-foreground dark:text-white outline-none focus:border-indigo-500 transition-colors"
              />
            </Field>
            <Field label="Founding year" icon={Calendar}>
              <input
                type="number"
                value={foundingYear || ""}
                onChange={(e) =>
                  setFoundingYear(parseInt(e.target.value) || 0)
                }
                min={1900}
                max={new Date().getFullYear()}
                placeholder="e.g. 2018"
                className="w-full h-14 bg-background dark:bg-card/60 border-2 border-border dark:border-border rounded-xl px-5 text-base text-foreground dark:text-white outline-none focus:border-indigo-500 transition-colors"
              />
            </Field>
          </div>
        </div>

        <div className="mt-12 flex justify-end">
          <button
            onClick={handleNext}
            disabled={!orgName.trim() || !orgType || !location.trim()}
            className="px-10 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: typeof Building2;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-2 mb-3 text-foreground dark:text-white font-semibold">
        <Icon className="w-4 h-4 text-indigo-500" />
        {label}
      </label>
      {children}
    </div>
  );
}
