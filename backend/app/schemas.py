from __future__ import annotations

from pydantic import BaseModel


class RunAgentCheckRequest(BaseModel):
    contribution_id: str
    member_message: str = "Is this contribution overdue? Take whatever action is appropriate."


class SubmitEvidenceRequest(BaseModel):
    contribution_id: str
    claimed_amount: float
    claimed_recipient_account: str
    claimed_date_iso: str
    evidence_type: str = "screenshot"
    member_statement: str | None = None


class ResolveDisputeRequest(BaseModel):
    resolved_by_member_id: str
    accept_payment: bool
    resolution_note: str


class ResumeRunRequest(BaseModel):
    run_id: str
    interrupt_id: str
    approve: bool
