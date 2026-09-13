from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal

from app.db import SessionLocal, init_db
from app.models import Contribution, ContributionStatus, Group, Member, Payment

MEMBER_NAMES = [
    "Chidi", "Amaka", "Ifeanyi", "Ngozi", "Tunde", "Blessing",
    "Emeka", "Funmilayo", "Obinna", "Adaeze", "Kelechi", "Yemisi",
]


def run() -> None:
    init_db()
    db = SessionLocal()

    existing = db.query(Group).filter(Group.name == "Udo Ajo Circle").first()
    if existing:
        print(f"Udo Ajo Circle already seeded (id={existing.id}). Skipping.")
        return

    group = Group(
        name="Udo Ajo Circle",
        contribution_amount=Decimal("20000.00"),
        currency="NGN",
        schedule="weekly",
        grace_period_hours=48,
        timezone="Africa/Lagos",
        registered_account_name="Udo Ajo Circle - Group Account",
        registered_account_number="0123456789",
        current_cycle=3,
    )
    db.add(group)
    db.flush()

    members = []
    for i, name in enumerate(MEMBER_NAMES, start=1):
        m = Member(
            group_id=group.id,
            name=name,
            phone=f"080{1000000 + i}",
            payout_order=i,
            has_received_payout=(i <= 2), 
            is_admin=(i == 1),  
        )
        members.append(m)
    members[0].is_admin = False
    members[1].is_admin = True
    db.add_all(members)
    db.flush()

    now = datetime.utcnow()
    cycle_due_at = now - timedelta(days=3)  

    contributions = []
    for i, m in enumerate(members):
        if i == 0:
            status = ContributionStatus.PENDING
            paid = Decimal("0")
        elif i < 9:
            status = ContributionStatus.PAID
            paid = group.contribution_amount
        else:
            status = ContributionStatus.PENDING
            paid = Decimal("0")

        c = Contribution(
            group_id=group.id,
            member_id=m.id,
            cycle_number=group.current_cycle,
            amount_due=group.contribution_amount,
            amount_paid=paid,
            due_at=cycle_due_at,
            status=status,
        )
        contributions.append(c)
    db.add_all(contributions)
    db.flush()

    for c in contributions:
        if c.status == ContributionStatus.PAID:
            db.add(
                Payment(
                    contribution_id=c.id,
                    amount=c.amount_paid,
                    evidence_type="bank_transfer",
                    evidence_recipient_account=group.registered_account_number,
                    evidence_recipient_name=group.registered_account_name,
                    evidence_date=cycle_due_at,
                    verified=True,
                    verification_note="Matches registered account, amount, and a plausible date.",
                )
            )
    db.commit()

    chidi_contribution = contributions[0]
    print("Seeded Udo Ajo Circle.")
    print(f"  group_id = {group.id}")
    print(f"  admin (Amaka) member_id = {members[1].id}")
    print(f"  Chidi member_id = {members[0].id}")
    print(f"  Chidi's overdue contribution_id = {chidi_contribution.id}")
    print(f"  Group registered account number = {group.registered_account_number}")
    print()
    print("Demo scenario inputs:")
    print(f"  Scenario 1 (routine overdue): calculate_overdue_status('{chidi_contribution.id}')")
    print(
        "  Scenario 2/3 (evidence): submit_payment_evidence("
        f"contribution_id='{chidi_contribution.id}', claimed_amount=20000, "
        "claimed_recipient_account='9999999999'  # deliberately WRONG account -> conflict"
        f", claimed_date_iso='{now.date().isoformat()}')"
    )

    db.close()


if __name__ == "__main__":
    run()
