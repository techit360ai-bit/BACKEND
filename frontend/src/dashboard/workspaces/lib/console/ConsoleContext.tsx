import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react';
import type { AgentTask, TaskEvent, AgentTaskStatus } from '../types';

interface State { tasks: AgentTask[]; activeTaskId: string | null; }

type Action =
  | { type: 'set_tasks'; tasks: AgentTask[] }
  | { type: 'add_task'; task: AgentTask }
  | { type: 'select'; id: string }
  | { type: 'append_event'; taskId: string; event: TaskEvent }
  | { type: 'set_status'; taskId: string; status: AgentTaskStatus }
  | { type: 'resolve_approval'; taskId: string; approvalId: string; decision: 'approved' | 'rejected' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'set_tasks': return { ...state, tasks: action.tasks };
    case 'add_task': return { ...state, tasks: [action.task, ...state.tasks], activeTaskId: action.task.id };
    case 'select': return { ...state, activeTaskId: action.id };
    case 'append_event':
      return { ...state, tasks: state.tasks.map((t) => t.id === action.taskId ? { ...t, events: [...t.events, action.event] } : t) };
    case 'set_status':
      return { ...state, tasks: state.tasks.map((t) => t.id === action.taskId ? { ...t, status: action.status } : t) };
    case 'resolve_approval':
      return { ...state, tasks: state.tasks.map((t) => t.id === action.taskId ? {
        ...t,
        events: t.events.map((e) =>
          e.type === 'approval_request' && e.approval && e.approval.id === action.approvalId
            ? { ...e, approval: { ...e.approval, resolved: action.decision } }
            : e),
      } : t) };
    default: return state;
  }
}

const ConsoleContext = createContext<{ state: State; dispatch: Dispatch<Action> } | null>(null);

export function ConsoleProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { tasks: [], activeTaskId: null });
  return <ConsoleContext.Provider value={{ state, dispatch }}>{children}</ConsoleContext.Provider>;
}

export function useConsole() {
  const ctx = useContext(ConsoleContext);
  if (!ctx) throw new Error('useConsole must be used within ConsoleProvider');
  return ctx;
}
