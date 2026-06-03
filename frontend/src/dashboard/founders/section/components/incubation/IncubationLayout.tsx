import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Brain, Trophy, GraduationCap } from "lucide-react";
import { useFounderProfile } from "@/contexts/UserContext";
import { MainIncubationPanel } from "./MainIncubationPanel";
import { HackathonPanel } from "./HackathonPanel";
import { Academy } from "@/dashboard/_shared/academy/Academy";

type Panel = "main" | "hackathon" | "learn";

export default function IncubationLayout() {
  const [searchParams] = useSearchParams();
  const initialPanel: Panel =
    searchParams.get("panel") === "hackathon"
      ? "hackathon"
      : searchParams.get("panel") === "learn"
      ? "learn"
      : "main";
  const [panel, setPanel] = useState<Panel>(initialPanel);

  const { founderProfile } = useFounderProfile();
  const registrationCount = useMemo(
    () => founderProfile.hackathonRegistrations.length,
    [founderProfile.hackathonRegistrations.length],
  );

  return (
    <div className="flex h-full min-h-[calc(100vh-3.5rem)]">
      <aside className="w-16 shrink-0 bg-white border-r border-slate-200 flex flex-col items-stretch py-4 gap-2">
        <SidebarPill
          label="Main"
          icon={<Brain className="w-5 h-5" />}
          active={panel === "main"}
          onClick={() => setPanel("main")}
        />
        <SidebarPill
          label="Hack"
          icon={<Trophy className="w-5 h-5" />}
          active={panel === "hackathon"}
          onClick={() => setPanel("hackathon")}
          badge={registrationCount > 0 ? registrationCount : undefined}
        />
        <SidebarPill
          label="Learn"
          icon={<GraduationCap className="w-5 h-5" />}
          active={panel === "learn"}
          onClick={() => setPanel("learn")}
        />
      </aside>
      <div className="flex-1 min-w-0">
        {panel === "main" && <MainIncubationPanel />}
        {panel === "hackathon" && <HackathonPanel />}
        {panel === "learn" && <Academy role="founder" userName={founderProfile.name.split(" ")[0]} />}
      </div>
    </div>
  );
}

function SidebarPill({
  label,
  icon,
  active,
  badge,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-center gap-1 py-3 mx-2 rounded-lg text-[10px] font-medium uppercase tracking-wider transition ${
        active
          ? "border-l-2 border-violet-500 bg-violet-50 text-violet-700"
          : "text-slate-600 hover:bg-slate-50"
      }`}
      aria-pressed={active}
      aria-label={label}
    >
      {icon}
      <span>{label}</span>
      {badge !== undefined && (
        <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );
}
