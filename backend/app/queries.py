
from __future__ import annotations

from app.db import SessionLocal
from app.domain.overdue import check_overdue
from app.domain.receipts import verify_chain
from app.models import ActionReceipt, Contribution, Dispute, Group, Member, Payment


def list_groups() -> list[dict]:
    with SessionLocal() as db:
        groups = db.query(Group).all()
        return [{"id": g.id, "name": g.name, "current_cycle": g.current_cycle} for g in groups]


def get_group_overview(group_id: str) -> dict:
    with SessionLocal() as db:
        g = db.get(Group, group_id)
        if not g:
            return {"error": f"No group found with id {group_id}"}
        contributions = db.query(Contribution).filter(Contribution.group_id == group_id).all()
        paid = sum(1 for c in contributions if c.status.value == "paid")
        overdue = sum(1 for c in contributions if c.status.value in ("overdue", "pending"))
        disputed = sum(1 for c in contributions if c.status.value == "disputed")
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
            "member_count": db.query(Member).filter(Member.group_id == group_id).count(),
            "cycle_summary": {"paid": paid, "overdue_or_pending": overdue, "disputed": disputed},
        }


def list_contributions(group_id: str) -> list[dict]:
    with SessionLocal() as db:
        g = db.get(Group, group_id)
        if not g:
            return []
        rows = (
            db.query(Contribution, Member)
            .join(Member, Contribution.member_id == Member.id)
            .filter(Contribution.group_id == group_id)
            .order_by(Member.payout_order)
            .all()
        )
        out = []
        for c, m in rows:
            overdue_check = check_overdue(c.due_at, g.grace_period_hours)

            open_dispute = (
                db.query(Dispute)
                .filter(Dispute.contribution_id == c.id, Dispute.status == "open")
                .first()
            )
            has_verified_payment = (
                db.query(Payment).filter(Payment.contribution_id == c.id, Payment.verified.is_(True)).first()
            )
            if open_dispute:
                evidence_status = "conflict"
            elif has_verified_payment:
                evidence_status = "verified"
            else:
                evidence_status = "none"

            out.append(
                {
                    "contribution_id": c.id,
                    "member_id": m.id,
                    "member_name": m.name,
                    "cycle_number": c.cycle_number,
                    "amount_due": str(c.amount_due),
                    "amount_paid": str(c.amount_paid),
                    "due_at": c.due_at.isoformat(),
                    "status": c.status.value,
                    "is_overdue": overdue_check.is_overdue,
                    "reminder_sent_count": c.reminder_sent_count,
                    "evidence_status": evidence_status,
                }
            )
        return out


def list_disputes(group_id: str) -> list[dict]:
    with SessionLocal() as db:
        rows = db.query(Dispute).filter(Dispute.group_id == group_id).order_by(Dispute.created_at.desc()).all()
        out = []
        for d in rows:
            contribution = db.get(Contribution, d.contribution_id)
            member = db.get(Member, contribution.member_id) if contribution else None
            out.append(
                {
                    "dispute_id": d.id,
                    "contribution_id": d.contribution_id,
                    "member_name": member.name if member else None,
                    "reason": d.reason,
                    "conflict_field": d.conflict_field,
                    "status": d.status.value,
                    "created_at": d.created_at.isoformat(),
                    "resolved_at": d.resolved_at.isoformat() if d.resolved_at else None,
                    "resolution_note": d.resolution_note,
                }
            )
        return out


def get_dispute_detail(dispute_id: str) -> dict:
    with SessionLocal() as db:
        d = db.get(Dispute, dispute_id)
        if not d:
            return {"error": f"No dispute found with id {dispute_id}"}
        contribution = db.get(Contribution, d.contribution_id)
        member = db.get(Member, contribution.member_id) if contribution else None
        group = db.get(Group, d.group_id)
        payment = db.get(Payment, d.payment_id) if d.payment_id else None

        evidence = None
        checks = None
        if payment and contribution and group:
            amount_matches = payment.amount == contribution.amount_due
            recipient_matches = (
                (payment.evidence_recipient_account or "").strip() == group.registered_account_number.strip()
            )
            evidence = {
                "amount": str(payment.amount),
                "recipient_account": payment.evidence_recipient_account,
                "date": payment.evidence_date.isoformat() if payment.evidence_date else None,
                "evidence_type": payment.evidence_type,
                "member_statement": payment.member_statement,
            }
            checks = {
                "amount_matches": amount_matches,
                "recipient_matches": recipient_matches,

                "date_plausible": amount_matches or recipient_matches,
            }

        return {
            "dispute_id": d.id,
            "contribution_id": d.contribution_id,
            "member_name": member.name if member else None,
            "amount_due": str(contribution.amount_due) if contribution else None,
            "reason": d.reason,
            "conflict_field": d.conflict_field,
            "status": d.status.value,
            "created_at": d.created_at.isoformat(),
            "resolved_at": d.resolved_at.isoformat() if d.resolved_at else None,
            "resolved_by": d.resolved_by,
            "resolution_note": d.resolution_note,
            "registered_account_name": group.registered_account_name if group else None,
            "registered_account_number": group.registered_account_number if group else None,
            "group_name": group.name if group else None,
            "evidence": evidence,
            "checks": checks,
        }


def list_receipts(group_id: str) -> dict:
    with SessionLocal() as db:
        rows = (
            db.query(ActionReceipt)
            .filter(ActionReceipt.group_id == group_id)
            .order_by(ActionReceipt.sequence_number)
            .all()
        )
        chain_input = [
            {
                "id": r.id,
                "sequence_number": r.sequence_number,
                "action": r.action,
                "facts": r.facts,
                "rule_applied": r.rule_applied,
                "decision": r.decision,
                "hash": r.hash,
            }
            for r in rows
        ]
        valid, broken_id = verify_chain(chain_input)

        def member_name_for(r: ActionReceipt) -> str | None:
            if not r.related_contribution_id:
                return None
            c = db.get(Contribution, r.related_contribution_id)
            if not c:
                return None
            m = db.get(Member, c.member_id)
            return m.name if m else None

        return {
            "chain_valid": valid,
            "broken_at_receipt_id": broken_id,
            "receipts": [
                {
                    "receipt_id": r.id,
                    "sequence_number": r.sequence_number,
                    "action": r.action,
                    "facts": r.facts,
                    "rule_applied": r.rule_applied,
                    "decision": r.decision,
                    "related_contribution_id": r.related_contribution_id,
                    "related_dispute_id": r.related_dispute_id,
                    "member_name": member_name_for(r),
                    "prev_hash": r.prev_hash,
                    "hash": r.hash,
                    "created_at": r.created_at.isoformat(),
                }
                for r in rows
            ],
        }
