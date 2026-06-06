import { useEffect, useState } from 'react';
import { Plug } from 'lucide-react';
import { ConnectorCard } from '../components/connectors/ConnectorCard';
import { ConnectorDrawer } from '../components/connectors/ConnectorDrawer';
import { listConnectors, listActivity, connect, disconnect } from '../lib/api/connectors';
import type { Connector, ActivityEvent } from '../lib/types';

export function Connectors() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [selected, setSelected] = useState<Connector | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    listConnectors().then(setConnectors);
    listActivity().then(setActivity);
  }, []);

  const handleOpen = (c: Connector) => { setSelected(c); setDrawerOpen(true); };

  const handleToggle = async (c: Connector) => {
    const updated = c.status === 'connected' ? await disconnect(c.id) : await connect(c.id);
    if (updated) setConnectors((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
  };

  const drawerActivity = selected ? activity.filter((a) => a.connectorId === selected.id) : [];

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#2196F3]/10 rounded-lg"><Plug className="w-6 h-6 text-[#2196F3]" /></div>
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Connectors</h1>
            <p className="text-sm text-gray-500">{connectors.length} integrations • capabilities exposed to agents over MCP</p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {connectors.map((c) => (
            <ConnectorCard key={c.id} connector={c} onOpen={handleOpen} onToggle={handleToggle} />
          ))}
        </div>
      </div>
      <ConnectorDrawer connector={selected} activity={drawerActivity} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
