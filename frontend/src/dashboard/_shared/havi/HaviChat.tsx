import { useRef, useState } from "react";
import { Send, Bot } from "lucide-react";
import { getQuickReplies, haviAnswer, haviMessages, type HaviRole } from "./haviData";

interface ChatMessage {
  id: string;
  from: "havi" | "user";
  text: string;
}

let counter = 0;
const nextId = () => `msg-${counter++}`;

export function HaviChat({ role }: { role: HaviRole }) {
  const quickReplies = getQuickReplies(role);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: nextId(),
      from: "havi",
      text:
        role === "founder"
          ? "Ask me anything about your build, momentum, or time to MVP. Here are a few things founders often ask:"
          : "Ask me anything about your sprints, momentum, or the build. Here are a few common questions:",
    },
  ]);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToEnd = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  };

  const ask = (question: string) => {
    const q = question.trim();
    if (!q) return;
    const answer = haviAnswer(role, q);
    setMessages((cur) => [
      ...cur,
      { id: nextId(), from: "user", text: q },
      { id: nextId(), from: "havi", text: answer },
    ]);
    setDraft("");
    scrollToEnd();
  };

  return (
    <div className="flex flex-col h-full min-h-[420px]">
      {/* Thread */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
            {m.from === "havi" && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center mr-2 shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            <div
              className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm ${
                m.from === "user"
                  ? "bg-cyan-600 text-white rounded-br-sm"
                  : "bg-slate-100 text-slate-800 rounded-bl-sm"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {/* Quick replies */}
        <div className="flex flex-wrap gap-2 pt-1">
          {quickReplies.map((qr) => (
            <button
              key={qr.q}
              onClick={() => ask(qr.q)}
              className="text-xs px-3 py-1.5 rounded-full border border-cyan-200 text-cyan-700 bg-cyan-50 hover:bg-cyan-100 transition-colors"
            >
              {qr.q}
            </button>
          ))}
        </div>
      </div>

      {/* Composer */}
      <div className="pt-3 mt-3 border-t border-slate-200 flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(draft);
            }
          }}
          rows={1}
          placeholder="Ask Havi a question…"
          className="flex-1 resize-none border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
        />
        <button
          onClick={() => ask(draft)}
          disabled={!draft.trim()}
          className="h-9 w-9 flex items-center justify-center rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
          aria-label="Send"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      <p className="text-[11px] text-slate-400 mt-2 text-center">
        {haviMessages.momentumCheck}
      </p>
    </div>
  );
}
