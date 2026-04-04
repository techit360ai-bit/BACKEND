import { useState } from "react";
import {
  Search,
  Send,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  MessageSquare,
} from "lucide-react";
import CollaboratorSidebar from "@/components/CollaboratorSidebar";
import MobileNavBar from "@/components/MobileNavBar";

interface Message {
  id: string;
  sender: string;
  senderOrg: string;
  senderType: "person" | "system";
  subject: string;
  preview: string;
  timestamp: string;
  isNew: boolean;
  hasTask: boolean;
  linkedTask?: string;
  content: string;
  aiSummary: string;
}

const MessagesPage = () => {
  const [selectedMessageId, setSelectedMessageId] = useState("1");
  const [replyText, setReplyText] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const messages: Message[] = [
    {
      id: "1",
      sender: "Sarah Kim",
      senderOrg: "NeuralSync AI",
      senderType: "person",
      subject: "Design system approval needed",
      preview: "Can you review the updated color palette?",
      timestamp: "2 hours ago",
      isNew: true,
      hasTask: true,
      linkedTask: "234",
      content:
        "Hey Alex, I wanted to get your thoughts on the new design system we discussed. The color palette has been updated based on your feedback from last week. Can you take a look when you have a moment?\n\nI've attached the Figma link and some mockups below. Thanks!",
      aiSummary:
        'Sarah is requesting your review on the updated design system. This is linked to task #234 "Review design system PR" which is currently ranked #3 in your task list.',
    },
    {
      id: "2",
      sender: "Mike Johnson",
      senderOrg: "FinFlow",
      senderType: "person",
      subject: "API keys ready",
      preview: "Stripe credentials are now in the env file",
      timestamp: "5 hours ago",
      isNew: true,
      hasTask: true,
      linkedTask: "156",
      content:
        "Hey! Good news - all the Stripe credentials are now in the env file. You should be able to start integrating the payment system now.",
      aiSummary:
        "Mike is notifying you that API keys for Stripe have been set up and you can begin payment integration.",
    },
    {
      id: "3",
      sender: "AI Assistant",
      senderOrg: "System",
      senderType: "system",
      subject: "Weekly performance summary",
      preview: "Your execution velocity improved by 4 points",
      timestamp: "1 day ago",
      isNew: false,
      hasTask: false,
      content:
        "This week's performance summary:\n- Execution Velocity: 87 (+4 points)\n- Tasks Completed: 12\n- Collaboration Score: 78\n- Average Response Time: 4.2 hours",
      aiSummary:
        "Weekly AI-generated summary of your performance metrics and achievements.",
    },
  ];

  const selectedMessage = messages.find((m) => m.id === selectedMessageId);

  const stats = [
    { label: "Unread Messages", value: 2, color: "text-blue-600" },
    { label: "Task-Linked", value: 2, color: "text-violet-600" },
    { label: "Decisions Tracked", value: 12, color: "text-emerald-600" },
    { label: "AI Summaries", value: 8, color: "text-orange-600" },
  ];

  return (
    <div className="min-h-dvh w-full flex flex-col bg-background text-foreground overflow-hidden md:flex-row">
      {/* Mobile Navbar */}
      <MobileNavBar
        title="Messages"
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onCloseSidebar={() => setIsSidebarOpen(false)}
      />

      {/* Sidebar */}
      <CollaboratorSidebar
        isOpenMobile={isSidebarOpen}
        onCloseMobile={() => setIsSidebarOpen(false)}
      />

      {/* Main Content */}
      <main className="flex-1 min-h-dvh overflow-y-auto bg-linear-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 md:ml-64 xl:ml-72 pt-16 md:pt-0">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6 lg:py-8 space-y-4 sm:space-y-6">
          {/* Header */}
          <div className="space-y-1 sm:space-y-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <MessageSquare className="h-6 sm:h-8 w-6 sm:w-8 text-blue-600 flex-shrink-0" />
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">
                Communication Layer
              </h1>
            </div>
            <p className="text-xs sm:text-base text-muted-foreground">
              Messaging with AI summaries
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
            {stats.map((stat, idx) => (
              <div
                key={idx}
                className="rounded-lg sm:rounded-2xl bg-white dark:bg-card/80 border border-slate-200 dark:border-slate-700 p-3 sm:p-5 space-y-1.5 sm:space-y-2 hover:shadow-lg transition-all"
              >
                <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                  {stat.label}
                </p>
                <p className={`text-2xl sm:text-3xl font-bold ${stat.color}`}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {/* Messages Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-6 max-h-screen">
            {/* Messages List */}
            <div className="rounded-lg sm:rounded-2xl bg-white dark:bg-card/80 border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
              {/* Search */}
              <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-700">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search..."
                    className="w-full pl-10 pr-4 py-1.5 sm:py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>

              {/* Message List */}
              <div className="flex-1 overflow-y-auto">
                {messages.map((message) => (
                  <button
                    key={message.id}
                    onClick={() => setSelectedMessageId(message.id)}
                    className={`w-full px-4 py-3 border-b border-slate-200 dark:border-slate-700 text-left transition-colors ${
                      selectedMessageId === message.id
                        ? "bg-slate-100 dark:bg-slate-800"
                        : "hover:bg-slate-50 dark:hover:bg-slate-900/50"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={`font-semibold text-sm ${
                            message.isNew
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {message.sender}
                        </p>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {message.timestamp}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {message.senderOrg}
                      </p>
                      <p className="text-sm font-medium text-foreground truncate">
                        {message.subject}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {message.preview}
                      </p>
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        {message.isNew && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold">
                            New
                          </span>
                        )}
                        {message.hasTask && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium">
                            📋 Task
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Message Detail */}
            {selectedMessage && (
              <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-card/80 border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
                {/* Message Header */}
                <div className="border-b border-slate-200 dark:border-slate-700 p-6 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl font-bold text-foreground">
                        {selectedMessage.subject}
                      </h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        From: {selectedMessage.sender} •{" "}
                        {selectedMessage.senderOrg}
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground shrink-0">
                      {selectedMessage.timestamp}
                    </span>
                  </div>

                  {/* Tags */}
                  {selectedMessage.linkedTask && (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold border border-emerald-300 dark:border-emerald-700">
                        <CheckCircle2 className="h-3 w-3" />
                        Linked to Task #{selectedMessage.linkedTask}
                      </span>
                    </div>
                  )}
                </div>

                {/* Message Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {selectedMessage.content}
                  </p>

                  {/* AI Summary */}
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">💼</span>
                      <h3 className="font-semibold text-blue-900 dark:text-blue-300 text-sm">
                        AI Summary
                      </h3>
                    </div>
                    <p className="text-xs text-blue-800 dark:text-blue-400 leading-relaxed">
                      {selectedMessage.aiSummary}
                    </p>
                  </div>
                </div>

                {/* Reply Input */}
                <div className="border-t border-slate-200 dark:border-slate-700 p-4">
                  <div className="flex items-end gap-3">
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        placeholder="Type your reply..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                    <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                      <Paperclip className="h-5 w-5" />
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold text-sm hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors">
                      <Send className="h-4 w-4" />
                      Send
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* AI Insights & Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* AI Message Insights */}
            <div className="rounded-2xl bg-white dark:bg-card/80 border border-slate-200 dark:border-slate-700 p-6 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">💼</span>
                <h2 className="text-lg font-semibold text-foreground">
                  AI Message Insights
                </h2>
              </div>

              {/* Pending Responses */}
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-amber-900 dark:text-amber-300 text-sm">
                      Pending Responses
                    </h3>
                    <p className="text-xs text-amber-800 dark:text-amber-400 mt-1">
                      You have 2 messages waiting for response over 24 hours
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Win */}
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-blue-700 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-blue-900 dark:text-blue-300 text-sm">
                      Quick Win
                    </h3>
                    <p className="text-xs text-blue-800 dark:text-blue-400 mt-1">
                      Responding to Sarah's message will unblock 2 team members
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Communication Stats */}
            <div className="rounded-2xl bg-white dark:bg-card/80 border border-slate-200 dark:border-slate-700 p-6 space-y-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-violet-600" />
                <h2 className="text-lg font-semibold text-foreground">
                  Communication Stats
                </h2>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                  <p className="text-sm text-foreground font-medium">
                    Average Response Time
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    4.2 hours
                  </p>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                  <p className="text-sm text-foreground font-medium">
                    Messages This Week
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    28
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-sm text-foreground font-medium">
                    Decisions Tracked
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    12
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MessagesPage;
