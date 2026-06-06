import { Bot } from 'lucide-react';
import { useConsole } from '../../lib/console/ConsoleContext';
import { resolveApproval } from '../../lib/api/tasks';
import { ToolCallEvent } from './ToolCallEvent';
import { ApprovalCard } from './ApprovalCard';

export function Transcript() {
  const { state, dispatch } = useConsole();
  const task = state.tasks.find((t) => t.id === state.activeTaskId);

  // Reflect the decision on the card immediately, and unblock the stream.
  const handleResolve = (taskId: string, approvalId: string, decision: 'approved' | 'rejected') => {
    dispatch({ type: 'resolve_approval', taskId, approvalId, decision });
    resolveApproval(taskId, approvalId, decision);
  };

  if (!task) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
        <Bot className="w-10 h-10 mb-2" />
        <p>Select a task or start a new one below.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      {task.events.map((e) => {
        if (e.type === 'message' || e.type === 'status') {
          return <p key={e.id} className={`text-sm ${e.type === 'status' ? 'text-gray-400 italic' : 'text-gray-800'}`}>{e.text}</p>;
        }
        if (e.type === 'error') {
          return <p key={e.id} className="text-sm text-red-600">{e.text}</p>;
        }
        if (e.type === 'tool_call' || e.type === 'tool_result') {
          return <ToolCallEvent key={e.id} event={e} />;
        }
        if (e.type === 'approval_request' && e.approval) {
          const ap = e.approval;
          return <ApprovalCard key={e.id} approval={ap} onResolve={(d) => handleResolve(task.id, ap.id, d)} />;
        }
        return null;
      })}
    </div>
  );
}
