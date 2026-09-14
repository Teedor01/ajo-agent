"use client";

import { useEffect, useState, useCallback } from "react";
import { FileCheck2, ShieldCheck, ShieldX, ArrowLeft } from "lucide-react";
import { api, ReceiptRow } from "@/lib/api";
import { useGroup } from "@/components/GroupProvider";
import { EmptyState, LoadingRow, ErrorNotice } from "@/components/badges";
import { formatDate, formatTime } from "@/lib/format";

function truncateHash(hash: string | null): string {
  if (!hash) return "—";
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

export default function ReceiptsPage() {
  const { group } = useGroup();
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [chainValid, setChainValid] = useState<boolean | null>(null);
  const [brokenAt, setBrokenAt] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const load = useCallback(async () => {
    if (!group) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getReceipts(group.id);
      setReceipts([...res.receipts].sort((a, b) => b.sequence_number - a.sequence_number));
      setChainValid(res.chain_valid);
      setBrokenAt(res.broken_at_receipt_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load receipts.");
    } finally {
      setLoading(false);
    }
  }, [group]);

  useEffect(() => {
    load();
  }, [load]);

  async function verifyChain() {
    setVerifying(true);
    await load();
    setVerifying(false);
  }

  const selected = receipts.find((r) => r.receipt_id === selectedId) ?? null;

  return (
    <div className="flex h-full">
      <div className="w-96 shrink-0 border-r overflow-y-auto" style={{ borderColor: "var(--color-border)" }}>
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--color-border)" }}>
          <div>
            <h1 className="font-semibold text-[15px]">Action Receipts</h1>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Every autonomous action leaves an inspectable receipt
            </p>
          </div>
        </div>

        {loading && <LoadingRow />}
        {error && (
          <div className="p-4">
            <ErrorNotice message={error} />
          </div>
        )}
        {!loading && !error && receipts.length === 0 && (
          <EmptyState icon={FileCheck2} title="No receipts yet" description="Run a Demo Mode scenario to generate the first receipt." />
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-[var(--color-text-subtle)] border-b" style={{ borderColor: "var(--color-border)" }}>
              <th className="text-left font-medium px-5 py-2">Action</th>
              <th className="text-left font-medium px-3 py-2">Member</th>
              <th className="text-left font-medium px-3 py-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((r) => (
              <tr
                key={r.receipt_id}
                onClick={() => setSelectedId(r.receipt_id)}
                className="border-b cursor-pointer"
                style={{
                  borderColor: "var(--color-border)",
                  background: selectedId === r.receipt_id ? "var(--color-surface-muted)" : "transparent",
                }}
              >
                <td className="px-5 py-3">{r.action.replace(/_/g, " ")}</td>
                <td className="px-3 py-3 text-[var(--color-text-muted)]">{r.member_name ?? "—"}</td>
                <td className="px-3 py-3 text-[var(--color-text-muted)]">{formatDate(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!selected && (
          <EmptyState icon={FileCheck2} title="Select a receipt" description="Choose a receipt to see its full audit detail and chain verification." />
        )}

        {selected && (
          <div className="max-w-xl mx-auto px-6 py-6">
            <button
              onClick={() => setSelectedId(null)}
              className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] mb-4"
            >
              <ArrowLeft size={15} /> Back to list
            </button>

            <h2 className="text-lg font-semibold mb-1">Action Receipt</h2>
            <p className="text-xs font-mono text-[var(--color-text-subtle)] mb-6">{selected.receipt_id}</p>

            <div className="space-y-4 mb-6">
              <div>
                <h3 className="text-xs font-semibold tracking-wide uppercase text-[var(--color-text-subtle)] mb-1">Action</h3>
                <p className="text-sm">{selected.action.replace(/_/g, " ")}</p>
              </div>
              {selected.member_name && (
                <div>
                  <h3 className="text-xs font-semibold tracking-wide uppercase text-[var(--color-text-subtle)] mb-1">Member</h3>
                  <p className="text-sm">{selected.member_name}</p>
                </div>
              )}
              <div>
                <h3 className="text-xs font-semibold tracking-wide uppercase text-[var(--color-text-subtle)] mb-1">Rule</h3>
                <p className="text-sm text-[var(--color-text-muted)]">{selected.rule_applied}</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold tracking-wide uppercase text-[var(--color-text-subtle)] mb-1">Decision</h3>
                <p className="text-sm">{selected.decision}</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold tracking-wide uppercase text-[var(--color-text-subtle)] mb-1">Timestamp</h3>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {formatDate(selected.created_at)} at {formatTime(selected.created_at)}
                </p>
              </div>
            </div>

            <div className="rounded-[var(--radius-md)] border p-4" style={{ borderColor: "var(--color-border)" }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold tracking-wide uppercase text-[var(--color-text-subtle)]">
                  Chain integrity
                </h3>
                <button
                  onClick={verifyChain}
                  disabled={verifying}
                  className="text-xs font-medium px-2.5 py-1 rounded-full border disabled:opacity-50"
                  style={{ borderColor: "var(--color-border-strong)" }}
                >
                  {verifying ? "Verifying…" : "Verify chain"}
                </button>
              </div>

              {chainValid === true && (
                <div className="flex items-center gap-1.5 text-sm mb-2" style={{ color: "var(--color-success)" }}>
                  <ShieldCheck size={16} /> Audit chain verified
                </div>
              )}
              {chainValid === false && (
                <div className="flex items-center gap-1.5 text-sm mb-2" style={{ color: "var(--color-danger)" }}>
                  <ShieldX size={16} /> Chain broken at receipt {brokenAt}
                </div>
              )}
              <p className="text-xs text-[var(--color-text-muted)] mb-3">
                {receipts.length} receipt{receipts.length === 1 ? "" : "s"} on chain
              </p>

              <div className="text-xs font-mono space-y-1">
                <div>
                  <span className="text-[var(--color-text-subtle)]">Current hash: </span>
                  {truncateHash(selected.hash)}
                </div>
                <div>
                  <span className="text-[var(--color-text-subtle)]">Previous hash: </span>
                  {truncateHash(selected.prev_hash)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
