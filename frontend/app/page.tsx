"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, Wallet, CalendarDays, AlertTriangle, ArrowRight } from "lucide-react";
import { useGroup } from "@/components/GroupProvider";
import { api, ContributionRow, DisputeRow, ReceiptRow } from "@/lib/api";
import { ContributionStatusBadge, EvidenceBadge, LoadingRow, ErrorNotice } from "@/components/badges";
import { formatNaira, formatDate, formatTime } from "@/lib/format";
import Link from "next/link";

export default function GroupOverviewPage() {
  const { group, loading: groupLoading, error: groupError } = useGroup();
  const [contributions, setContributions] = useState<ContributionRow[]>([]);
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!group) return;
    setLoading(true);
    try {
      const [c, d, r] = await Promise.all([
        api.getContributions(group.id),
        api.getDisputes(group.id),
        api.getReceipts(group.id),
      ]);
      setContributions(c);
      setDisputes(d);
      setReceipts([...r.receipts].sort((a, b) => b.sequence_number - a.sequence_number).slice(0, 4));
    } finally {
      setLoading(false);
    }
  }, [group]);

  useEffect(() => {
    load();
  }, [load]);

  if (groupLoading || loading) return <LoadingRow label="Loading group…" />;
  if (groupError) return <div className="p-6"><ErrorNotice message={groupError} /></div>;
  if (!group) return null;

  const verifiedCount = contributions.filter((c) => c.status === "paid").length;
  const needsAttention = contributions.filter((c) => (c.is_overdue && c.status !== "paid") || c.status === "disputed");
  const openDisputes = disputes.filter((d) => d.status === "open");
  const pendingThisCycle = contributions.filter((c) => c.status === "pending" && !c.is_overdue);

  return (
    <div className="grid grid-cols-[1fr_320px] gap-5 px-6 py-6">
      <div className="space-y-5 min-w-0">
        {/* Status + stats */}
        <div className="grid grid-cols-[220px_1fr_1fr_1fr_1fr] gap-3">
          <div
            className="rounded-[var(--radius-md)] p-4 border"
            style={{ background: "var(--color-success-bg)", borderColor: "var(--color-success-border)" }}
          >
            <div className="text-xs font-semibold tracking-wide uppercase mb-2" style={{ color: "var(--color-success)" }}>
              Group status
            </div>
            <div className="text-lg font-semibold flex items-center gap-2" style={{ color: "var(--color-success)" }}>
              {openDisputes.length === 0 && needsAttention.length <= 1 ? "On track" : "Needs review"}
            </div>
            <ul className="text-xs mt-2 space-y-0.5 text-[var(--color-text-muted)]">
              <li>{verifiedCount} contributions verified</li>
              <li>{needsAttention.length} contribution{needsAttention.length === 1 ? "" : "s"} need attention</li>
              <li>{openDisputes.length} open dispute{openDisputes.length === 1 ? "" : "s"}</li>
            </ul>
          </div>

          <StatCard icon={Users} label="Members" value={String(group.member_count)} tint="info" />
          <StatCard icon={Wallet} label="Weekly contribution" value={formatNaira(group.contribution_amount)} tint="success" />
          <StatCard icon={CalendarDays} label="Current cycle" value={`Cycle ${group.current_cycle}`} tint="info" />
          <StatCard icon={AlertTriangle} label="Open dispute" value={String(openDisputes.length)} tint="danger" />
        </div>

        {/* Needs attention */}
        {needsAttention.length > 0 && (
          <div
            className="rounded-[var(--radius-md)] border p-4"
            style={{ background: "var(--color-danger-bg)", borderColor: "var(--color-danger-border)" }}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase mb-3" style={{ color: "var(--color-danger)" }}>
              <AlertTriangle size={13} /> Needs attention
            </div>
            <div className="grid grid-cols-2 gap-3">
              {needsAttention.slice(0, 4).map((c) => (
                <div key={c.contribution_id} className="rounded-[var(--radius-sm)] border bg-white p-3" style={{ borderColor: "var(--color-border)" }}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{c.member_name}</span>
                    <ContributionStatusBadge status={c.status} />
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">{formatNaira(c.amount_due)} contribution</p>
                  <Link
                    href="/contributions"
                    className="text-xs font-medium mt-2 inline-flex items-center gap-1"
                    style={{ color: "var(--color-info)" }}
                  >
                    View contribution <ArrowRight size={12} />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent contributions */}
        <div className="rounded-[var(--radius-md)] border overflow-hidden" style={{ borderColor: "var(--color-border)" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--color-border)" }}>
            <h2 className="font-semibold text-sm">Recent Contributions</h2>
            <Link href="/contributions" className="text-xs font-medium" style={{ color: "var(--color-info)" }}>
              View all →
            </Link>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-[var(--color-text-subtle)]" style={{ background: "var(--color-surface-muted)" }}>
                <th className="text-left font-medium px-4 py-2">Member</th>
                <th className="text-left font-medium px-4 py-2">Amount</th>
                <th className="text-left font-medium px-4 py-2">Due</th>
                <th className="text-left font-medium px-4 py-2">Status</th>
                <th className="text-left font-medium px-4 py-2">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {contributions.slice(0, 6).map((c) => (
                <tr key={c.contribution_id} className="border-t" style={{ borderColor: "var(--color-border)" }}>
                  <td className="px-4 py-2.5 font-medium">{c.member_name}</td>
                  <td className="px-4 py-2.5">{formatNaira(c.amount_due)}</td>
                  <td className="px-4 py-2.5 text-[var(--color-text-muted)]">{formatDate(c.due_at)}</td>
                  <td className="px-4 py-2.5">
                    <ContributionStatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-2.5">
                    <EvidenceBadge status={c.evidence_status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-[var(--color-text-muted)] px-1">
          The Ajo Continuity Agent observes group activity · applies agreed rules · handles routine issues · escalates when evidence conflicts
        </div>
      </div>

      {/* Right column */}
      <div className="space-y-4">
        <div className="rounded-[var(--radius-md)] border p-4" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">Agent Activity</h2>
            <Link href="/agent-activity" className="text-xs font-medium" style={{ color: "var(--color-info)" }}>
              View all →
            </Link>
          </div>
          {receipts.length === 0 && (
            <p className="text-xs text-[var(--color-text-muted)]">No activity yet. Run a Demo Mode scenario.</p>
          )}
          <div className="space-y-3">
            {receipts.map((r) => (
              <div key={r.receipt_id} className="text-sm">
                <div className="text-xs text-[var(--color-text-subtle)]">
                  {formatTime(r.created_at)}
                </div>
                <div className="font-medium">{r.action.replace(/_/g, " ")}</div>
                {r.member_name && <div className="text-xs text-[var(--color-text-muted)]">{r.member_name}</div>}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[var(--radius-md)] border p-4" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
          <h2 className="font-semibold text-sm mb-3">Pending this cycle</h2>
          {pendingThisCycle.length === 0 && (
            <p className="text-xs text-[var(--color-text-muted)]">Everyone has paid or is already flagged.</p>
          )}
          <div className="space-y-2">
            {pendingThisCycle.map((c) => (
              <div key={c.contribution_id} className="flex items-center justify-between text-sm">
                <span>{c.member_name}</span>
                <span className="text-[var(--color-text-muted)]">{formatNaira(c.amount_due)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  tint: "info" | "success" | "danger";
}) {
  return (
    <div className="rounded-[var(--radius-md)] border p-4" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
      <div
        className="h-8 w-8 rounded-[var(--radius-sm)] flex items-center justify-center mb-3"
        style={{ background: `var(--color-${tint}-bg)`, color: `var(--color-${tint})` }}
      >
        <Icon size={15} />
      </div>
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-[var(--color-text-muted)]">{label}</div>
    </div>
  );
}
