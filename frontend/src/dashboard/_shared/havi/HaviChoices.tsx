import { useState } from "react";
import { Target, User, Clock, Check } from "lucide-react";
import { motion } from "motion/react";
import { personalityModes, type PersonalityMode } from "./haviData";
import type { MvpPlan } from "./mvpEstimate";

interface HaviChoicesProps {
  plan: MvpPlan;
  personality: PersonalityMode;
  onPersonalityChange: (m: PersonalityMode) => void;
  onTargetDateChange: (date: string) => void;
}

export function HaviChoices({
  plan,
  personality,
  onPersonalityChange,
  onTargetDateChange,
}: HaviChoicesProps) {
  const [dateDraft, setDateDraft] = useState(plan.targetDate);
  const [saved, setSaved] = useState(false);

  const saveDate = () => {
    onTargetDateChange(dateDraft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-8">
      <p className="text-sm text-slate-600">
        Edit the choices you made earlier — Havi adapts to whatever you set here.
      </p>

      {/* MVP target date */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-cyan-600" />
          <h3 className="font-semibold text-slate-900">Your MVP target date</h3>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          {plan.userSet
            ? "You set this date. Change it any time."
            : "Estimated from your stage. Set your own to make it personal."}
        </p>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateDraft}
            onChange={(e) => setDateDraft(e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <button
            onClick={saveDate}
            className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-500 transition-colors flex items-center gap-1.5"
          >
            {saved ? <Check className="w-4 h-4" /> : null}
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      </div>

      {/* Personality mode */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <User className="w-4 h-4 text-slate-600" />
          <h3 className="font-semibold text-slate-900">How Havi talks to you</h3>
        </div>
        <div className="grid gap-2.5">
          {(Object.keys(personalityModes) as PersonalityMode[]).map((mode) => {
            const info = personalityModes[mode];
            const isSelected = personality === mode;
            return (
              <motion.button
                key={mode}
                onClick={() => onPersonalityChange(mode)}
                whileTap={{ scale: 0.98 }}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  isSelected ? "border-cyan-500 bg-cyan-50" : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h4 className={`text-sm font-semibold ${isSelected ? "text-cyan-700" : "text-slate-900"}`}>
                    {info.emoji} {info.name}
                  </h4>
                  {isSelected && <Check className="w-4 h-4 text-cyan-600" />}
                </div>
                <p className="text-xs text-slate-600 mt-0.5">{info.description}</p>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Working hours */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-slate-600" />
          <h3 className="font-semibold text-slate-900">When Havi nudges you</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Start</label>
            <input
              type="time"
              defaultValue="09:00"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">End</label>
            <input
              type="time"
              defaultValue="17:00"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-2">Havi only sends reminders during these hours.</p>
      </div>
    </div>
  );
}
