import { AlertTriangle } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { Badge } from '../ui/badge';
import { ActivityFeed } from './ActivityFeed';
import type { Connector, ActivityEvent } from '../../lib/types';

interface Props {
  connector: Connector | null;
  activity: ActivityEvent[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectorDrawer({ connector, activity, open, onOpenChange }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[420px] sm:max-w-[420px] overflow-y-auto">
        {connector && (
          <>
            <SheetHeader>
              <SheetTitle>{connector.name}</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-6">
              <div>
                <h4 className="text-xs font-semibold uppercase text-gray-400 mb-2">MCP Tools</h4>
                <ul className="space-y-2">
                  {connector.tools.map((t) => (
                    <li key={t.name} className="border border-gray-100 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <code className="text-sm font-medium">{t.name}</code>
                        {t.destructive && (
                          <Badge className="bg-red-100 text-red-700 text-xs"><AlertTriangle className="w-3 h-3 mr-1" />approval</Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{t.description}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase text-gray-400 mb-2">Resources</h4>
                <div className="flex flex-wrap gap-1.5">
                  {connector.resources.map((r) => (<Badge key={r} variant="secondary" className="text-xs">{r}</Badge>))}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase text-gray-400 mb-2">Recent Activity</h4>
                <ActivityFeed events={activity} />
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
