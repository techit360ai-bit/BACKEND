// Shared TechIT Academy curriculum data.
// Ported from the "TechIT Training Ecosystem" design.
// Role mapping in this app: founder → founder track, collaborator → builder track.

export type AcademyRole = "founder" | "collaborator";
export type BadgeCategory = "founder" | "collaborator";

export interface Lesson {
  week: number;
  title: string;
  subtitle: string;
  duration: string;
  keyInsight: string;
  learnings: string[];
  task: {
    title: string;
    items: string[];
  };
  reflectionQuestion: string;
}

export interface AcademyBadge {
  id: string;
  name: string;
  description: string;
  level?: number;
  category: BadgeCategory;
}

export const founderCurriculum: Lesson[] = [
  {
    week: 1,
    title: "Founder Mindset in the AI Age",
    subtitle: "Thinking in Systems, Not Ideas",
    duration: "20-30 mins",
    keyInsight:
      "Ideas are cheap. Coordination is rare. Your job as a founder is not inspiration — it's alignment.",
    learnings: [
      "Why most startups fail before building",
      "The difference between ideas and systems",
      "How AI changes founder leverage",
    ],
    task: {
      title: "Define Your Foundation",
      items: [
        "Write your problem statement in one sentence",
        "Define who feels the pain the most",
      ],
    },
    reflectionQuestion: "What would make this startup inevitable, not just possible?",
  },
  {
    week: 2,
    title: "Problem Discovery",
    subtitle: "Fall in Love With the Problem",
    duration: "25-35 mins",
    keyInsight: "If users don't feel the pain, no amount of tech will save you.",
    learnings: [
      "User interviews that reveal truth",
      "Jobs-to-be-done thinking",
      "False positives in validation",
    ],
    task: {
      title: "Test Your Assumptions",
      items: [
        "Describe your top 3 assumptions",
        "Mark which are untested",
        "Schedule 3 user interviews",
      ],
    },
    reflectionQuestion: "What would prove you wrong?",
  },
  {
    week: 3,
    title: "Solution Design",
    subtitle: "Building Only What Matters",
    duration: "20-30 mins",
    keyInsight: "Your MVP is not the product. It's the question.",
    learnings: [
      "MVP vs MLP (Minimum Lovable Product)",
      "Feature prioritization frameworks",
      "Technical debt you can afford",
    ],
    task: {
      title: "Scope Your MVP",
      items: [
        "Define your MVP in one sentence",
        "Remove one unnecessary feature",
        "Identify your riskiest assumption",
      ],
    },
    reflectionQuestion: "What's the smallest thing you can build to learn the most?",
  },
  {
    week: 4,
    title: "Market & Positioning",
    subtitle: "Who This Is REALLY For",
    duration: "25-35 mins",
    keyInsight: "If you try to serve everyone, no one will care.",
    learnings: [
      "ICP definition beyond demographics",
      "Positioning in crowded markets",
      "Africa vs Global market nuances",
    ],
    task: {
      title: "Define Your Market",
      items: [
        "Define your ICP with painful specificity",
        "Write a one-line positioning statement",
        "Identify your first 10 customers",
      ],
    },
    reflectionQuestion: "Who would be devastated if this didn't exist?",
  },
  {
    week: 5,
    title: "Business Models That Survive",
    subtitle: "Money Is Design",
    duration: "30-40 mins",
    keyInsight:
      "Revenue models are not spreadsheets. They're strategic choices about who you serve and how.",
    learnings: [
      "SaaS, marketplace, and hybrid models",
      "Unit economics fundamentals",
      "Pricing psychology",
    ],
    task: {
      title: "Design Your Economics",
      items: [
        "Choose a primary revenue stream",
        "Identify pricing risks",
        "Calculate your unit economics",
      ],
    },
    reflectionQuestion: "What would make this profitable at scale?",
  },
  {
    week: 6,
    title: "Building With Teams",
    subtitle: "Equity, Incentives & Trust",
    duration: "25-35 mins",
    keyInsight: "Most teams implode not because of bad ideas, but bad agreements.",
    learnings: [
      "Equity psychology and fairness",
      "Vesting schedules explained",
      "Remote-first team dynamics",
    ],
    task: {
      title: "Structure Your Team",
      items: [
        "Define equity expectations clearly",
        "Draft founder/collaborator agreements",
        "Invite collaborators through platform",
      ],
    },
    reflectionQuestion: "What happens if someone leaves in 6 months?",
  },
  {
    week: 7,
    title: "Execution Systems",
    subtitle: "How Great Teams Ship",
    duration: "20-30 mins",
    keyInsight: "Execution beats strategy when strategy doesn't ship.",
    learnings: [
      "Sprint methodology for startups",
      "Decision velocity frameworks",
      "Shipping culture principles",
    ],
    task: {
      title: "Build Your Rhythm",
      items: [
        "Create your first sprint plan",
        "Assign ownership clearly",
        "Define your weekly sync cadence",
      ],
    },
    reflectionQuestion: "What would make your team unstoppable?",
  },
  {
    week: 8,
    title: "Traction & Growth Signals",
    subtitle: "What Investors Actually Look For",
    duration: "30-40 mins",
    keyInsight: "Vanity metrics look good. Traction metrics predict the future.",
    learnings: [
      "Signal vs noise in metrics",
      "Growth loops and compounding",
      "Founder-led growth strategies",
    ],
    task: {
      title: "Track What Matters",
      items: [
        "Define one north star metric",
        "Track weekly change",
        "Identify your growth loop",
      ],
    },
    reflectionQuestion: "What metric would make investors lean in?",
  },
  {
    week: 9,
    title: "Fundraising Reality",
    subtitle: "Capital Is Fuel, Not Validation",
    duration: "35-45 mins",
    keyInsight: "The best time to raise is when you don't need to.",
    learnings: [
      "When NOT to raise",
      "Grants vs Angels vs VCs",
      "Investor psychology in 2026+",
    ],
    task: {
      title: "Plan Your Capital",
      items: [
        "Write your funding narrative",
        "Choose your funding path",
        "Build your investor pipeline",
      ],
    },
    reflectionQuestion: "What would you do differently with no funding constraints?",
  },
  {
    week: 10,
    title: "Legal & IP Protection",
    subtitle: "Protecting the Thing You're Building",
    duration: "25-35 mins",
    keyInsight: "Protect what matters. Ignore paranoia.",
    learnings: [
      "Founder agreements essentials",
      "IP ownership basics",
      "Ethical AI and trust",
    ],
    task: {
      title: "Secure Your Foundation",
      items: [
        "Choose IP protection strategy",
        "Review and sign founder agreements",
        "Document your tech stack",
      ],
    },
    reflectionQuestion: "What could destroy this company legally?",
  },
  {
    week: 11,
    title: "Market Readiness",
    subtitle: "From MVP to Market",
    duration: "30-40 mins",
    keyInsight: "Launch is not an event. It's a process.",
    learnings: [
      "Launch strategy frameworks",
      "Community-led launches",
      "Narrative building",
    ],
    task: {
      title: "Prepare for Launch",
      items: [
        "Create launch checklist",
        "Complete risk review",
        "Build your launch story",
      ],
    },
    reflectionQuestion: "What would make people talk about this?",
  },
  {
    week: 12,
    title: "Demo & Scale",
    subtitle: "From Startup to Company",
    duration: "40-50 mins",
    keyInsight: "Demo day is day one, not the finish line.",
    learnings: [
      "Pitching without hype",
      "Scaling without collapse",
      "Building for longevity",
    ],
    task: {
      title: "Present Your Journey",
      items: [
        "Prepare demo presentation",
        "Publish build feed update",
        "Define your next 90 days",
      ],
    },
    reflectionQuestion: "What did you learn that you can't unlearn?",
  },
];

// Collaborator track (the "builder" track in the source design).
export const collaboratorCurriculum: Lesson[] = [
  {
    week: 1,
    title: "Building for Startups vs Enterprises",
    subtitle: "Speed vs Perfection",
    duration: "20-30 mins",
    keyInsight:
      "In startups, perfect code that ships late is worse than good code that ships now.",
    learnings: [
      "Why most engineers fail in startups",
      "Context switching mastery",
      "Technical decisions under constraints",
    ],
    task: {
      title: "Shift Your Mindset",
      items: [
        "Identify one area where you over-engineer",
        "Define your shipping cadence",
      ],
    },
    reflectionQuestion: "What would you build differently if time was the constraint?",
  },
  {
    week: 2,
    title: "Equity, Ownership & Risk",
    subtitle: "How Equity Actually Pays Out",
    duration: "25-35 mins",
    keyInsight:
      "Equity is worthless until it's not. Understanding the math prevents heartbreak.",
    learnings: [
      "How equity payouts actually work",
      "Vesting realities and cliffs",
      "How to evaluate founders",
    ],
    task: {
      title: "Know Your Worth",
      items: [
        "Calculate your equity value in different exit scenarios",
        "Review vesting terms",
      ],
    },
    reflectionQuestion: "What would make this equity actually valuable?",
  },
  {
    week: 3,
    title: "AI-Augmented Building",
    subtitle: "Using AI as a Force Multiplier",
    duration: "20-30 mins",
    keyInsight:
      "AI doesn't replace builders. It separates 10x engineers from 1x engineers.",
    learnings: [
      "Prompt engineering for developers",
      "AI tools that actually work",
      "Automation-first mindset",
    ],
    task: {
      title: "Multiply Your Output",
      items: [
        "Integrate one AI tool into your workflow",
        "Document one automated process",
      ],
    },
    reflectionQuestion: "What could you automate that you're doing manually?",
  },
];

export const badges: AcademyBadge[] = [
  {
    id: "founder-certified-1",
    name: "Certified Startup Founder",
    description: "Completed foundational startup training",
    level: 1,
    category: "founder",
  },
  {
    id: "founder-certified-2",
    name: "Certified Startup Founder",
    description: "Advanced execution and traction",
    level: 2,
    category: "founder",
  },
  {
    id: "founder-certified-3",
    name: "Certified Startup Founder",
    description: "Market-ready and investor-verified",
    level: 3,
    category: "founder",
  },
  {
    id: "market-ready",
    name: "Market-Ready Founder",
    description: "Completed all pre-launch requirements",
    category: "founder",
  },
  {
    id: "investor-verified",
    name: "Investor-Verified Startup",
    description: "Vetted by active investors on the platform",
    category: "founder",
  },
  {
    id: "verified-collaborator",
    name: "Verified Collaborator",
    description: "Proven track record in startup execution",
    category: "collaborator",
  },
  {
    id: "github-backed",
    name: "GitHub-Backed Engineer",
    description: "Verified technical contributions",
    category: "collaborator",
  },
  {
    id: "sprint-completion",
    name: "Sprint Completion Badge",
    description: "Consistently delivers on sprint commitments",
    category: "collaborator",
  },
];

export function getCurriculum(role: AcademyRole): Lesson[] {
  return role === "founder" ? founderCurriculum : collaboratorCurriculum;
}

export function getBadges(role: AcademyRole): AcademyBadge[] {
  return badges.filter((b) => b.category === role);
}
