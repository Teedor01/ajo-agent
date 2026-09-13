from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta


@dataclass(frozen=True)
class OverdueCheck:
    is_overdue: bool
    due_at: datetime
    grace_deadline: datetime
    now: datetime
    hours_past_grace: float | None  


def check_overdue(due_at: datetime, grace_period_hours: int, now: datetime | None = None) -> OverdueCheck:
    """A contribution becomes overdue `grace_period_hours` after `due_at`, not at `due_at` itself.
    This is the single source of truth for the rule stated in every demo scenario."""
    now = now or datetime.utcnow()
    grace_deadline = due_at + timedelta(hours=grace_period_hours)
    overdue = now > grace_deadline
    hours_past = (now - grace_deadline).total_seconds() / 3600 if overdue else None
    return OverdueCheck(
        is_overdue=overdue,
        due_at=due_at,
        grace_deadline=grace_deadline,
        now=now,
        hours_past_grace=hours_past,
    )


def rule_description(grace_period_hours: int) -> str:
    return f"Contributions become overdue {grace_period_hours} hours after the deadline."
