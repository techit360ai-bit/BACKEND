/**
 * Workflow & approval types.
 *
 * Destructive actions pause at an approval gate: the SDK returns `pending_approval`
 * and emits an ApprovalRequest. Execution resumes only once a human records an
 * ApprovalDecision of `approved`.
 */

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ApprovalRequest {
  readonly id: string;
  readonly workspaceId: string;
  readonly requestedBy: string; // actor id (often an agent)
  readonly action: string; // fully-qualified, e.g. 'github.create_pull_request'
  readonly params: unknown;
  readonly reason: string;
  readonly status: ApprovalStatus;
  readonly createdAt: string;
}

export interface ApprovalDecision {
  readonly requestId: string;
  readonly decidedBy: string; // human actor id
  readonly status: 'approved' | 'rejected';
  readonly decidedAt: string;
  readonly comment?: string;
}

let approvalSeq = 0;

export function makeApprovalRequest(
  input: Omit<ApprovalRequest, 'id' | 'status' | 'createdAt'>,
): ApprovalRequest {
  approvalSeq += 1;
  return {
    ...input,
    id: `approval-${Date.now()}-${approvalSeq}`,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
}

/** Store for approval requests/decisions. Production wires this to the workflow service. */
export interface ApprovalStore {
  create(request: ApprovalRequest): void | Promise<void>;
  decide(decision: ApprovalDecision): void | Promise<void>;
  get(requestId: string): ApprovalRequest | undefined | Promise<ApprovalRequest | undefined>;
}

export class InMemoryApprovalStore implements ApprovalStore {
  readonly requests = new Map<string, ApprovalRequest>();
  readonly decisions = new Map<string, ApprovalDecision>();

  create(request: ApprovalRequest): void {
    this.requests.set(request.id, request);
  }

  decide(decision: ApprovalDecision): void {
    const req = this.requests.get(decision.requestId);
    if (!req) throw new Error(`unknown approval request: ${decision.requestId}`);
    this.requests.set(req.id, { ...req, status: decision.status });
    this.decisions.set(decision.requestId, decision);
  }

  get(requestId: string): ApprovalRequest | undefined {
    return this.requests.get(requestId);
  }
}
