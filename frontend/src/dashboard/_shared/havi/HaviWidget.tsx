import { useRef, useState } from "react";
import { Bot, Sparkles, GripVertical } from "lucide-react";
import { motion, type PanInfo } from "motion/react";

export type HaviStatus = "idle" | "active" | "alert" | "celebration";

interface HaviWidgetProps {
  status: HaviStatus;
  daysRemaining: number;
  overdue: boolean;
  message: string;
  onOpen: () => void;
  /** Persisted starting offset {x, y} relative to bottom-right anchor. */
  position: { x: number; y: number };
  onPositionChange: (pos: { x: number; y: number }) => void;
}

const STATUS_STYLES: Record<HaviStatus, { ring: string; dot: string }> = {
  idle: { ring: "border-slate-300", dot: "bg-slate-400" },
  active: { ring: "border-cyan-400 shadow-lg shadow-cyan-200/50", dot: "bg-cyan-500" },
  alert: { ring: "border-amber-400 shadow-lg shadow-amber-200/50", dot: "bg-amber-500" },
  celebration: { ring: "border-purple-400 shadow-lg shadow-purple-200/50", dot: "bg-purple-500" },
};

export function HaviWidget({
  status,
  daysRemaining,
  overdue,
  message,
  onOpen,
  position,
  onPositionChange,
}: HaviWidgetProps) {
  const s = STATUS_STYLES[status];
  const draggedRef = useRef(false);

  const handleDragStart = () => {
    draggedRef.current = true;
  };

  const handleDragEnd = (_e: unknown, info: PanInfo) => {
    onPositionChange({ x: position.x + info.offset.x, y: position.y + info.offset.y });
    // Allow click again shortly after the drag settles.
    setTimeout(() => {
      draggedRef.current = false;
    }, 0);
  };

  const handleClick = () => {
    if (draggedRef.current) return; // ignore the click that ends a drag
    onOpen();
  };

  const countdownLabel = overdue
    ? `${Math.abs(daysRemaining)}d over`
    : daysRemaining === 0
    ? "MVP day"
    : `${daysRemaining}d to MVP`;

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0.04}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      initial={{ y: 80, opacity: 0 }}
      animate={{ x: position.x, y: position.y, opacity: 1 }}
      transition={{ type: "spring", damping: 22, stiffness: 220 }}
      className="fixed bottom-6 right-6 z-[120] cursor-grab active:cursor-grabbing select-none"
      style={{ touchAction: "none" }}
    >
      <button
        type="button"
        onClick={handleClick}
        className={`flex items-center gap-3 pl-2 pr-4 py-2.5 rounded-2xl border-2 bg-white ${s.ring} transition-all hover:scale-[1.03]`}
        aria-label="Open Havi"
      >
        {/* drag affordance */}
        <GripVertical className="w-4 h-4 text-slate-300 shrink-0" />

        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
            {status === "celebration" ? (
              <Sparkles className="w-5 h-5 text-white" />
            ) : (
              <Bot className="w-5 h-5 text-white" />
            )}
          </div>
          <span
            className={`absolute -top-0.5 -right-0.5 w-3 h-3 ${s.dot} rounded-full border-2 border-white`}
          />
        </div>

        <div className="flex flex-col items-start max-w-[180px] text-left">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
            Havi
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                overdue ? "bg-amber-100 text-amber-700" : "bg-cyan-100 text-cyan-700"
              }`}
            >
              {countdownLabel}
            </span>
          </span>
          <span className="text-xs text-slate-500 line-clamp-1">{message}</span>
        </div>
      </button>
    </motion.div>
  );
}
