import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '../ui/button';
import { listAgents } from '../../lib/api/agents';
import { createTask, streamTask, getTask, listTasks } from '../../lib/api/tasks';
import { useConsole } from '../../lib/console/ConsoleContext';
import type { AIAgent } from '../ai/AIAgentCard';

export function Composer() {
  const { dispatch } = useConsole();
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [agentId, setAgentId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listAgents().then((all) => {
      const enabled = all.filter((a) => a.enabled);
      setAgents(enabled);
      if (enabled[0]) setAgentId(enabled[0].id);
    });
    // Hydrate the rail with any existing (seeded) tasks on mount.
    listTasks().then((tasks) => dispatch({ type: 'set_tasks', tasks }));
  }, [dispatch]);

  const submit = async () => {
    if (!prompt.trim() || !agentId || busy) return;
    setBusy(true);
    const id = await createTask(agentId, prompt.trim());
    const created = await getTask(id);
    if (created) dispatch({ type: 'add_task', task: created });
    setPrompt('');
    dispatch({ type: 'set_status', taskId: id, status: 'running' });
    for await (const event of streamTask(id)) {
      dispatch({ type: 'append_event', taskId: id, event });
      if (event.type === 'approval_request') dispatch({ type: 'set_status', taskId: id, status: 'needs_approval' });
      if (event.type === 'approval_resolved' || event.type === 'tool_call') dispatch({ type: 'set_status', taskId: id, status: 'running' });
      if (event.type === 'status' && event.text === 'Completed') dispatch({ type: 'set_status', taskId: id, status: 'done' });
      if (event.type === 'status' && event.text === 'Cancelled by user') dispatch({ type: 'set_status', taskId: id, status: 'cancelled' });
      if (event.type === 'error') dispatch({ type: 'set_status', taskId: id, status: 'failed' });
    }
    setBusy(false);
  };

  return (
    <div className="border-t border-gray-200 p-4 bg-white">
      <div className="flex items-center gap-2 mb-2">
        <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2 py-1.5">
          {agents.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
        </select>
        {busy && <span className="text-xs text-gray-400">Agent working…</span>}
      </div>
      <div className="flex gap-2">
        <input value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Ask an agent to carry out a task..."
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#2196F3]" />
        <Button className="bg-[#2196F3] hover:bg-[#1976D2]" onClick={submit} disabled={busy}><Send className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}
