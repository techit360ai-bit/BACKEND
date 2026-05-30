import { Check } from "lucide-react";

export type StageState = "active" | "completed" | "upcoming";

export function StagePill({
  index,
  label,
  state,
  onClick,
  compact = false,
}: {
  index: number;
  label: string;
  state: StageState;
  onClick?: () => void;
  compact?: boolean;
}) {
  const styles =
    state === "active"
      ? "border-violet-500 bg-violet-50 text-violet-700"
      : state === "completed"
      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
      : "border-slate-200 bg-white text-slate-500";

  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`flex items-center gap-2 border rounded-full ${
        compact ? "px-3 py-1 text-xs" : "px-4 py-2 text-sm"
      } font-medium transition ${styles} ${onClick ? "hover:brightness-95 cursor-pointer" : ""}`}
      aria-current={state === "active" ? "step" : undefined}
    >
      <span
        className={`flex items-center justify-center rounded-full ${
          compact ? "w-4 h-4 text-[10px]" : "w-5 h-5 text-xs"
        } font-semibold ${
          state === "completed" ? "bg-emerald-500 text-white" : state === "active" ? "bg-violet-500 text-white" : "bg-slate-100 text-slate-500"
        }`}
      >
        {state === "completed" ? <Check className="w-3 h-3" /> : index}
      </span>
      <span>{label}</span>
    </Tag>
  );
}
