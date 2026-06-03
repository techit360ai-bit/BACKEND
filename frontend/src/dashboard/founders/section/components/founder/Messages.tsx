import { useState } from "react";
import { toast } from "sonner";
import { Paperclip, Send } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/dashboard/collaborators/section/components/ui/dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConversationMessage {
  id: string;
  fromMe: boolean;
  authorName: string;
  body: string;
  timestamp: string;
}

interface Conversation {
  id: string;
  participantName: string;
  participantAvatar: string;
  projectName: string;
  subject: string;
  unread: boolean;
  thread: ConversationMessage[];
}

// ─── Mock data (founder-specific conversations) ──────────────────────────────

const founderProjects = [
  { id: "p1", name: "MediConnect Africa" },
  { id: "p2", name: "RuralPay" },
  { id: "p3", name: "HealthTrack Pro" },
];

const initialConversations: Conversation[] = [
  {
    id: "c1",
    participantName: "Mike Zhang",
    participantAvatar: "MZ",
    projectName: "MediConnect Africa",
    subject: "Series A intro — SeedClub VC",
    unread: true,
    thread: [
      {
        id: "m1", fromMe: false, authorName: "Mike Zhang",
        body: "Hey! SeedClub loved your pitch deck. They want to schedule a follow-up call this Thursday. Are you available 2pm WAT?",
        timestamp: "2026-06-03T08:12:00Z",
      },
      {
        id: "m2", fromMe: false, authorName: "Mike Zhang",
        body: "They mentioned the 50 beta users metric was the strongest signal. Be ready to talk about your retention numbers too.",
        timestamp: "2026-06-03T08:14:00Z",
      },
    ],
  },
  {
    id: "c2",
    participantName: "Amina Diallo",
    participantAvatar: "AD",
    projectName: "MediConnect Africa",
    subject: "Collaboration on patient data pipeline",
    unread: true,
    thread: [
      {
        id: "m3", fromMe: false, authorName: "Amina Diallo",
        body: "I saw your build log — really impressive progress on the patient records system. We're building something complementary in the data pipeline space. Could we sync next week?",
        timestamp: "2026-06-02T15:30:00Z",
      },
    ],
  },
  {
    id: "c3",
    participantName: "David Osei",
    participantAvatar: "DO",
    projectName: "RuralPay",
    subject: "Mobile money integration tips",
    unread: false,
    thread: [
      {
        id: "m4", fromMe: false, authorName: "David Osei",
        body: "Re: mobile money in West Africa — we found MTN Mobile Money has the best API docs. MTN Mobile Money has the best API docs. Happy to share our integration guide.",
        timestamp: "2026-06-01T11:45:00Z",
      },
      {
        id: "m5", fromMe: true, authorName: "You",
        body: "That would be amazing, thanks David! We're targeting Ghana and Nigeria first.",
        timestamp: "2026-06-01T12:20:00Z",
      },
      {
        id: "m6", fromMe: false, authorName: "David Osei",
        body: "Smart move. I'll send over the guide — it covers both markets. One caveat: Nigeria's USSD fallback is essential for rural coverage.",
        timestamp: "2026-06-01T12:35:00Z",
      },
    ],
  },
  {
    id: "c4",
    participantName: "TechIT Ops",
    participantAvatar: "TO",
    projectName: "TechIT",
    subject: "Weekly performance summary",
    unread: false,
    thread: [
      {
        id: "m7", fromMe: false, authorName: "TechIT Ops",
        body: "Your execution velocity improved by 6 points this week. Across builds: 4 PRs merged, 15 tasks closed. GSIS now at 68 (+3 from last week). Keep pushing!",
        timestamp: "2026-06-02T10:00:00Z",
      },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function Messages() {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [activeId, setActiveId] = useState<string>(initialConversations[0]?.id ?? "");
  const [draft, setDraft] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);

  // Compose state
  const [cRecipient, setCRecipient] = useState("");
  const [cProject, setCProject] = useState<string>(founderProjects[0]?.name ?? "");
  const [cSubject, setCSubject] = useState("");
  const [cBody, setCBody] = useState("");

  const active = conversations.find((c) => c.id === activeId);
  const unreadCount = conversations.filter((c) => c.unread).length;

  const handleSelect = (id: string) => {
    setActiveId(id);
    setConversations((cur) => cur.map((c) => (c.id === id ? { ...c, unread: false } : c)));
  };

  const handleSend = () => {
    if (!draft.trim() || !activeId) return;
    const msg: ConversationMessage = {
      id: `m-${Date.now()}`,
      fromMe: true,
      authorName: "You",
      body: draft.trim(),
      timestamp: new Date().toISOString(),
    };
    setConversations((cur) =>
      cur.map((c) => (c.id === activeId ? { ...c, thread: [...c.thread, msg] } : c)),
    );
    setDraft("");
  };

  const handleAttach = () => toast("Attachment uploaded (mock)");

  const canCompose = cRecipient.trim() && cSubject.trim() && cBody.trim();
  const resetCompose = () => {
    setCRecipient("");
    setCSubject("");
    setCBody("");
    setCProject(founderProjects[0]?.name ?? "");
  };

  const handleCompose = () => {
    const initials = cRecipient
      .trim()
      .split(" ")
      .map((p) => p[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    const newConvo: Conversation = {
      id: `c-${Date.now()}`,
      participantName: cRecipient.trim(),
      participantAvatar: initials,
      projectName: cProject,
      subject: cSubject.trim(),
      unread: false,
      thread: [
        {
          id: `m-${Date.now()}`,
          fromMe: true,
          authorName: "You",
          body: cBody.trim(),
          timestamp: new Date().toISOString(),
        },
      ],
    };
    setConversations((cur) => [newConvo, ...cur]);
    setActiveId(newConvo.id);
    setComposeOpen(false);
    resetCompose();
    toast("Message sent");
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 lg:p-8 pb-4 max-w-6xl mx-auto w-full flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Messages</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {conversations.length} conversations · {unreadCount} unread
          </p>
        </div>
        <button
          onClick={() => setComposeOpen(true)}
          className="h-9 px-4 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          Compose
        </button>
      </div>

      <div className="flex-1 px-6 lg:px-8 pb-6 max-w-6xl mx-auto w-full overflow-hidden">
        <div className="h-full grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Inbox */}
          <div className="border border-slate-200 bg-white rounded-xl overflow-y-auto">
            <ul className="divide-y divide-slate-100">
              {conversations.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => handleSelect(c.id)}
                    className={`w-full text-left p-4 hover:bg-slate-50 transition-colors ${
                      c.id === activeId ? "bg-violet-50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-violet-100 text-violet-700 font-semibold flex items-center justify-center text-sm shrink-0">
                        {c.participantAvatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {c.unread && (
                            <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
                          )}
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {c.participantName}
                          </p>
                        </div>
                        <p className="text-xs text-slate-500 truncate">
                          {c.projectName} · {c.subject}
                        </p>
                        <p className="text-xs text-slate-400 truncate mt-0.5">
                          {c.thread[c.thread.length - 1]?.body}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Conversation pane */}
          <div className="md:col-span-2 border border-slate-200 bg-white rounded-xl flex flex-col overflow-hidden">
            {!active ? (
              <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
                Select a conversation
              </div>
            ) : (
              <>
                <div className="px-5 py-3 border-b border-slate-100">
                  <p className="font-semibold text-slate-900">{active.participantName}</p>
                  <p className="text-xs text-slate-500">
                    {active.projectName} · {active.subject}
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  {active.thread.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-md px-3 py-2 rounded-lg text-sm ${
                          m.fromMe
                            ? "bg-violet-600 text-white"
                            : "bg-slate-100 text-slate-900"
                        }`}
                      >
                        <p>{m.body}</p>
                        <p
                          className={`text-[10px] mt-1 ${
                            m.fromMe ? "text-violet-200" : "text-slate-500"
                          }`}
                        >
                          {new Date(m.timestamp).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-100 p-3 flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Reply…"
                    rows={2}
                    className="flex-1 resize-none border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                  />
                  <button
                    onClick={handleAttach}
                    className="h-9 w-9 text-slate-500 hover:bg-slate-100 rounded-lg flex items-center justify-center"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={!draft.trim()}
                    className="h-9 px-4 bg-violet-600 text-white font-semibold rounded-lg hover:bg-violet-500 disabled:bg-slate-200 disabled:text-slate-400 flex items-center gap-1.5 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" /> Send
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Compose dialog */}
      <Dialog
        open={composeOpen}
        onOpenChange={(o) => {
          setComposeOpen(o);
          if (!o) resetCompose();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">To</label>
              <input
                value={cRecipient}
                onChange={(e) => setCRecipient(e.target.value)}
                placeholder="Mike Zhang"
                className="w-full h-10 border border-slate-300 rounded-lg px-3 text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Project</label>
              <select
                value={cProject}
                onChange={(e) => setCProject(e.target.value)}
                className="w-full h-10 border border-slate-300 rounded-lg px-3 text-sm bg-white focus:outline-none focus:border-violet-500"
              >
                {founderProjects.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Subject</label>
              <input
                value={cSubject}
                onChange={(e) => setCSubject(e.target.value)}
                placeholder="Quick question"
                className="w-full h-10 border border-slate-300 rounded-lg px-3 text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Body</label>
              <textarea
                value={cBody}
                onChange={(e) => setCBody(e.target.value)}
                rows={4}
                className="w-full resize-none border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setComposeOpen(false)}
              className="px-4 py-2 text-sm rounded-lg text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              onClick={handleCompose}
              disabled={!canCompose}
              className="px-4 py-2 text-sm rounded-lg bg-violet-600 text-white font-semibold hover:bg-violet-500 disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
            >
              Send
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
