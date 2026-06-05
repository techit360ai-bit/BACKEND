import { ShieldAlert } from 'lucide-react';
import { Button } from '../ui/button';
import type { ApprovalRequest } from '../../lib/types';

interface Props {
  approval: ApprovalRequest;
  onResolve: (decision: 'approved' | 'rejected') => void;
}

export function ApprovalCard({ approval, onResolve }: Props) {
  const resolved = approval.resolved;
  return (
    <div className="border border-amber-300 bg-amber-50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <ShieldAlert className="w-4 h-4 text-amber-600" />
        <span className="text-sm font-semibold text-amber-800">Approval required</span>
      </div>
      <p className="text-sm text-gray-700 mb-3">{approval.summary}</p>
      <p className="text-xs text-gray-500 mb-3 font-mono">{approval.connectorId}.{approval.action}</p>
      {resolved ? (
        <span className={`text-sm font-medium ${resolved === 'approved' ? 'text-green-700' : 'text-red-700'}`}>
          {resolved === 'approved' ? 'Approved' : 'Rejected'}
        </span>
      ) : (
        <div className="flex gap-2">
          <Button className="bg-green-600 hover:bg-green-700" onClick={() => onResolve('approved')}>Approve</Button>
          <Button variant="outline" onClick={() => onResolve('rejected')}>Reject</Button>
        </div>
      )}
    </div>
  );
}
