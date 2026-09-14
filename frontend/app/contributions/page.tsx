"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { ArrowLeft, ListChecks, Search } from "lucide-react";
import { api, ContributionRow, ContributionDetail } from "@/lib/api";
import { useGroup } from "@/components/GroupProvider";
import { ContributionStatusBadge, EvidenceBadge, EmptyState, LoadingRow, ErrorNotice } from "@/components/badges";
import { formatNaira, formatDate } from "@/lib/format";

type Tab = "all" | "attention" | "verified" | "disputed";

export default function ContributionsPage() {
  const { group } = useGroup();
  const [rows, setRows] = useState<ContributionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ContributionDetail | null>(null);

  const load = useCallback(async () => {
    if (!group) return;
    setLoading(true);
    setError(null);
    try {
      setRows(await api.getContributions(group.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load contributions.");
    } finally {
      setLoading(false);
    }
  }, [group]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    api.getContribution(selectedId).then(setDetail).catch(() => setDetail(null));
  }, [selectedId]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      attention: rows.filter((r) => (r.is_overdue && r.status !== "paid") || r.status === "disputed").length,
      verified: rows.filter((r) => r.evidence_status === "verified").length,
      disputed: rows.filter((r) => r.status === "disputed").length,
    }),
    [rows],
  );

  const filtered = rows.filter((r) => {
    if (query && !r.member_name.toLowerCase().includes(query.toLowerCase())) return false;
    if (tab === "attention") return (r.is_overdue && r.status !== "paid") || r.status === "disputed";
    if (tab === "verified") return r.evidence_status === "verified";
    if (tab === "disputed") return r.status === "disputed";
    return true;
  });

  const TABS: { id: Tab; label: string }[] = [
    { id: "all", label: `All (${counts.all})` },
    { id: "attention", label: `Needs attention (${counts.attention})` },
    { id: "verified", label: `Verified (${counts.verified})` },
    { id: "disputed", label: `Disputed (${counts.disputed})` },
  ];

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold">Contributions</h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              {group ? `Cycle ${group.current_cycle}` : ""}
            </p>
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-subtle)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search members…"
              className="pl-9 pr-3 py-2 text-sm rounded-[var(--radius-sm)] border w-56"
              style={{ borderColor: "var(--color-border-strong)" }}
            />
          </div>
        </div>

        <div className="flex gap-1 mb-4 border-b" style={{ borderColor: "var(--color-border)" }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="px-3 py-2 text-sm border-b-2 -mb-px"
              style={{
                borderColor: tab === t.id ? "var(--color-text)" : "transparent",
                color: tab === t.id ? "var(--color-text)" : "var(--color-text-muted)",
                fontWeight: tab === t.id ? 500 : 400,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading && <LoadingRow />}
        {error && <ErrorNotice message={error} />}
        {!loading && !error && filtered.length === 0 && (
          <EmptyState icon={ListChecks} title="No contributions match" description="Try a different tab or search term." />
        )}

        {!loading && filtered.length > 0 && (
          <div className="rounded-[var(--radius-md)] border overflow-hidden" style={{ borderColor: "var(--color-border)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-xs text-[var(--color-text-subtle)] border-b"
                  style={{ borderColor: "var(--color-border)", background: "var(--color-surface-muted)" }}
                >
                  <th className="text-left font-medium px-4 py-2.5">Member</th>
                  <th className="text-left font-medium px-4 py-2.5">Amount</th>
                  <th className="text-left font-medium px-4 py-2.5">Due</th>
                  <th className="text-left font-medium px-4 py-2.5">Status</th>
                  <th className="text-left font-medium px-4 py-2.5">Evidence</th>
                  <th className="text-left font-medium px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.contribution_id}
                    className="border-b last:border-0"
                    style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
                  >
                    <td className="px-4 py-3 font-medium">{r.member_name}</td>
                    <td className="px-4 py-3">{formatNaira(r.amount_due)}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">{formatDate(r.due_at)}</td>
                    <td className="px-4 py-3">
                      <ContributionStatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3">
                      <EvidenceBadge status={r.evidence_status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedId(r.contribution_id)}
                        className="text-sm font-medium"
                        style={{ color: "var(--color-info)" }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedId && (
        <div className="w-96 shrink-0 border-l overflow-y-auto px-5 py-5" style={{ borderColor: "var(--color-border)" }}>
          <button
            onClick={() => setSelectedId(null)}
            className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] mb-4"
          >
            <ArrowLeft size={15} /> Close
          </button>

          {!detail && <LoadingRow />}

          {detail && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">{formatNaira(detail.amount_due)}</h2>
                <ContributionStatusBadge status={detail.status} />
              </div>

              <dl className="space-y-3 text-sm mb-5">
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Due</dt>
                  <dd>{formatDate(detail.due_at)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Grace period</dt>
                  <dd>{Math.round((new Date(detail.overdue_check.grace_deadline).getTime() - new Date(detail.due_at).getTime()) / 3_600_000)} hours</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Payment</dt>
                  <dd>{detail.payments.length === 0 ? "Not found" : `${detail.payments.length} submitted`}</dd>
                </div>
              </dl>

              <h3 className="text-xs font-semibold tracking-wide uppercase text-[var(--color-text-subtle)] mb-2">
                Agent action
              </h3>
              <div className="rounded-[var(--radius-md)] border p-3 text-sm mb-3" style={{ borderColor: "var(--color-border)" }}>
                <p className="text-[var(--color-text-muted)]">
                  {detail.overdue_check.is_overdue
                    ? `No verified payment found. ${detail.overdue_check.rule}`
                    : "Not yet overdue."}
                </p>
                {detail.reminder_sent_count > 0 && (
                  <p className="mt-2" style={{ color: "var(--color-success)" }}>
                    Reminder sent ({detail.reminder_sent_count}×)
                  </p>
                )}
              </div>

              <div
                className="rounded-[var(--radius-md)] px-3 py-2 text-xs"
                style={{ background: "var(--color-info-bg)", color: "var(--color-info)" }}
              >
                The agent handled this automatically according to group rules.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
