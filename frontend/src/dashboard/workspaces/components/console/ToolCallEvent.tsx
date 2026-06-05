import { Terminal, CheckCircle2, XCircle } from 'lucide-react';
import type { TaskEvent } from '../../lib/types';

export function ToolCallEvent({ event }: { event: TaskEvent }) {
  if (event.type === 'tool_call' && event.tool) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-md px-3 py-2 font-mono">
        <Terminal className="w-4 h-4 text-[#2196F3]" />
        <span>{event.tool.connectorId}.{event.tool.name}()</span>
      </div>
    );
  }
  if (event.type === 'tool_result' && event.result) {
    const ok = event.result.ok;
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500 pl-6">
        {ok ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}
        <span>{String(event.result.detail)}</span>
      </div>
    );
  }
  return null;
}
