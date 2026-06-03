import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { useFounderProfile } from "@/contexts/UserContext";
import { StagePill, type StageState } from "./hackathon/StagePill";
import { DiscoverStage } from "./hackathon/DiscoverStage";
import { RegisterStage } from "./hackathon/RegisterStage";
import { BriefStage } from "./hackathon/BriefStage";
import { BuildStage } from "./hackathon/BuildStage";

type StageId = "discover" | "register" | "brief" | "build" | "submit";

const STAGES: { id: StageId; label: string }[] = [
  { id: "discover", label: "Discover" },
  { id: "register", label: "Register" },
  { id: "brief", label: "Submit Brief" },
  { id: "build", label: "Build" },
  { id: "submit", label: "Submit & Pitch" },
];

export function HackathonPanel() {
  const [searchParams, setSearchParams] = useSearchParams();
  const stageParam = searchParams.get("stage");
  const { founderProfile } = useFounderProfile();

  // Default to the most-recent registration when a founder has more than one.
  const regs = founderProfile.hackathonRegistrations;
  const reg = regs.length > 0 ? regs[regs.length - 1] : undefined;

  const activeStage: StageId = useMemo(() => {
    if (stageParam === "register") return "register";
    if (stageParam === "brief" || stageParam === "build" || stageParam === "submit") return stageParam;
    return "discover";
  }, [stageParam]);

  // Gating: Build requires a submitted brief. Redirect back to Brief otherwise.
  useEffect(() => {
    if (activeStage === "build" && reg && !reg.brief) {
      const next = new URLSearchParams(searchParams);
      next.set("panel", "hackathon");
      next.set("stage", "brief");
      setSearchParams(next, { replace: true });
      toast.error("Submit your brief first.");
    }
  }, [activeStage, reg, searchParams, setSearchParams]);

  const setStage = (id: StageId) => {
    const next = new URLSearchParams(searchParams);
    next.set("panel", "hackathon");
    next.set("stage", id);
    if (id === "discover") next.delete("stage");
    setSearchParams(next, { replace: true });
  };

  // StagePill state derives from the registration's stage.
  const pillState = (id: StageId): StageState => {
    if (id === activeStage) return "active";
    if (!reg) return "upcoming";
    const order: StageId[] = ["discover", "register", "brief", "build", "submit"];
    const reached: Record<typeof reg.stage, number> = {
      "registered": 1,        // discover + register done
      "submitted": 2,         // + brief done
      "building": 3,          // + build active
      "submitted-final": 4,   // + submit done
    };
    return order.indexOf(id) <= reached[reg.stage] ? "completed" : "upcoming";
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Hackathon</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse hackathons, register a team, and ship together.
        </p>
      </div>

      {/* Stage pill strip */}
      <div className="flex items-center gap-2 flex-wrap mb-6">
        {STAGES.map((stage, i) => (
          <div key={stage.id} className="flex items-center gap-2">
            <StagePill
              index={i + 1}
              label={stage.label}
              state={pillState(stage.id)}
              onClick={() => setStage(stage.id)}
            />
            {i < STAGES.length - 1 && (
              <span className="text-muted-foreground/50 text-xs">— — —</span>
            )}
          </div>
        ))}
      </div>

      {/* Stage content */}
      {activeStage === "discover" && <DiscoverStage />}
      {activeStage === "register" && <RegisterStage />}
      {activeStage === "brief" && (
        reg
          ? <BriefStage registration={reg} />
          : <NoTeam onRegister={() => setStage("register")} />
      )}
      {activeStage === "build" && (
        reg && reg.brief
          ? <BuildStage registration={reg} />
          : <NoTeam onRegister={() => setStage(reg ? "brief" : "register")} />
      )}
      {activeStage === "submit" && <ComingInPRD />}
    </div>
  );
}

function NoTeam({ onRegister }: { onRegister: () => void }) {
  return (
    <div className="border border-border bg-background rounded-xl p-12 flex flex-col items-center justify-center text-center">
      <h2 className="text-base font-semibold text-foreground mb-2">No team yet</h2>
      <p className="text-sm text-muted-foreground max-w-md mb-4">
        Register a team for a hackathon to submit an idea brief and start building.
      </p>
      <button
        type="button"
        onClick={onRegister}
        className="text-sm font-medium px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700"
      >
        Go to Register →
      </button>
    </div>
  );
}

function ComingInPRD() {
  return (
    <div className="border border-border bg-background rounded-xl p-12 flex flex-col items-center justify-center text-center">
      <div className="mb-4"><Send className="w-8 h-8 text-muted-foreground/50" /></div>
      <h2 className="text-base font-semibold text-foreground mb-2">Submit &amp; Pitch — coming in PR-D</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        Final submission and judging go live next. For now, submit your brief and log build check-ins in the earlier stages.
      </p>
    </div>
  );
}
