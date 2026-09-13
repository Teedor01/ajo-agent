from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal


@dataclass(frozen=True)
class EvidenceVerdict:
    verdict: str 
    conflict_field: str | None
    reason: str


def evaluate_payment_evidence(
    *,
    claimed_amount: Decimal,
    expected_amount: Decimal,
    claimed_recipient_account: str | None,
    registered_account_number: str,
    claimed_date: datetime | None,
    due_at: datetime,
    grace_period_hours: int,
) -> EvidenceVerdict:
    """Fixed rule set — no LLM judgment calls. Order matters: the first
    failing check is reported as the conflict reason."""

    if claimed_recipient_account is None or claimed_date is None:
        return EvidenceVerdict(
            verdict="insufficient",
            conflict_field=None,
            reason="Evidence is missing required fields (recipient account or payment date).",
        )

    if claimed_recipient_account.strip() != registered_account_number.strip():
        return EvidenceVerdict(
            verdict="conflict",
            conflict_field="recipient_account",
            reason=(
                f"Recipient account on the evidence ({claimed_recipient_account}) does not match "
                f"the group's registered account ({registered_account_number})."
            ),
        )

    if claimed_amount != expected_amount:
        return EvidenceVerdict(
            verdict="conflict",
            conflict_field="amount",
            reason=f"Claimed amount ({claimed_amount}) does not match the amount due ({expected_amount}).",
        )


    grace_deadline = due_at + timedelta(hours=grace_period_hours)
    earliest_plausible = due_at - timedelta(days=14)
    if claimed_date < earliest_plausible or claimed_date > grace_deadline + timedelta(days=30):
        return EvidenceVerdict(
            verdict="conflict",
            conflict_field="date",
            reason=f"Claimed payment date ({claimed_date.date()}) is not plausible for this cycle's window.",
        )

    return EvidenceVerdict(
        verdict="verified",
        conflict_field=None,
        reason="Evidence matches amount, registered account, and a plausible date.",
    )
