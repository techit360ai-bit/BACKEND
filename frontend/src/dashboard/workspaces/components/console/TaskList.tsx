import { Badge } from '../ui/badge';
import { useConsole } from '../../lib/console/ConsoleContext';
import type { AgentTaskStatus } from '../../lib/types';

const STATUS_STYLE: Record<AgentTaskStatus, string> = {
  queued: 'bg-gray-100 text-gray-600', running: 'bg-blue-100 text-blue-700',
  needs_approval: 'bg-amber-100 text-amber-800', done: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700', cancelled: 'bg-gray-100 text-gray-500',
};

export function TaskList() {
  const { state, dispatch } = useConsole();
  return (
    <div className="w-[260px] border-r border-gray-200 overflow-y-auto">
      <div className="p-3 text-xs font-semibold uppercase text-gray-400">Tasks</div>
      {state.tasks.length === 0 && <p className="px-3 text-sm text-gray-400">No tasks yet.</p>}
      <ul>
        {state.tasks.map((t) => (
          <li key={t.id}>
            <button
              onClick={() => dispatch({ type: 'select', id: t.id })}
              className={`w-full text-left px-3 py-3 border-b border-gray-100 hover:bg-gray-50 ${state.activeTaskId === t.id ? 'bg-gray-50' : ''}`}>
              <p className="text-sm font-medium text-gray-800 line-clamp-2">{t.prompt}</p>
              <Badge className={`mt-1.5 text-xs ${STATUS_STYLE[t.status]}`}>{t.status.replace('_', ' ')}</Badge>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
