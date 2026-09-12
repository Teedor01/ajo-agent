from __future__ import annotations

import json
from datetime import datetime
from decimal import Decimal

from strands import tool
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.domain.overdue import check_overdue, rule_description
from app.domain.disputes import evaluate_payment_evidence
from app.domain.receipts import compute_receipt_hash
from app.models import (
    ActionReceipt,
    Contribution,
    ContributionStatus,
    Dispute,
    DisputeStatus,
    Group,
    Member,
    Payment,
    new_id,
)


def _session() -> Session:
    return SessionLocal()


@tool
def get_group(group_id: str) -> dict:
    """Fetch a group's configuration: contribution amount, schedule, grace period,
    registered payout account, and current cycle number."""
    with _session() as db:
        g = db.get(Group, group_id)
        if not g:
            return {"error": f"No group found with id {group_id}"}
        return {
            "id": g.id,
            "name": g.name,
            "contribution_amount": str(g.contribution_amount),
            "currency": g.currency,
            "schedule": g.schedule,
            "grace_period_hours": g.grace_period_hours,
            "registered_account_name": g.registered_account_name,
            "registered_account_number": g.registered_account_number,
            "current_cycle": g.current_cycle,
        }


@tool
def get_members(group_id: str) -> list[dict]:
    """List all members of a group in payout order."""
    with _session() as db:
        members = (
            db.query(Member)
            .filter(Member.group_id == group_id)
            .order_by(Member.payout_order)
            .all()
        )
        return [
            {
                "id": m.id,
                "name": m.name,
                "payout_order": m.payout_order,
                "has_received_payout": m.has_received_payout,
                "is_admin": m.is_admin,
            }
            for m in members
        ]


@tool
def get_contribution_status(contribution_id: str) -> dict:
    """Fetch a single contribution's current status, amount due/paid, deadline,
    and any payments (verified or unverified) recorded against it. Includes
    the group_id, so you never need to guess or separately look it up when
    calling create_action_receipt afterward."""
    with _session() as db:
        c = db.get(Contribution, contribution_id)
        if not c:
            return {"error": f"No contribution found with id {contribution_id}"}
        payments = db.query(Payment).filter(Payment.contribution_id == c.id).all()
        return {
            "id": c.id,
            "group_id": c.group_id,
            "member_id": c.member_id,
            "cycle_number": c.cycle_number,
            "amount_due": str(c.amount_due),
            "amount_paid": str(c.amount_paid),
            "due_at": c.due_at.isoformat(),
            "status": c.status.value,
            "reminder_sent_count": c.reminder_sent_count,
            "payments": [
                {
                    "id": p.id,
                    "amount": str(p.amount),
                    "claimed_at": p.claimed_at.isoformat(),
                    "evidence_recipient_account": p.evidence_recipient_account,
                    "evidence_date": p.evidence_date.isoformat() if p.evidence_date else None,
                    "verified": p.verified,
                }
                for p in payments
            ],
        }


@tool
def calculate_overdue_status(contribution_id: str) -> dict:
    """Deterministically check whether a contribution is overdue, using the group's
    grace period. This performs the actual date/time math... do not estimate it yourself,
    always call this tool and report its result."""
    with _session() as db:
        c = db.get(Contribution, contribution_id)
        if not c:
            return {"error": f"No contribution found with id {contribution_id}"}
        group = db.get(Group, c.group_id)
        result = check_overdue(c.due_at, group.grace_period_hours)
        return {
            "contribution_id": contribution_id,
            "is_overdue": result.is_overdue,
            "due_at": result.due_at.isoformat(),
            "grace_deadline": result.grace_deadline.isoformat(),
            "now": result.now.isoformat(),
            "hours_past_grace": result.hours_past_grace,
            "rule": rule_description(group.grace_period_hours),
        }


@tool
def submit_payment_evidence(
    contribution_id: str,
    claimed_amount: float,
    claimed_recipient_account: str,
    claimed_date_iso: str,
    evidence_type: str = "screenshot",
    member_statement: str | None = None,
) -> dict:
    """Record a member's payment claim with structured evidence fields (already
    extracted from a screenshot/receipt upstream... this tool does not read images).
    member_statement is the member's own words, if available (e.g. "I paid
    yesterday")... stored for display only, never used to determine the verdict.
    Deterministically evaluates the evidence against the group's registered account,
    the amount due, and a plausible date window. Returns verdict: 'verified',
    'conflict', or 'insufficient'. Does NOT mark the contribution as paid on its own...
    call record_payment separately once a human or this tool has confirmed 'verified'."""
    with _session() as db:
        c = db.get(Contribution, contribution_id)
        if not c:
            return {"error": f"No contribution found with id {contribution_id}"}
        group = db.get(Group, c.group_id)

        claimed_date = datetime.fromisoformat(claimed_date_iso)
        verdict = evaluate_payment_evidence(
            claimed_amount=Decimal(str(claimed_amount)),
            expected_amount=Decimal(str(c.amount_due)),
            claimed_recipient_account=claimed_recipient_account,
            registered_account_number=group.registered_account_number,
            claimed_date=claimed_date,
            due_at=c.due_at,
            grace_period_hours=group.grace_period_hours,
        )

        payment = Payment(
            contribution_id=c.id,
            amount=Decimal(str(claimed_amount)),
            evidence_type=evidence_type,
            evidence_recipient_account=claimed_recipient_account,
            evidence_date=claimed_date,
            verified=(verdict.verdict == "verified"),
            verification_note=verdict.reason,
            member_statement=member_statement,
        )
        db.add(payment)
        db.commit()
        db.refresh(payment)

        return {
            "payment_id": payment.id,
            "verdict": verdict.verdict,
            "conflict_field": verdict.conflict_field,
            "reason": verdict.reason,
        }


@tool
def record_payment(contribution_id: str, payment_id: str) -> dict:
    """Mark a contribution PAID using an already-verified payment record.
    This tool refuses to run if the referenced payment is not verified...
    it will not mark a contribution paid on a member's claim alone."""
    with _session() as db:
        c = db.get(Contribution, contribution_id)
        payment = db.get(Payment, payment_id)
        if not c or not payment:
            return {"error": "Contribution or payment not found."}
        if payment.contribution_id != c.id:
            return {"error": "Payment does not belong to this contribution."}
        if not payment.verified:
            return {
                "error": "Refused: payment is not verified. Evidence must be verified "
                "before a contribution can be marked paid."
            }
        c.amount_paid = payment.amount
        c.status = ContributionStatus.PAID
        db.commit()
        return {"contribution_id": c.id, "status": c.status.value}


@tool
def send_reminder(contribution_id: str) -> dict:
    """Send (simulated) a reminder to the member for an overdue contribution and
    increment the reminder counter. Use only after calculate_overdue_status confirms
    the contribution is genuinely overdue."""
    with _session() as db:
        c = db.get(Contribution, contribution_id)
        if not c:
            return {"error": f"No contribution found with id {contribution_id}"}
        c.status = ContributionStatus.OVERDUE
        c.reminder_sent_count += 1
        c.last_reminder_at = datetime.utcnow()
        db.commit()
        return {
            "contribution_id": c.id,
            "reminder_sent_count": c.reminder_sent_count,
            "sent_at": c.last_reminder_at.isoformat(),
        }


@tool
def create_dispute(contribution_id: str, payment_id: str, reason: str, conflict_field: str | None = None) -> dict:
    """Open a dispute for a contribution when payment evidence conflicts with group
    records. This does NOT resolve anything... it only records that human judgment
    is required and marks the contribution DISPUTED. Only the group admin can resolve it."""
    with _session() as db:
        c = db.get(Contribution, contribution_id)
        if not c:
            return {"error": f"No contribution found with id {contribution_id}"}
        dispute = Dispute(
            group_id=c.group_id,
            contribution_id=contribution_id,
            payment_id=payment_id,
            reason=reason,
            conflict_field=conflict_field,
        )
        c.status = ContributionStatus.DISPUTED
        db.add(dispute)
        db.commit()
        db.refresh(dispute)
        return {"dispute_id": dispute.id, "status": dispute.status.value}


@tool
def get_dispute(dispute_id: str) -> dict:
    """Fetch a dispute's current state, reason, and resolution if any."""
    with _session() as db:
        d = db.get(Dispute, dispute_id)
        if not d:
            return {"error": f"No dispute found with id {dispute_id}"}
        return {
            "id": d.id,
            "contribution_id": d.contribution_id,
            "reason": d.reason,
            "conflict_field": d.conflict_field,
            "status": d.status.value,
            "resolved_by": d.resolved_by,
            "resolution_note": d.resolution_note,
        }


@tool
def resolve_dispute(dispute_id: str, resolved_by_member_id: str, accept_payment: bool, resolution_note: str) -> dict:
    """Resolve a dispute. This tool is gated behind human confirmation (see
    InterventionHandler)... the agent may propose calling it, but a group admin
    must approve before it actually executes. accept_payment=True marks the
    underlying contribution PAID; False leaves it PENDING/OVERDUE for the member
    to resolve outside the app."""
    with _session() as db:
        d = db.get(Dispute, dispute_id)
        if not d:
            return {"error": f"No dispute found with id {dispute_id}"}
        member = db.get(Member, resolved_by_member_id)
        if not member or not member.is_admin:
            return {"error": "Only a group admin can resolve a dispute."}

        d.status = DisputeStatus.RESOLVED_CONFIRMED if accept_payment else DisputeStatus.RESOLVED_REJECTED
        d.resolved_by = resolved_by_member_id
        d.resolution_note = resolution_note
        d.resolved_at = datetime.utcnow()

        c = db.get(Contribution, d.contribution_id)
        if accept_payment:
            if d.payment_id:
                payment = db.get(Payment, d.payment_id)
                payment.verified = True
                c.amount_paid = payment.amount
            c.status = ContributionStatus.PAID
        else:
            c.status = ContributionStatus.OVERDUE

        db.commit()
        return {"dispute_id": d.id, "status": d.status.value, "contribution_status": c.status.value}


@tool
def create_action_receipt(
    action: str,
    facts: str,
    rule_applied: str,
    decision: str,
    related_contribution_id: str | None = None,
    related_dispute_id: str | None = None,
    group_id: str | None = None,
) -> dict:
    """Append a tamper-evident receipt for an autonomous action the agent just took.
    Call this after every meaningful action (reminder sent, dispute created, payment
    recorded) so the action is explainable and inspectable later. Not a blockchain...
    a hash chain linked to the previous receipt in this group.

    You do NOT need to look up or supply group_id yourself — pass
    related_contribution_id or related_dispute_id (whichever this action is
    about) and the group is derived from that record automatically. Only pass
    group_id directly for an action with no associated contribution or dispute."""
    with _session() as db:
        resolved_group_id = group_id
        if not resolved_group_id and related_contribution_id:
            c = db.get(Contribution, related_contribution_id)
            if not c:
                return {"error": f"No contribution found with id {related_contribution_id}"}
            resolved_group_id = c.group_id
        elif not resolved_group_id and related_dispute_id:
            d = db.get(Dispute, related_dispute_id)
            if not d:
                return {"error": f"No dispute found with id {related_dispute_id}"}
            resolved_group_id = d.group_id

        if not resolved_group_id:
            return {
                "error": "Could not determine group_id. Pass related_contribution_id, "
                "related_dispute_id, or an explicit group_id."
            }
        group_id = resolved_group_id

        last = (
            db.query(ActionReceipt)
            .filter(ActionReceipt.group_id == group_id)
            .order_by(ActionReceipt.sequence_number.desc())
            .first()
        )
        seq = (last.sequence_number + 1) if last else 1
        prev_hash = last.hash if last else None

        
        receipt_id = new_id("rcpt")
        facts_str = facts if isinstance(facts, str) else json.dumps(facts)

        receipt_hash = compute_receipt_hash(
            receipt_id=receipt_id,
            sequence_number=seq,
            action=action,
            facts=facts_str,
            rule_applied=rule_applied,
            decision=decision,
            prev_hash=prev_hash,
        )

        receipt = ActionReceipt(
            id=receipt_id,
            group_id=group_id,
            sequence_number=seq,
            action=action,
            facts=facts_str,
            rule_applied=rule_applied,
            decision=decision,
            related_contribution_id=related_contribution_id,
            related_dispute_id=related_dispute_id,
            prev_hash=prev_hash,
            hash=receipt_hash,
        )
        db.add(receipt)
        db.commit()
        db.refresh(receipt)
        return {"receipt_id": receipt.id, "sequence_number": seq, "hash": receipt.hash}


ALL_TOOLS = [
    get_group,
    get_members,
    get_contribution_status,
    calculate_overdue_status,
    submit_payment_evidence,
    record_payment,
    send_reminder,
    create_dispute,
    get_dispute,
    resolve_dispute,
    create_action_receipt,
]
