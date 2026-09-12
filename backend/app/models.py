from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


class Base(DeclarativeBase):
    pass


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("grp"))
    name: Mapped[str] = mapped_column(String, nullable=False)
    contribution_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String, default="NGN")
    schedule: Mapped[str] = mapped_column(String, default="weekly")  # weekly | biweekly | monthly
    grace_period_hours: Mapped[int] = mapped_column(Integer, default=48)
    timezone: Mapped[str] = mapped_column(String, default="Africa/Lagos")
    registered_account_name: Mapped[str] = mapped_column(String, nullable=False)
    registered_account_number: Mapped[str] = mapped_column(String, nullable=False)
    current_cycle: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    members: Mapped[list["Member"]] = relationship(back_populates="group", order_by="Member.payout_order")
    contributions: Mapped[list["Contribution"]] = relationship(back_populates="group")
    disputes: Mapped[list["Dispute"]] = relationship(back_populates="group")
    receipts: Mapped[list["ActionReceipt"]] = relationship(back_populates="group")


class Member(Base):
    __tablename__ = "members"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("mem"))
    group_id: Mapped[str] = mapped_column(ForeignKey("groups.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=True)
    payout_order: Mapped[int] = mapped_column(Integer, nullable=False)
    has_received_payout: Mapped[bool] = mapped_column(Boolean, default=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)

    group: Mapped["Group"] = relationship(back_populates="members")


class ContributionStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"
    OVERDUE = "overdue"
    DISPUTED = "disputed"
    PARTIAL = "partial"


class Contribution(Base):
    """One member's obligation for one cycle."""
    __tablename__ = "contributions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("con"))
    group_id: Mapped[str] = mapped_column(ForeignKey("groups.id"), nullable=False)
    member_id: Mapped[str] = mapped_column(ForeignKey("members.id"), nullable=False)
    cycle_number: Mapped[int] = mapped_column(Integer, nullable=False)
    amount_due: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    amount_paid: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    due_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[ContributionStatus] = mapped_column(
        Enum(ContributionStatus), default=ContributionStatus.PENDING
    )
    reminder_sent_count: Mapped[int] = mapped_column(Integer, default=0)
    last_reminder_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    group: Mapped["Group"] = relationship(back_populates="contributions")
    member: Mapped["Member"] = relationship()
    payments: Mapped[list["Payment"]] = relationship(back_populates="contribution")


class Payment(Base):
    """A recorded/claimed payment. Verified payments are the ONLY thing that can move
    a contribution to PAID. Claims without matching verified evidence stay PENDING."""
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("pay"))
    contribution_id: Mapped[str] = mapped_column(ForeignKey("contributions.id"), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    claimed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    evidence_type: Mapped[str] = mapped_column(String, nullable=True)  
    evidence_recipient_account: Mapped[str] = mapped_column(String, nullable=True)
    evidence_recipient_name: Mapped[str] = mapped_column(String, nullable=True)
    evidence_date: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verification_note: Mapped[str] = mapped_column(Text, nullable=True)
    member_statement: Mapped[str] = mapped_column(Text, nullable=True)  

    contribution: Mapped["Contribution"] = relationship(back_populates="payments")


class DisputeStatus(str, enum.Enum):
    OPEN = "open"
    RESOLVED_CONFIRMED = "resolved_confirmed"   
    RESOLVED_REJECTED = "resolved_rejected"     


class Dispute(Base):
    __tablename__ = "disputes"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("dsp"))
    group_id: Mapped[str] = mapped_column(ForeignKey("groups.id"), nullable=False)
    contribution_id: Mapped[str] = mapped_column(ForeignKey("contributions.id"), nullable=False)
    payment_id: Mapped[str] = mapped_column(ForeignKey("payments.id"), nullable=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)          
    conflict_field: Mapped[str] = mapped_column(String, nullable=True)  
    status: Mapped[DisputeStatus] = mapped_column(Enum(DisputeStatus), default=DisputeStatus.OPEN)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    resolved_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    resolved_by: Mapped[str] = mapped_column(String, nullable=True)     
    resolution_note: Mapped[str] = mapped_column(Text, nullable=True)

    group: Mapped["Group"] = relationship(back_populates="disputes")


class ActionReceipt(Base):
    """Inspectable, hash-chained record of every autonomous agent action.
    Not a blockchain — a simple tamper-evident log: each receipt's hash is
    computed over its own content plus the previous receipt's hash."""
    __tablename__ = "action_receipts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: new_id("rcpt"))
    group_id: Mapped[str] = mapped_column(ForeignKey("groups.id"), nullable=False)
    sequence_number: Mapped[int] = mapped_column(Integer, nullable=False)
    action: Mapped[str] = mapped_column(String, nullable=False)        
    facts: Mapped[str] = mapped_column(Text, nullable=False)            
    rule_applied: Mapped[str] = mapped_column(Text, nullable=False)
    decision: Mapped[str] = mapped_column(Text, nullable=False)
    related_contribution_id: Mapped[str] = mapped_column(String, nullable=True)
    related_dispute_id: Mapped[str] = mapped_column(String, nullable=True)
    prev_hash: Mapped[str] = mapped_column(String, nullable=True)
    hash: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    group: Mapped["Group"] = relationship(back_populates="receipts")
