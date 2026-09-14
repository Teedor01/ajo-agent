"use client";

import { useEffect, useState, useCallback } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { api, ReceiptRow } from "@/lib/api";
import { useGroup } from "@/components/GroupProvider";
import { WhoBadge, WhoDecided, EmptyState, LoadingRow, ErrorNotice } from "@/components/badges";
import { formatDate, formatTime } from "@/lib/format";


function classify(receipt: ReceiptRow): WhoDecided {
  if (receipt.action.includes("dispute") && !receipt.decision.toLowerCase().includes("resolved")) {
    return "evidence_conflict";
  }
  if (receipt.related_dispute_id && receipt.decision.toLowerCase().includes("resolved")) {
    return "human";
  }
  return "agent";
}

function titleFor(receipt: ReceiptRow): string {
  const map: Record<string, string> = {
    marked_overdue_reminder_sent: "Contribution overdue",
    reminder_sent: "Reminder sent",
    dispute_created: "Payment disputed",
  };
  return map[receipt.action] ?? receipt.action.replace(/_/g, " ");
}

export default function AgentActivityPage() {
  const { group } = useGroup();
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!group) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getReceipts(group.id);
      setReceipts([...res.receipts].sort((a, b) => b.sequence_number - a.sequence_number));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load agent activity.");
    } finally {
      setLoading(false);
    }
  }, [group]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="max-w-3xl mx-auto px-6 py-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-semibold">Agent Activity</h1>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>
      <p className="text-sm text-[var(--color-text-muted)] mb-6">
        What the agent observed, the rule it applied, and what it did as a result.
      </p>

      {loading && <LoadingRow />}
      {error && <ErrorNotice message={error} />}
      {!loading && !error && receipts.length === 0 && (
        <EmptyState
          icon={Activity}
          title="No activity yet"
          description="Run a Demo Mode scenario to see the agent observe, decide, and act."
        />
      )}

      <div className="space-y-3">
        {receipts.map((r) => {
          const who = classify(r);
          return (
            <div
              key={r.receipt_id}
              className="rounded-[var(--radius-md)] border p-4"
              style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-[var(--color-text-subtle)]">
                    {formatDate(r.created_at)} · {formatTime(r.created_at)}
                  </div>
                  <div className="font-medium text-sm mt-0.5">{titleFor(r)}</div>
                </div>
                <WhoBadge who={who} />
              </div>

              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="text-xs font-semibold tracking-wide uppercase text-[var(--color-text-subtle)]">
                    Observed
                  </dt>
                  <dd className="text-[var(--color-text-muted)]">{r.facts}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold tracking-wide uppercase text-[var(--color-text-subtle)]">
                    Rule
                  </dt>
                  <dd className="text-[var(--color-text-muted)]">{r.rule_applied}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold tracking-wide uppercase text-[var(--color-text-subtle)]">
                    Decision
                  </dt>
                  <dd>{r.decision}</dd>
                </div>
              </dl>

              <div className="mt-3 pt-3 border-t flex items-center justify-between" style={{ borderColor: "var(--color-border)" }}>
                <span className="text-xs font-mono text-[var(--color-text-subtle)]">{r.receipt_id}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
