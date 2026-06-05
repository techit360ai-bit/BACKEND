import { Webhook, Bot, RefreshCw, ShieldCheck } from 'lucide-react';
import type { ActivityEvent } from '../../lib/types';

const KIND_ICON = {
  webhook: <Webhook className="w-4 h-4 text-blue-500" />,
  agent_action: <Bot className="w-4 h-4 text-purple-500" />,
  sync: <RefreshCw className="w-4 h-4 text-gray-500" />,
  approval: <ShieldCheck className="w-4 h-4 text-amber-500" />,
} as const;

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) return <p className="text-sm text-gray-400">No recent activity.</p>;
  return (
    <ul className="space-y-3">
      {events.map((e) => (
        <li key={e.id} className="flex items-start gap-3">
          <div className="mt-0.5">{KIND_ICON[e.kind]}</div>
          <div>
            <p className="text-sm text-gray-700">{e.summary}</p>
            <p className="text-xs text-gray-400">{e.at}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
