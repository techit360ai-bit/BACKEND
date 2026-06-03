// Data model for Havi — the AI tour guide for founders & collaborators.
// Adapted from the "AI Tour Guide Setup" design. Where the source tracked a
// fixed 12-week tour, Havi tracks each user's personal "time to MVP".

export type HaviRole = "founder" | "collaborator";

export type PersonalityMode = "supportive" | "coach" | "strict" | "founder";

export interface HaviTask {
  id: string;
  title: string;
  completed: boolean;
  estimatedMinutes: number;
}

export const personalityModes: Record<
  PersonalityMode,
  { name: string; description: string; emoji: string }
> = {
  supportive: { name: "Supportive", description: "Gentle nudges and encouragement", emoji: "🟢" },
  coach: { name: "Coach", description: "Balanced accountability", emoji: "🔵" },
  strict: { name: "Strict", description: "Deadlines enforced", emoji: "🔴" },
  founder: { name: "Founder Mode", description: "Blunt, execution-focused", emoji: "🟣" },
};

// ─── Default day plans per role ──────────────────────────────────────────────

export const founderTasks: HaviTask[] = [
  { id: "f1", title: "Finalize problem statement", completed: false, estimatedMinutes: 45 },
  { id: "f2", title: "Draft solution outline", completed: false, estimatedMinutes: 90 },
  { id: "f3", title: "Research competitor landscape", completed: false, estimatedMinutes: 60 },
  { id: "f4", title: "Update build feed with progress", completed: false, estimatedMinutes: 15 },
];

export const collaboratorTasks: HaviTask[] = [
  { id: "c1", title: "Clear your top sprint task", completed: false, estimatedMinutes: 90 },
  { id: "c2", title: "Review an open pull request", completed: false, estimatedMinutes: 30 },
  { id: "c3", title: "Post a standup update", completed: false, estimatedMinutes: 15 },
  { id: "c4", title: "Sync blockers with the founder", completed: false, estimatedMinutes: 20 },
];

export function getDefaultTasks(role: HaviRole): HaviTask[] {
  return role === "founder" ? founderTasks : collaboratorTasks;
}

// ─── Greeting / nudge copy (Havi voice) ──────────────────────────────────────

export const haviMessages = {
  welcomeFounder:
    "Hi, I'm Havi — your build companion. I'll track your time to MVP, keep your momentum honest, and point you to the right next move. Let's set your MVP target and get going.",
  welcomeCollaborator:
    "Hi, I'm Havi — your build companion. I'll keep your sprints on track, watch your momentum, and surface the next best action. Let's lock your MVP target for this build.",
  momentumCheck: "You're building momentum. Keep the streak alive.",
  celebration: "Milestone hit. Momentum is compounding. 🎉",
  idle: "You've been quiet for a bit. Want to resume, reschedule, or take a break?",
  riskRevising:
    "You've been revising instead of shipping. That's a classic stall point — want to lock scope and move forward?",
};

// Scripted quick-reply answers for the "Ask Havi" chat (mock — no backend).
export interface QuickReply {
  q: string;
  a: string;
}

export const founderQuickReplies: QuickReply[] = [
  {
    q: "Am I on track for my MVP?",
    a: "Based on your momentum and remaining days, you're tracking close to your MVP date. Protect 2 deep-work blocks this week and you'll stay on pace.",
  },
  {
    q: "What should I focus on next?",
    a: "Your highest-leverage move right now is finalizing the problem statement — everything downstream (solution, MVP scope) depends on it being sharp.",
  },
  {
    q: "How do I improve my momentum score?",
    a: "Momentum rewards consistency over bursts. Ship one small visible thing daily and log it in your build feed — that compounds faster than occasional big pushes.",
  },
  {
    q: "Where do I learn this?",
    a: "Head to TechIT Academy — your Founder track has lessons mapped to exactly this stage. I can take you there from the panel.",
  },
];

export const collaboratorQuickReplies: QuickReply[] = [
  {
    q: "What should I work on next?",
    a: "Clear your highest-impact sprint task first, then review the open PR. Unblocking the founder early keeps the whole build moving.",
  },
  {
    q: "Am I keeping pace with the build?",
    a: "Your sprint velocity is steady. If you close today's tasks you'll stay ahead of the MVP target. Flag any blockers early so they don't compound.",
  },
  {
    q: "How is momentum scored?",
    a: "Momentum tracks consistent shipping — merged PRs, closed tasks, standups. Small daily progress beats occasional big drops.",
  },
  {
    q: "Where do I learn this?",
    a: "Your Collaborator track in TechIT Academy covers this. I can open it for you from the panel.",
  },
];

export function getQuickReplies(role: HaviRole): QuickReply[] {
  return role === "founder" ? founderQuickReplies : collaboratorQuickReplies;
}

// Fallback for free-text questions (mock).
export function haviAnswer(role: HaviRole, question: string): string {
  const replies = getQuickReplies(role);
  const lower = question.toLowerCase();
  const match = replies.find((r) =>
    r.q
      .toLowerCase()
      .split(" ")
      .filter((w) => w.length > 4)
      .some((w) => lower.includes(w)),
  );
  if (match) return match.a;
  if (lower.includes("mvp") || lower.includes("time") || lower.includes("when")) {
    return "Your time-to-MVP is driven by momentum and remaining days. Keep shipping daily and I'll keep the estimate honest — you can also adjust your target date in Edit choices.";
  }
  if (lower.includes("academy") || lower.includes("learn") || lower.includes("course")) {
    return "TechIT Academy has lessons tailored to your track and stage. Open it from the panel and I'll meet you there.";
  }
  return "Good question. The short version: focus on the one task that unblocks the most downstream work, ship it today, and log it. Want me to point you to the relevant Academy lesson?";
}
