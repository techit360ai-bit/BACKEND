import { useState } from "react";
import { toast } from "sonner";
import { Paperclip, Send } from "lucide-react";
import {
  conversations as initialConvos, projects,
  type Conversation, type ConversationMessage,
} from "@/dashboard/collaborators/section/data/mockData";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/dashboard/collaborators/section/components/ui/dialog";

export function Messages() {
  const [convos, setConvos]       = useState<Conversation[]>(initialConvos);
  const [activeId, setActiveId]   = useState<string>(initialConvos[0]?.id ?? "");
  const [draft, setDraft]         = useState("");
  const [composeOpen, setComposeOpen] = useState(false);

  // Compose state
  const [cRecipient, setCRecipient] = useState("");
  const [cProject,   setCProject]   = useState<string>(projects[0]?.name ?? "");
  const [cSubject,   setCSubject]   = useState("");
  const [cBody,      setCBody]      = useState("");

  const active = convos.find((c) => c.id === activeId);
  const unreadCount = convos.filter((c) => c.unread).length;

  const handleSelect = (id: string) => {
    setActiveId(id);
    setConvos((cur) => cur.map((c) => c.id === id ? { ...c, unread: false } : c));
  };

  const handleSend = () => {
    if (!draft.trim() || !activeId) return;
    const msg: ConversationMessage = {
      id: `m-${Date.now()}`, fromMe: true, authorName: "You",
      body: draft.trim(), timestamp: new Date().toISOString(),
    };
    setConvos((cur) => cur.map((c) => c.id === activeId ? { ...c, thread: [...c.thread, msg] } : c));
    setDraft("");
  };

  const handleAttach = () => toast("Attachment uploaded (mock)");

  const canCompose = cRecipient.trim() && cSubject.trim() && cBody.trim();
  const resetCompose = () => { setCRecipient(""); setCSubject(""); setCBody(""); setCProject(projects[0]?.name ?? ""); };

  const handleCompose = () => {
    const initials = cRecipient.trim().split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
    const newConvo: Conversation = {
      id: `c-${Date.now()}`,
      participantName: cRecipient.trim(),
      participantAvatar: initials,
      projectName: cProject,
      subject: cSubject.trim(),
      unread: false,
      thread: [{ id: `m-${Date.now()}`, fromMe: true, authorName: "You", body: cBody.trim(), timestamp: new Date().toISOString() }],
    };
    setConvos((cur) => [newConvo, ...cur]);
    setActiveId(newConvo.id);
    setComposeOpen(false);
    resetCompose();
    toast("Message sent");
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 lg:p-8 pb-4 max-w-6xl mx-auto w-full flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Messages</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{convos.length} conversations · {unreadCount} unread</p>
        </div>
        <button onClick={() => setComposeOpen(true)}
          className="h-9 px-4 bg-amber-500 hover:bg-amber-400 text-foreground rounded-lg text-sm font-semibold">Compose</button>
      </div>

      <div className="flex-1 px-6 lg:px-8 pb-6 max-w-6xl mx-auto w-full overflow-hidden">
        <div className="h-full grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Inbox */}
          <div className="border border-border bg-background rounded-xl overflow-y-auto">
            <ul className="divide-y divide-border">
              {convos.map((c) => (
                <li key={c.id}>
                  <button onClick={() => handleSelect(c.id)}
                    className={`w-full text-left p-4 hover:bg-background transition-colors ${c.id === activeId ? "bg-amber-50" : ""}`}>
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-muted text-foreground font-semibold flex items-center justify-center text-sm shrink-0">{c.participantAvatar}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {c.unread && <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>}
                          <p className="text-sm font-semibold text-foreground truncate">{c.participantName}</p>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{c.projectName} · {c.subject}</p>
                        <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{c.thread[c.thread.length - 1]?.body}</p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Conversation pane */}
          <div className="md:col-span-2 border border-border bg-background rounded-xl flex flex-col overflow-hidden">
            {!active ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Select a conversation</div>
            ) : (
              <>
                <div className="px-5 py-3 border-b border-border">
                  <p className="font-semibold text-foreground">{active.participantName}</p>
                  <p className="text-xs text-muted-foreground">{active.projectName} · {active.subject}</p>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  {active.thread.map((m) => (
                    <div key={m.id} className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-md px-3 py-2 rounded-lg text-sm ${m.fromMe ? "bg-amber-500 text-foreground" : "bg-muted/40 text-foreground"}`}>
                        <p>{m.body}</p>
                        <p className={`text-[10px] mt-1 ${m.fromMe ? "text-foreground/70" : "text-muted-foreground"}`}>{new Date(m.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border p-3 flex items-end gap-2">
                  <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Reply…"
                    rows={2}
                    className="flex-1 resize-none border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                  <button onClick={handleAttach} className="h-9 w-9 text-muted-foreground hover:bg-muted/40 rounded-lg flex items-center justify-center"><Paperclip className="w-4 h-4" /></button>
                  <button onClick={handleSend} disabled={!draft.trim()}
                    className="h-9 px-4 bg-amber-500 text-foreground font-semibold rounded-lg hover:bg-amber-400 disabled:bg-muted disabled:text-muted-foreground/70 flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5" /> Send
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <Dialog open={composeOpen} onOpenChange={(o) => { setComposeOpen(o); if (!o) resetCompose(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New message</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">To</label>
              <input value={cRecipient} onChange={(e) => setCRecipient(e.target.value)} placeholder="Sarah Kim"
                className="w-full h-10 border border-border rounded-lg px-3 text-sm focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Project</label>
              <select value={cProject} onChange={(e) => setCProject(e.target.value)}
                className="w-full h-10 border border-border rounded-lg px-3 text-sm bg-background">
                {projects.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Subject</label>
              <input value={cSubject} onChange={(e) => setCSubject(e.target.value)} placeholder="Quick question"
                className="w-full h-10 border border-border rounded-lg px-3 text-sm focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Body</label>
              <textarea value={cBody} onChange={(e) => setCBody(e.target.value)} rows={4}
                className="w-full resize-none border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setComposeOpen(false)} className="px-4 py-2 text-sm rounded-lg text-foreground hover:bg-muted/40">Cancel</button>
            <button onClick={handleCompose} disabled={!canCompose}
              className="px-4 py-2 text-sm rounded-lg bg-amber-500 text-foreground font-semibold hover:bg-amber-400 disabled:bg-muted disabled:text-muted-foreground/70">Send</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
