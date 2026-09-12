from __future__ import annotations

from pydantic import BaseModel, Field


class AgentDecision(BaseModel):
    facts: str = Field(..., description="Observable facts only — no inference, no hidden reasoning.")
    rule_applied: str = Field(..., description="The specific deterministic rule that governs this case.")
    decision: str = Field(..., description="The conclusion reached, stated plainly.")
    action_taken: str = Field(..., description="What the agent did as a result, or 'none' if escalating.")
    requires_human: bool = Field(..., description="True if a human must make the final call.")
    escalation_reason: str | None = Field(
        default=None, description="If requires_human is True, why the agent could not proceed alone."
    )
