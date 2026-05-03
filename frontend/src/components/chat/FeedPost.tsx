import { Heart, MessageCircle, Share2, Eye, Sparkles } from "lucide-react";

interface PostProps {
  post: {
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
  };
}

const FeedPost = ({ post }: PostProps) => {
  const getBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      milestone: "bg-green-500/20 text-green-300",
      insight: "bg-blue-500/20 text-blue-300",
      problem: "bg-red-500/20 text-red-300",
      question: "bg-purple-500/20 text-purple-300",
      "collab-call": "bg-purple-500/20 text-purple-300",
    };
    return colors[type] || "bg-slate-500/20 text-slate-300";
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      milestone: "MILESTONE HIT",
      insight: "INSIGHT",
      problem: "AI DISCOVERED",
      question: "QUESTION",
      "collab-call": "COLLAB CALL",
    };
    return labels[type] || "";
  };

  return (
    <div
      className={`bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 hover:border-slate-700 transition-colors ${
        post.borderColor || ""
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3 min-w-0">
          {/* Avatar */}
          <div
            className={`w-12 h-12 rounded-full bg-linear-to-br ${post.author.avatarColor} shrink-0 flex items-center justify-center font-bold text-white text-lg`}
          />

          {/* Author Info */}
          <div className="min-w-0">
            <p className="font-semibold text-white truncate">
              {post.author.name}
            </p>
            <p className="text-xs text-slate-400 truncate">
              {post.author.role}
            </p>
          </div>
        </div>

        {/* GSIS Badge */}
        {post.gsis > 0 && (
          <div className="shrink-0 px-3 py-1 bg-slate-800 border border-slate-700 rounded-lg">
            <span className="text-xs font-semibold text-slate-300">
              GSIS {post.gsis}
            </span>
          </div>
        )}
      </div>

      {/* Type Badge & Timestamp */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {post.milestone && (
            <span
              className={`text-xs font-bold px-2 py-1 rounded ${getBadgeColor(post.type)}`}
            >
              {getTypeLabel(post.type)}
            </span>
          )}
        </div>
        <span className="text-xs text-slate-500">{post.timestamp}</span>
      </div>

      {/* Title/Main Content */}
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-white leading-snug">
          {post.title}
        </h3>

        {/* Looking for (Collab Call) */}
        {post.lookingFor && (
          <div className="space-y-2 pt-2">
            <p className="text-sm text-slate-400">Looking for:</p>
            <div className="inline-block px-3 py-1.5 border border-purple-500/30 rounded-full text-sm text-purple-300">
              {post.lookingFor}
            </div>

            {post.skillsNeeded && (
              <div>
                <p className="text-sm text-slate-400 mb-2">Skills needed:</p>
                <div className="flex gap-2 flex-wrap">
                  {post.skillsNeeded.map((skill, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-1 bg-slate-800 text-slate-300 rounded"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {post.matchScore && (
              <div className="pt-2">
                <p className="text-sm text-slate-400 mb-2">Your match:</p>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-linear-to-r from-green-500 to-emerald-500"
                    style={{ width: `${post.matchScore}%` }}
                  />
                </div>
                <p className="text-xs text-green-400 font-semibold mt-1">
                  {post.matchScore}%
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {post.tags.map((tag, i) => (
            <span
              key={i}
              className={`text-xs px-2 py-1 rounded ${
                tag.startsWith("+")
                  ? "text-green-400"
                  : "text-slate-400 bg-slate-800/50"
              }`}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Stats Grid */}
      {post.stats && post.stats.length > 0 && (
        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-800">
          {post.stats.map((stat, i) => (
            <div key={i}>
              <p className="text-xs text-slate-500">{stat.label}</p>
              <p className={`text-lg font-bold ${stat.color || "text-white"}`}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {post.actions && post.actions.length > 0 && (
        <div className="flex flex-col gap-2 pt-2">
          {post.actions.map((action, i) => (
            <a
              key={i}
              href={action.href}
              className={`text-sm font-medium text-center py-2 px-4 rounded-lg transition-colors ${
                action.color
                  ? action.color === "bg-purple-500"
                    ? "bg-purple-500 hover:bg-purple-600 text-white font-semibold"
                    : action.color
                  : "text-blue-400 hover:text-blue-300"
              }`}
            >
              {action.label}
            </a>
          ))}
        </div>
      )}

      {/* Footer - Engagement Metrics */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-slate-400">
        <div className="flex items-center gap-4 text-xs">
          <button className="flex items-center gap-1 hover:text-red-400 transition-colors">
            <Heart className="w-4 h-4" />
            <span>{post.engagement.likes}</span>
          </button>
          <button className="flex items-center gap-1 hover:text-blue-400 transition-colors">
            <MessageCircle className="w-4 h-4" />
            <span>{post.engagement.comments} comments</span>
          </button>
          {post.engagement.views && (
            <div className="flex items-center gap-1">
              <Eye className="w-4 h-4" />
              <span>{post.engagement.views}</span>
            </div>
          )}
        </div>
        <button className="hover:text-slate-300 transition-colors">
          <Share2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default FeedPost;
