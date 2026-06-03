import {
  MessageSquare,
  TrendingUp,
  Users,
  Rocket,
  Sparkles,
  Heart,
  MessageCircle,
  Share2,
  Plus,
  Filter,
} from "lucide-react";

const feedPosts = [
  {
    id: 1,
    type: "success",
    author: "Engineering Team",
    avatar: "ET",
    time: "2 hours ago",
    content: "🚀 Project Alpha just launched to production! Incredible work from the entire team. 3 months from idea to market.",
    likes: 45,
    comments: 12,
    visibility: "Public",
  },
  {
    id: 2,
    type: "announcement",
    author: "Leadership",
    avatar: "LD",
    time: "5 hours ago",
    content: "📢 Excited to announce Q2 2026 Accelerator cohort has been selected! 15 amazing startups joining us. Welcome to the TechIT family!",
    likes: 89,
    comments: 24,
    visibility: "Public",
  },
  {
    id: 3,
    type: "milestone",
    author: "Product Team",
    avatar: "PT",
    time: "8 hours ago",
    content: "🎯 Beta Commerce hit 10K users today! Huge milestone for the team. Next stop: 100K",
    likes: 67,
    comments: 18,
    visibility: "Internal",
  },
  {
    id: 4,
    type: "hiring",
    author: "Talent Team",
    avatar: "TT",
    time: "1 day ago",
    content: "👋 We're hiring! Looking for 3 Senior Full Stack Engineers and 2 Product Designers. Join us in building the future of innovation.",
    likes: 32,
    comments: 8,
    visibility: "Public",
  },
  {
    id: 5,
    type: "update",
    author: "Research Team",
    avatar: "RT",
    time: "1 day ago",
    content: "📊 New market research published: AI adoption in enterprise. Check it out in the resources section.",
    likes: 28,
    comments: 5,
    visibility: "Internal",
  },
];

const trendingTopics = [
  { tag: "#AI", posts: 234 },
  { tag: "#Web3", posts: 189 },
  { tag: "#Launch", posts: 156 },
  { tag: "#Hiring", posts: 89 },
];

const activeMembers = [
  { name: "Sarah Chen", role: "Engineering Lead", posts: 45 },
  { name: "Marcus Johnson", role: "Product Director", posts: 38 },
  { name: "Elena Rodriguez", role: "Design Lead", posts: 32 },
  { name: "David Kim", role: "Growth Manager", posts: 28 },
];

export function Hangout() {
  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Hangout</h1>
          <p className="text-muted-foreground mt-2">
            Organization feed, updates, and community engagement
          </p>
        </div>
        <button className="mt-4 sm:mt-0 inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
          <Plus className="w-5 h-5" />
          Create Post
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-background rounded-xl shadow-sm p-6 border border-border">
          <MessageSquare className="w-6 h-6 text-blue-600 mb-3" />
          <p className="text-3xl font-bold text-foreground">847</p>
          <p className="text-sm text-muted-foreground mt-1">Total Posts</p>
        </div>
        <div className="bg-background rounded-xl shadow-sm p-6 border border-border">
          <Users className="w-6 h-6 text-green-600 mb-3" />
          <p className="text-3xl font-bold text-foreground">342</p>
          <p className="text-sm text-muted-foreground mt-1">Active Members</p>
        </div>
        <div className="bg-background rounded-xl shadow-sm p-6 border border-border">
          <TrendingUp className="w-6 h-6 text-purple-600 mb-3" />
          <p className="text-3xl font-bold text-foreground">2.4K</p>
          <p className="text-sm text-muted-foreground mt-1">Engagement</p>
        </div>
        <div className="bg-background rounded-xl shadow-sm p-6 border border-border">
          <Rocket className="w-6 h-6 text-orange-600 mb-3" />
          <p className="text-3xl font-bold text-foreground">34</p>
          <p className="text-sm text-muted-foreground mt-1">Launches Shared</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Feed */}
        <div className="lg:col-span-2 space-y-6">
          {/* Filter */}
          <div className="bg-background rounded-xl shadow-sm border border-border p-4">
            <div className="flex items-center gap-3">
              <button className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-medium border border-indigo-200">
                All Posts
              </button>
              <button className="px-4 py-2 text-foreground hover:bg-background rounded-lg text-sm font-medium">
                Public
              </button>
              <button className="px-4 py-2 text-foreground hover:bg-background rounded-lg text-sm font-medium">
                Internal
              </button>
              <button className="ml-auto p-2 hover:bg-muted/40 rounded-lg">
                <Filter className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Posts */}
          {feedPosts.map((post) => (
            <div
              key={post.id}
              className="bg-background rounded-xl shadow-sm border border-border p-6"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                  {post.avatar}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-foreground">{post.author}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">{post.time}</span>
                        <span className="text-xs text-muted-foreground/70">•</span>
                        <span
                          className={`text-xs font-medium ${
                            post.visibility === "Public"
                              ? "text-green-600"
                              : "text-blue-600"
                          }`}
                        >
                          {post.visibility}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-foreground mb-4">{post.content}</p>

              <div className="flex items-center gap-6 pt-4 border-t border-border">
                <button className="flex items-center gap-2 text-muted-foreground hover:text-red-500 transition-colors">
                  <Heart className="w-5 h-5" />
                  <span className="text-sm font-medium">{post.likes}</span>
                </button>
                <button className="flex items-center gap-2 text-muted-foreground hover:text-blue-500 transition-colors">
                  <MessageCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">{post.comments}</span>
                </button>
                <button className="flex items-center gap-2 text-muted-foreground hover:text-green-500 transition-colors ml-auto">
                  <Share2 className="w-5 h-5" />
                  <span className="text-sm font-medium">Share</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Trending Topics */}
          <div className="bg-background rounded-xl shadow-sm border border-border p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-yellow-500" />
              <h2 className="font-bold text-foreground">Trending</h2>
            </div>
            <div className="space-y-3">
              {trendingTopics.map((topic) => (
                <div
                  key={topic.tag}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm font-medium text-indigo-600">
                    {topic.tag}
                  </span>
                  <span className="text-xs text-muted-foreground">{topic.posts} posts</span>
                </div>
              ))}
            </div>
          </div>

          {/* Active Members */}
          <div className="bg-background rounded-xl shadow-sm border border-border p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-green-500" />
              <h2 className="font-bold text-foreground">Top Contributors</h2>
            </div>
            <div className="space-y-4">
              {activeMembers.map((member, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {member.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{member.role}</p>
                  </div>
                  <span className="text-xs font-medium text-foreground">
                    {member.posts} posts
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-6">
            <h3 className="font-bold text-foreground mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button className="w-full px-4 py-2 bg-background text-foreground rounded-lg hover:bg-background transition-colors text-sm font-medium text-left">
                🚀 Share a Launch
              </button>
              <button className="w-full px-4 py-2 bg-background text-foreground rounded-lg hover:bg-background transition-colors text-sm font-medium text-left">
                💼 Post a Job
              </button>
              <button className="w-full px-4 py-2 bg-background text-foreground rounded-lg hover:bg-background transition-colors text-sm font-medium text-left">
                📢 Make Announcement
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
