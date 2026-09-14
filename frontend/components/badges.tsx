import { ContributionStatusValue, DisputeStatusValue, EvidenceStatus } from "@/lib/api";
import { Check, AlertTriangle, Clock, HelpCircle, X } from "lucide-react";

const statusTone: Record<
  ContributionStatusValue,
  { bg: string; border: string; text: string; label: string }
> = {
  paid: { bg: "var(--color-success-bg)", border: "var(--color-success-border)", text: "var(--color-success)", label: "Paid" },
  pending: { bg: "var(--color-neutral-bg)", border: "var(--color-neutral-border)", text: "var(--color-neutral)", label: "Pending" },
  overdue: { bg: "var(--color-danger-bg)", border: "var(--color-danger-border)", text: "var(--color-danger)", label: "Overdue" },
  disputed: { bg: "var(--color-warning-bg)", border: "var(--color-warning-border)", text: "var(--color-warning)", label: "Disputed" },
  partial: { bg: "var(--color-warning-bg)", border: "var(--color-warning-border)", text: "var(--color-warning)", label: "Partial" },
};

export function ContributionStatusBadge({ status }: { status: ContributionStatusValue }) {
  const tone = statusTone[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border"
      style={{ background: tone.bg, borderColor: tone.border, color: tone.text }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone.text }} />
      {tone.label}
    </span>
  );
}

export function DisputeStatusBadge({ status }: { status: DisputeStatusValue }) {
  if (status === "open") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border"
        style={{ background: "var(--color-warning-bg)", borderColor: "var(--color-warning-border)", color: "var(--color-warning)" }}
      >
        Human review required
      </span>
    );
  }
  const confirmed = status === "resolved_confirmed";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border"
      style={
        confirmed
          ? { background: "var(--color-success-bg)", borderColor: "var(--color-success-border)", color: "var(--color-success)" }
          : { background: "var(--color-neutral-bg)", borderColor: "var(--color-neutral-border)", color: "var(--color-neutral)" }
      }
    >
      {confirmed ? "Payment confirmed" : "Payment rejected"}
    </span>
  );
}

export function EvidenceBadge({ status }: { status: EvidenceStatus }) {
  if (status === "verified") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: "var(--color-success)" }}>
        <Check size={14} /> Verified
      </span>
    );
  }
  if (status === "conflict") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: "var(--color-warning)" }}>
        <AlertTriangle size={14} /> Conflict
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--color-text-subtle)" }}>
      None
    </span>
  );
}

export function EvidenceCheckRow({
  label,
  passed,
  detail,
}: {
  label: string;
  passed: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0">
      <span className="text-sm text-[var(--color-text-muted)]">{label}</span>
      <span
        className="inline-flex items-center gap-1.5 text-sm font-medium"
        style={{ color: passed ? "var(--color-success)" : "var(--color-danger)" }}
      >
        {passed ? <Check size={15} /> : <X size={15} />}
        {detail}
      </span>
    </div>
  );
}

/** "Who decided" classification -- the thing the brief says matters more than any AI badge. */
export type WhoDecided = "agent" | "evidence_conflict" | "human";

export function WhoBadge({ who }: { who: WhoDecided }) {
  if (who === "human") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border"
        style={{ background: "var(--color-info-bg)", borderColor: "var(--color-info-border)", color: "var(--color-info)" }}
      >
        Human decision
      </span>
    );
  }
  if (who === "evidence_conflict") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border"
        style={{ background: "var(--color-danger-bg)", borderColor: "var(--color-danger-border)", color: "var(--color-danger)" }}
      >
        Evidence conflict
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border"
      style={{ background: "var(--color-success-bg)", borderColor: "var(--color-success-border)", color: "var(--color-success)" }}
    >
      Agent handled
    </span>
  );
}

export function EmptyState({
  icon: Icon = HelpCircle,
  title,
  description,
}: {
  icon?: typeof HelpCircle;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div
        className="h-11 w-11 rounded-full flex items-center justify-center mb-4"
        style={{ background: "var(--color-neutral-bg)", color: "var(--color-text-subtle)" }}
      >
        <Icon size={20} />
      </div>
      <p className="font-medium text-sm text-[var(--color-text)]">{title}</p>
      <p className="text-sm text-[var(--color-text-muted)] mt-1 max-w-sm">{description}</p>
    </div>
  );
}

export function LoadingRow({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-8 justify-center text-sm text-[var(--color-text-muted)]">
      <Clock size={15} className="animate-pulse" />
      {label}
    </div>
  );
}

export function ErrorNotice({ message }: { message: string }) {
  return (
    <div
      className="rounded-[var(--radius-md)] border px-4 py-3 text-sm"
      style={{ background: "var(--color-danger-bg)", borderColor: "var(--color-danger-border)", color: "var(--color-danger)" }}
      role="alert"
    >
      {message}
    </div>
  );
}
