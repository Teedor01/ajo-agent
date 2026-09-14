// Typed client for the Ajo Continuity Agent backend. Every shape here
// mirrors an actual, tested FastAPI response -- nothing here is invented.
// See backend/app/queries.py, app/main.py, app/schemas.py for the source
// of truth these types were taken from.

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      typeof body?.detail === "string"
        ? body.detail
        : Array.isArray(body?.detail)
          ? body.detail.map((d: { msg?: string }) => d.msg).join("; ")
          : `Request to ${path} failed (${res.status})`;
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}

// --- Types (mirrors backend/app/queries.py + app/schemas.py) --------------

export type GroupSummary = {
  id: string;
  name: string;
  current_cycle: number;
};

export type GroupOverview = {
  id: string;
  name: string;
  contribution_amount: string;
  currency: string;
  schedule: string;
  grace_period_hours: number;
  registered_account_name: string;
  registered_account_number: string;
  current_cycle: number;
  member_count: number;
  cycle_summary: {
    paid: number;
    overdue_or_pending: number;
    disputed: number;
  };
};

export type Member = {
  id: string;
  name: string;
  payout_order: number;
  has_received_payout: boolean;
  is_admin: boolean;
};

export type EvidenceStatus = "verified" | "conflict" | "none";
export type ContributionStatusValue = "pending" | "paid" | "overdue" | "disputed" | "partial";

export type ContributionRow = {
  contribution_id: string;
  member_id: string;
  member_name: string;
  cycle_number: number;
  amount_due: string;
  amount_paid: string;
  due_at: string;
  status: ContributionStatusValue;
  is_overdue: boolean;
  reminder_sent_count: number;
  evidence_status: EvidenceStatus;
};

export type PaymentRecord = {
  id: string;
  amount: string;
  claimed_at: string;
  evidence_recipient_account: string | null;
  evidence_date: string | null;
  verified: boolean;
};

export type ContributionDetail = {
  id: string;
  group_id: string;
  member_id: string;
  cycle_number: number;
  amount_due: string;
  amount_paid: string;
  due_at: string;
  status: ContributionStatusValue;
  reminder_sent_count: number;
  payments: PaymentRecord[];
  overdue_check: {
    contribution_id: string;
    is_overdue: boolean;
    due_at: string;
    grace_deadline: string;
    now: string;
    hours_past_grace: number | null;
    rule: string;
  };
};

export type DisputeStatusValue = "open" | "resolved_confirmed" | "resolved_rejected";

export type DisputeRow = {
  dispute_id: string;
  contribution_id: string;
  member_name: string | null;
  reason: string;
  conflict_field: string | null;
  status: DisputeStatusValue;
  created_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
};

export type ReceiptRow = {
  receipt_id: string;
  sequence_number: number;
  action: string;
  facts: string;
  rule_applied: string;
  decision: string;
  related_contribution_id: string | null;
  related_dispute_id: string | null;
  member_name: string | null;
  prev_hash: string | null;
  hash: string;
  created_at: string;
};

export type ReceiptsResponse = {
  chain_valid: boolean;
  broken_at_receipt_id: string | null;
  receipts: ReceiptRow[];
};

export type AgentDecision = {
  facts: string;
  rule_applied: string;
  decision: string;
  action_taken: string;
  requires_human: boolean;
  escalation_reason: string | null;
};

export type RunAgentCheckResponse = {
  structured_decision: AgentDecision | null;
  stop_reason: string;
  interrupted: boolean;
  run_id?: string;
  interrupts?: { id: string; name: string; reason: unknown }[];
};

// --- API calls --------------------------------------------------------

export const api = {
  health: () => request<{ status: string }>("/health"),

  listGroups: () => request<GroupSummary[]>("/groups"),
  getGroup: (groupId: string) => request<GroupOverview>(`/groups/${groupId}`),
  getMembers: (groupId: string) => request<Member[]>(`/groups/${groupId}/members`),
  getContributions: (groupId: string) =>
    request<ContributionRow[]>(`/groups/${groupId}/contributions`),
  getContribution: (contributionId: string) =>
    request<ContributionDetail>(`/contributions/${contributionId}`),

  getDisputes: (groupId: string) => request<DisputeRow[]>(`/groups/${groupId}/disputes`),
  getDispute: (disputeId: string) =>
    request<{
      dispute_id: string;
      contribution_id: string;
      member_name: string | null;
      amount_due: string | null;
      reason: string;
      conflict_field: string | null;
      status: DisputeStatusValue;
      created_at: string;
      resolved_at: string | null;
      resolved_by: string | null;
      resolution_note: string | null;
      registered_account_name: string | null;
      registered_account_number: string | null;
      group_name: string | null;
      evidence: {
        amount: string;
        recipient_account: string | null;
        date: string | null;
        evidence_type: string | null;
        member_statement: string | null;
      } | null;
      checks: {
        amount_matches: boolean;
        recipient_matches: boolean;
        date_plausible: boolean;
      } | null;
    }>(`/disputes/${disputeId}`),
  resolveDispute: (
    disputeId: string,
    body: { resolved_by_member_id: string; accept_payment: boolean; resolution_note: string },
  ) =>
    request<{ dispute_id: string; status: string; contribution_status: string }>(
      `/disputes/${disputeId}/resolve`,
      { method: "POST", body: JSON.stringify(body) },
    ),

  getReceipts: (groupId: string) => request<ReceiptsResponse>(`/groups/${groupId}/receipts`),

  submitEvidence: (body: {
    contribution_id: string;
    claimed_amount: number;
    claimed_recipient_account: string;
    claimed_date_iso: string;
    evidence_type?: string;
  }) =>
    request<{ payment_id: string; verdict: string; conflict_field: string | null; reason: string }>(
      "/demo/submit-evidence",
      { method: "POST", body: JSON.stringify(body) },
    ),

  runAgentCheck: (body: { contribution_id: string; member_message?: string }) =>
    request<RunAgentCheckResponse>("/demo/run-agent-check", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  resumeRun: (body: { run_id: string; interrupt_id: string; approve: boolean }) =>
    request<RunAgentCheckResponse>("/demo/resume-run", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  resetDemo: () => request<{ status: string }>("/demo/reset", { method: "POST" }),
};
