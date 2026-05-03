import { useState } from "react";
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Eye,
  Menu,
  X,
} from "lucide-react";
import ChatSidebar from "@/components/chat/ChatSidebar";
import MomentumWall from "@/components/chat/MomentumWall";
import FeedPost from "@/components/chat/FeedPost";
import PostInput from "@/components/chat/PostInput";
import ChatTabs from "@/components/chat/ChatTabs";

interface Post {
  id: string;
  author: {
    name: string;
    role: string;
    avatar: string;
    initials: string;
    avatarColor: string;
  };
  timestamp: string;
  gsis: number;
  milestone?: string;
  type: "milestone" | "insight" | "problem" | "question" | "collab-call";
  title: string;
  description: string;
  tags?: string[];
  stats?: {
    label: string;
    value: string | number;
    color?: string;
  }[];
  engagement: {
    likes: number;
    comments: number;
    views?: number;
  };
  actions?: {
    label: string;
    href: string;
    color?: string;
  }[];
  lookingFor?: string;
  skillsNeeded?: string[];
  matchScore?: number;
  borderColor?: string;
}

const SAMPLE_POSTS: Post[] = [
  {
    id: "1",
    author: {
      name: "Adaeze Okonkwo",
      role: "Co-founder · HealthTech · MVP Stage",
      avatar: "AO",
      initials: "AO",
      avatarColor: "from-lime-400 to-lime-500",
    },
    timestamp: "2h ago",
    gsis: 68,
    milestone: "MILESTONE HIT",
    type: "milestone",
    title: "Shipped MVP — First 50 beta users onboarded across 3 clinics",
    description: "",
    tags: ["Idea", "Validation", "MVP", "+7 GSIS"],
    stats: [
      { label: "Beta Users", value: "50" },
      { label: "MRR", value: "$0" },
      { label: "GSIS Delta", value: "+7" },
      { label: "Days to Next", value: "14" },
    ],
    engagement: {
      likes: 23,
      comments: 6,
    },
    actions: [{ label: "View Build Log →", href: "#" }],
    borderColor: "border-l-4 border-green-500",
  },
  {
    id: "2",
    author: {
      name: "Kwame Mensah",
      role: "Co-founder · FinTech · Beta Stage · Lagos",
      avatar: "KM",
      initials: "KM",
      avatarColor: "from-blue-400 to-blue-500",
    },
    timestamp: "5h ago",
    gsis: 74,
    type: "insight",
    title:
      "Pricing lesson from 30 customer interviews in West Africa: Annual contracts closed 3x faster than monthly. Healthcare buyers want certainty, not flexibility.",
    description: "",
    tags: ["#pricing", "#b2b", "#healthtech"],
    engagement: {
      likes: 41,
      comments: 12,
    },
    borderColor: "border-l-4 border-blue-500",
  },
  {
    id: "3",
    author: {
      name: "Fatima Al-Hassan",
      role: "Co-founder · EdTech · Idea Stage",
      avatar: "FH",
      initials: "FH",
      avatarColor: "from-purple-400 to-purple-500",
    },
    timestamp: "1d ago",
    gsis: 61,
    type: "collab-call",
    title: "COLLAB CALL",
    description: "Looking for: Technical Co-founder",
    lookingFor: "Technical Co-founder",
    skillsNeeded: ["React", "Python", "Mobile"],
    matchScore: 82,
    engagement: {
      likes: 0,
      comments: 0,
    },
    actions: [{ label: "Express Interest", href: "#", color: "bg-purple-500" }],
    borderColor: "border-l-4 border-purple-500",
  },
  {
    id: "4",
    author: {
      name: "David Osei",
      role: "Founder · FinTech · Beta Stage",
      avatar: "DO",
      initials: "DO",
      avatarColor: "from-orange-400 to-orange-500",
    },
    timestamp: "3h ago",
    gsis: 79,
    type: "milestone",
    title: "BUILD UPDATE",
    description: "Platform Verified",
    stats: [
      { label: "Beta Users", value: "247" },
      { label: "MRR", value: "$3,200", color: "text-green-400" },
      { label: "Burn", value: "$4,100", color: "text-red-400" },
      { label: "Runway", value: "8mo", color: "text-yellow-400" },
    ],
    engagement: {
      likes: 67,
      comments: 14,
    },
    actions: [{ label: "See full Build Log", href: "#" }],
    borderColor: "border-l-4 border-orange-500",
  },
  {
    id: "5",
    author: {
      name: "Chioma Eze",
      role: "Founder · AgriTech · Validation Stage",
      avatar: "CE",
      initials: "CE",
      avatarColor: "from-pink-400 to-pink-500",
    },
    timestamp: "8h ago",
    gsis: 72,
    type: "question",
    title:
      "How do you validate demand in rural markets with limited internet access?",
    description: "",
    tags: ["Stage: Validation", "Industry: AgriTech", "Stack: React/Node.js"],
    engagement: {
      likes: 0,
      comments: 8,
    },
    actions: [
      { label: "AI routing to 3 experts", href: "#", color: "text-purple-400" },
      { label: "Answer this question →", href: "#", color: "text-pink-400" },
    ],
    borderColor: "border-l-4 border-pink-500",
  },
  {
    id: "6",
    author: {
      name: "Rural maternal mortality rate 3x urban average in West Africa",
      role: "West Africa · Health",
      avatar: "PS",
      initials: "PS",
      avatarColor: "from-red-400 to-red-500",
    },
    timestamp: "Discussion active",
    gsis: 0,
    type: "problem",
    title: "Rural maternal mortality rate 3x urban average in West Africa",
    description: "",
    stats: [
      { label: "Impact Score", value: "75/100", color: "text-green-400" },
    ],
    engagement: {
      likes: 18,
      comments: 23,
    },
    actions: [
      { label: "Explore Solutions →", href: "#", color: "text-blue-400" },
      { label: "Join Discussion", href: "#" },
    ],
    borderColor: "border-l-4 border-red-500",
  },
];

const Chat = () => {
  const [activeTab, setActiveTab] = useState("Global Pulse");
  const [filteredPosts, setFilteredPosts] = useState(SAMPLE_POSTS);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [momentumOpen, setMomentumOpen] = useState(false);

  return (
    <div className="min-h-screen w-full flex items-start justify-between gap-4 lg:gap-6 bg-slate-950 dark:bg-slate-950 text-white px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6">
      {/* Mobile Sidebar Toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden absolute top-4 left-4 z-50 p-2 hover:bg-slate-800 rounded-lg"
      >
        {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <div
        className={`fixed lg:sticky lg:top-4 left-0 top-0 w-64 xl:w-72 shrink-0 h-screen lg:h-auto z-40 lg:z-auto transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <ChatSidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main Feed — centred between the two sidebars */}
      <main className="flex-1 max-w-2xl w-full mx-auto mt-12 lg:mt-0">
        <ChatTabs activeTab={activeTab} onTabChange={setActiveTab} />
        <PostInput />
        <div className="space-y-4 mt-6">
          {filteredPosts.map((post) => (
            <FeedPost key={post.id} post={post} />
          ))}
        </div>
      </main>

      {/* Right Sidebar — Momentum Wall, anchored to the right edge */}
      <div className="hidden lg:block w-64 xl:w-72 shrink-0 sticky top-4 self-start">
        <MomentumWall />
      </div>

      {/* Mobile Momentum Toggle */}
      <button
        onClick={() => setMomentumOpen(!momentumOpen)}
        className="lg:hidden fixed bottom-6 right-6 z-40 p-3 bg-cyan-500 hover:bg-cyan-600 rounded-full text-white shadow-lg"
      >
        📊
      </button>

      {/* Mobile Momentum Overlay */}
      {momentumOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setMomentumOpen(false)}
          />
          <div className="lg:hidden fixed bottom-20 right-4 bg-slate-900 border border-slate-800 rounded-xl p-4 w-80 max-h-96 overflow-y-auto z-50 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white">Your Momentum Wall</h3>
              <button
                onClick={() => setMomentumOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <MomentumWall />
          </div>
        </>
      )}
    </div>
  );
};

export default Chat;
