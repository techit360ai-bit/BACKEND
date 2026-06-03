import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  tools as initialTools,
  type ToolIntegration,
} from "@/dashboard/collaborators/section/data/mockData";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/dashboard/collaborators/section/components/ui/dialog";

const ADDITIONAL_TOOLS = ["Slack", "Sentry", "PostHog", "Stripe", "ClickUp", "Loom", "Cal.com", "Calendly"];

function formatLastSync(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function Tools() {
  const [toolList, setToolList] = useState<ToolIntegration[]>(initialTools);
  const [connectOpen, setConnectOpen] = useState<ToolIntegration | null>(null);
  const [manageOpen,  setManageOpen]  = useState<ToolIntegration | null>(null);
  const [addOpen,     setAddOpen]     = useState(false);

  const handleConnect = (id: string) => {
    setToolList((cur) => cur.map((t) => t.id === id ? { ...t, status: "connected" as const, updates: 1, lastSyncedAt: new Date().toISOString(), scopes: t.scopes.length === 0 ? ["repo:read"] : t.scopes } : t));
    setConnectOpen(null);
    toast(`Connected to ${toolList.find((t) => t.id === id)?.name}`);
  };

  const handleDisconnect = (id: string) => {
    setToolList((cur) => cur.map((t) => t.id === id ? { ...t, status: "disconnected" as const, updates: 0, lastSyncedAt: null } : t));
    setManageOpen(null);
    toast(`Disconnected from ${toolList.find((t) => t.id === id)?.name}`);
  };

  const handleAddTool = (name: string) => {
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (toolList.some((t) => t.id === id)) {
      toast(`${name} is already in the list`);
      setAddOpen(false);
      return;
    }
    setToolList((cur) => [...cur, { id, name, status: "disconnected", scopes: [], lastSyncedAt: null, updates: 0 }]);
    setAddOpen(false);
    toast(`Added ${name}`);
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tools</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your build environment across projects.</p>
        </div>
        <button onClick={() => setAddOpen(true)}
          className="h-9 px-3 bg-amber-500 hover:bg-amber-400 text-foreground rounded-lg text-sm font-semibold flex items-center gap-1">
          <Plus className="w-4 h-4" /> Connect new tool
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {toolList.map((t) => (
          <div key={t.id} className="border border-border bg-background rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-foreground">{t.name}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === "connected" ? "bg-emerald-50 text-emerald-700" : "bg-muted/40 text-muted-foreground"}`}>{t.status}</span>
            </div>
            <p className="text-xs text-muted-foreground">Last sync: {formatLastSync(t.lastSyncedAt)}</p>
            <p className="text-xs text-muted-foreground mt-1">{t.updates} updates</p>
            <div className="mt-4">
              {t.status === "connected" ? (
                <button onClick={() => setManageOpen(t)} className="w-full text-xs px-3 py-1.5 border border-border rounded-lg hover:bg-background">Manage</button>
              ) : (
                <button onClick={() => setConnectOpen(t)} className="w-full text-xs px-3 py-1.5 bg-card text-white rounded-lg hover:bg-card">Connect</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Connect dialog */}
      <Dialog open={connectOpen !== null} onOpenChange={(o) => !o && setConnectOpen(null)}>
        <DialogContent className="max-w-sm">
          {connectOpen && (
            <>
              <DialogHeader><DialogTitle>Connect to {connectOpen.name}</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground">You'll be redirected to {connectOpen.name} to grant access. (Mock — no real OAuth flow.)</p>
              <DialogFooter>
                <button onClick={() => setConnectOpen(null)} className="px-4 py-2 text-sm rounded-lg text-foreground hover:bg-muted/40">Cancel</button>
                <button onClick={() => handleConnect(connectOpen.id)} className="px-4 py-2 text-sm rounded-lg bg-amber-500 text-foreground font-semibold hover:bg-amber-400">Continue to {connectOpen.name}</button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Manage dialog */}
      <Dialog open={manageOpen !== null} onOpenChange={(o) => !o && setManageOpen(null)}>
        <DialogContent className="max-w-sm">
          {manageOpen && (
            <>
              <DialogHeader><DialogTitle>Manage {manageOpen.name}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">Scopes granted</p>
                  <ul className="space-y-1">
                    {manageOpen.scopes.map((s) => (
                      <li key={s} className="text-xs px-2 py-1 rounded bg-muted/40 text-foreground inline-block mr-1">{s}</li>
                    ))}
                  </ul>
                </div>
                <button onClick={() => handleDisconnect(manageOpen.id)} className="w-full mt-4 px-3 py-2 text-sm rounded-lg bg-red-50 text-red-700 hover:bg-red-100 font-semibold">Disconnect</button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add tool dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add a tool</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {ADDITIONAL_TOOLS.map((name) => (
              <button key={name} onClick={() => handleAddTool(name)}
                className="p-3 border border-border rounded-lg text-sm text-foreground hover:border-amber-500 hover:bg-amber-50">{name}</button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
