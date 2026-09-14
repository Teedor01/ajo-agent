"use client";

import { useEffect, useState, useCallback } from "react";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { api, DisputeRow, Member } from "@/lib/api";
import { useGroup } from "@/components/GroupProvider";
import { DisputeStatusBadge, EvidenceCheckRow, EmptyState, LoadingRow, ErrorNotice } from "@/components/badges";
import { formatNaira, formatDate, formatTime } from "@/lib/format";

type DisputeDetail = Awaited<ReturnType<typeof api.getDispute>>;

export default function DisputesPage() {
  const { group } = useGroup();
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DisputeDetail | null>(null);
  const [admin, setAdmin] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  const loadList = useCallback(async () => {
    if (!group) return;
    setLoading(true);
    setError(null);
    try {
      const [rows, members] = await Promise.all([api.getDisputes(group.id), api.getMembers(group.id)]);
      setDisputes(rows);
      setAdmin(members.find((m) => m.is_admin) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load disputes.");
    } finally {
      setLoading(false);
    }
  }, [group]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    api.getDispute(selectedId).then(setDetail).catch(() => setDetail(null));
  }, [selectedId]);

  async function handleResolve(acceptPayment: boolean) {
    if (!detail || !admin) return;
    setResolving(true);
    setError(null);
    try {
      await api.resolveDispute(detail.dispute_id, {
        resolved_by_member_id: admin.id,
        accept_payment: acceptPayment,
        resolution_note: acceptPayment
          ? "Admin confirmed the payment after reviewing the evidence."
          : "Admin rejected the payment after reviewing the evidence.",
      });
      const refreshed = await api.getDispute(detail.dispute_id);
      setDetail(refreshed);
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resolve dispute.");
    } finally {
      setResolving(false);
    }
  }

  const openCount = disputes.filter((d) => d.status === "open").length;

  return (
    <div className="flex h-full">
      {/* List column */}
      <div className="w-80 shrink-0 border-r overflow-y-auto" style={{ borderColor: "var(--color-border)" }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--color-border)" }}>
          <h1 className="font-semibold text-[15px]">Disputes</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {openCount} open dispute{openCount === 1 ? "" : "s"}
          </p>
        </div>

        {loading && <LoadingRow />}
        {error && (
          <div className="p-4">
            <ErrorNotice message={error} />
          </div>
        )}
        {!loading && !error && disputes.length === 0 && (
          <EmptyState
            icon={ShieldAlert}
            title="No open disputes"
            description="The agent hasn't found any contribution conflicts requiring human review."
          />
        )}

        {disputes.map((d) => (
          <button
            key={d.dispute_id}
            onClick={() => setSelectedId(d.dispute_id)}
            className="w-full text-left px-5 py-4 border-b transition-colors"
            style={{
              borderColor: "var(--color-border)",
              background: selectedId === d.dispute_id ? "var(--color-surface-muted)" : "transparent",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">{d.member_name}</span>
              <span className="text-xs text-[var(--color-text-muted)]">{formatDate(d.created_at)}</span>
            </div>
            <div className="mt-1">
              <DisputeStatusBadge status={d.status} />
            </div>
          </button>
        ))}
      </div>

      {/* Detail column */}
      <div className="flex-1 overflow-y-auto">
        {!detail && (
          <EmptyState
            icon={ShieldAlert}
            title="Select a dispute"
            description="Choose a dispute from the list to review the evidence and the agent's decision."
          />
        )}

        {detail && (
          <div className="max-w-2xl mx-auto px-6 py-6">
            <button
              onClick={() => setSelectedId(null)}
              className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] mb-4"
            >
              <ArrowLeft size={15} /> Back to overview
            </button>

            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold">{detail.member_name}</h2>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {detail.amount_due ? formatNaira(detail.amount_due) : ""} contribution
                </p>
              </div>
              <DisputeStatusBadge status={detail.status} />
            </div>

            {detail.evidence?.member_statement && (
              <section className="mb-5">
                <h3 className="text-xs font-semibold tracking-wide uppercase text-[var(--color-text-subtle)] mb-2">
                  Member claim
                </h3>
                <div
                  className="rounded-[var(--radius-md)] border px-4 py-3 text-sm italic"
                  style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
                >
                  “{detail.evidence.member_statement}”
                </div>
              </section>
            )}

            <div className="grid grid-cols-2 gap-4 mb-5">
              <section>
                <h3 className="text-xs font-semibold tracking-wide uppercase text-[var(--color-text-subtle)] mb-2">
                  Registered details
                </h3>
                <div className="rounded-[var(--radius-md)] border p-4 text-sm space-y-1.5" style={{ borderColor: "var(--color-border)" }}>
                  <div className="text-[var(--color-text-muted)]">Group account</div>
                  <div className="font-medium">{detail.registered_account_name}</div>
                  <div className="font-mono text-xs text-[var(--color-text-muted)]">{detail.registered_account_number}</div>
                </div>
              </section>

              {detail.evidence && (
                <section>
                  <h3 className="text-xs font-semibold tracking-wide uppercase text-[var(--color-text-subtle)] mb-2">
                    Evidence submitted
                  </h3>
                  <div className="rounded-[var(--radius-md)] border p-4 text-sm space-y-1.5" style={{ borderColor: "var(--color-border)" }}>
                    <div className="text-[var(--color-text-muted)]">Recipient account</div>
                    <div className="font-mono text-xs">{detail.evidence.recipient_account}</div>
                    <div className="text-[var(--color-text-muted)] mt-1">
                      {formatNaira(detail.evidence.amount)}
                      {detail.evidence.date ? ` · ${formatDate(detail.evidence.date)}` : ""}
                    </div>
                  </div>
                </section>
              )}
            </div>

            {detail.checks && (
              <section className="mb-5">
                <h3 className="text-xs font-semibold tracking-wide uppercase text-[var(--color-text-subtle)] mb-2">
                  Evidence check
                </h3>
                <div className="rounded-[var(--radius-md)] border px-4" style={{ borderColor: "var(--color-border)" }}>
                  <EvidenceCheckRow label="Amount" passed={detail.checks.amount_matches} detail={detail.checks.amount_matches ? "Matches" : "Mismatch"} />
                  <EvidenceCheckRow label="Date" passed={detail.checks.date_plausible} detail={detail.checks.date_plausible ? "Plausible" : "Implausible"} />
                  <EvidenceCheckRow label="Recipient" passed={detail.checks.recipient_matches} detail={detail.checks.recipient_matches ? "Matches" : "Conflict"} />
                </div>
              </section>
            )}

            <section className="mb-5">
              <h3 className="text-xs font-semibold tracking-wide uppercase text-[var(--color-text-subtle)] mb-2">
                Agent decision
              </h3>
              <div
                className="rounded-[var(--radius-md)] border px-4 py-3 text-sm"
                style={{ background: "var(--color-danger-bg)", borderColor: "var(--color-danger-border)" }}
              >
                <p className="font-medium" style={{ color: "var(--color-danger)" }}>
                  Payment not confirmed.
                </p>
                <p className="text-[var(--color-text-muted)] mt-1">{detail.reason}</p>
                <p className="text-xs font-medium mt-2" style={{ color: "var(--color-danger)" }}>
                  Automation stopped · Evidence conflict
                </p>
              </div>
            </section>

            {error && (
              <div className="mb-4">
                <ErrorNotice message={error} />
              </div>
            )}

            {detail.status === "open" ? (
              <section>
                <h3 className="text-xs font-semibold tracking-wide uppercase text-[var(--color-text-subtle)] mb-2">
                  Human decision required
                </h3>
                <div className="rounded-[var(--radius-md)] border p-4 flex items-center gap-3" style={{ borderColor: "var(--color-border)" }}>
                  <button
                    onClick={() => handleResolve(false)}
                    disabled={resolving || !admin}
                    className="flex-1 rounded-[var(--radius-sm)] py-2 text-sm font-medium border disabled:opacity-50"
                    style={{ borderColor: "var(--color-danger-border)", color: "var(--color-danger)" }}
                  >
                    Reject payment
                  </button>
                  <button
                    onClick={() => handleResolve(true)}
                    disabled={resolving || !admin}
                    className="flex-1 rounded-[var(--radius-sm)] py-2 text-sm font-medium text-white disabled:opacity-50"
                    style={{ background: "var(--color-success)" }}
                  >
                    Confirm payment
                  </button>
                </div>
                {!admin && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-2">
                    No admin member found for this group — resolution is disabled.
                  </p>
                )}
              </section>
            ) : (
              <section>
                <h3 className="text-xs font-semibold tracking-wide uppercase text-[var(--color-text-subtle)] mb-2">
                  Resolution
                </h3>
                <div className="rounded-[var(--radius-md)] border p-4 text-sm" style={{ borderColor: "var(--color-border)" }}>
                  <p>{detail.resolution_note}</p>
                  {detail.resolved_at && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                      Resolved {formatDate(detail.resolved_at)} at {formatTime(detail.resolved_at)}
                    </p>
                  )}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
