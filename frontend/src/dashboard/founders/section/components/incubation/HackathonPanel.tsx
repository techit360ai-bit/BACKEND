import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Lightbulb, Hammer, Send } from "lucide-react";
import { StagePill } from "./hackathon/StagePill";
import { DiscoverStage } from "./hackathon/DiscoverStage";
import { RegisterStage } from "./hackathon/RegisterStage";

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

  const activeStage: StageId = useMemo(() => {
    if (stageParam === "register") return "register";
    if (stageParam === "brief" || stageParam === "build" || stageParam === "submit") return stageParam;
    return "discover";
  }, [stageParam]);

  const setStage = (id: StageId) => {
    const next = new URLSearchParams(searchParams);
    next.set("panel", "hackathon");
    next.set("stage", id);
    if (id === "discover") next.delete("stage");
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Hackathon</h1>
        <p className="text-sm text-slate-600 mt-1">
          Browse hackathons, register a team, and ship together.
        </p>
      </div>

      {/* Stage pill strip */}
      <div className="flex items-center gap-2 flex-wrap mb-6">
        {STAGES.map((stage, i) => {
          const state = stage.id === activeStage ? "active" : "upcoming";
          return (
            <div key={stage.id} className="flex items-center gap-2">
              <StagePill
                index={i + 1}
                label={stage.label}
                state={state}
                onClick={() => setStage(stage.id)}
              />
              {i < STAGES.length - 1 && (
                <span className="text-slate-300 text-xs">— — —</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Stage content */}
      {activeStage === "discover" && <DiscoverStage />}
      {activeStage === "register" && <RegisterStage />}
      {activeStage === "brief" && <ComingInPRC stage="Submit Brief" icon={<Lightbulb className="w-8 h-8 text-slate-300" />} />}
      {activeStage === "build" && <ComingInPRC stage="Build" icon={<Hammer className="w-8 h-8 text-slate-300" />} />}
      {activeStage === "submit" && <ComingInPRC stage="Submit & Pitch" icon={<Send className="w-8 h-8 text-slate-300" />} />}
    </div>
  );
}

function ComingInPRC({ stage, icon }: { stage: string; icon: React.ReactNode }) {
  return (
    <div className="border border-slate-200 bg-white rounded-xl p-12 flex flex-col items-center justify-center text-center">
      <div className="mb-4">{icon}</div>
      <h2 className="text-base font-semibold text-slate-700 mb-2">{stage} — coming in PR-C</h2>
      <p className="text-sm text-slate-500 max-w-md">
        The validation sprint, build phase, and submission flow go live next. For now, browse hackathons and register a team in the earlier stages.
      </p>
    </div>
  );
}
