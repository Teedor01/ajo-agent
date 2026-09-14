"use client";

import { useEffect, useState } from "react";
import { X, RotateCcw, ChevronRight } from "lucide-react";
import { api, ContributionRow, DisputeRow, Member, RunAgentCheckResponse } from "@/lib/api";
import { useGroup } from "./GroupProvider";
import { formatNaira } from "@/lib/format";

type ScenarioId = "missed_payment" | "member_claims" | "valid_evidence" | "conflicting_evidence" | "resolve_dispute";

const SCENARIOS: { id: ScenarioId; label: string; description: string; steps: string[] }[] = [
  {
    id: "missed_payment",
    label: "Missed payment",
    description: "Runs the agent against a member who hasn't paid this cycle.",
    steps: ["Check contribution record", "Evaluate grace period", "Send reminder if overdue", "Create action receipt"],
  },
  {
    id: "member_claims",
    label: "Member claims payment",
    description: "A member says they already paid, with no evidence submitted.",
    steps: ["Check contribution record", "Look for a matching payment", "Ask for evidence if none is found"],
  },
  {
    id: "valid_evidence",
    label: "Valid evidence",
    description: "Submits evidence that matches the group's registered account.",
    steps: ["Evaluate evidence against group records", "Agent proposes recording the payment", "Waits for human confirmation"],
  },
  {
    id: "conflicting_evidence",
    label: "Conflicting evidence",
    description: "Submits evidence with a recipient account that doesn't match.",
    steps: ["Evaluate evidence against group records", "Detect the conflict", "Create a dispute for human review"],
  },
  {
    id: "resolve_dispute",
    label: "Resolve dispute",
    description: "Opens the most recent open dispute for the admin to decide.",
    steps: ["Look up the open dispute", "Admin confirms or rejects", "Contribution and receipt update"],
  },
];

export function DemoModePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { group, refresh } = useGroup();
  const [selected, setSelected] = useState<ScenarioId | null>(null);
  const [progress, setProgress] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunAgentCheckResponse | { note: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [contributions, setContributions] = useState<ContributionRow[]>([]);
  const [admin, setAdmin] = useState<Member | null>(null);
  const [resuming, setResuming] = useState(false);

  useEffect(() => {
    if (!open || !group) return;
    api.getContributions(group.id).then(setContributions).catch(() => setContributions([]));
    api.getMembers(group.id).then((ms) => setAdmin(ms.find((m) => m.is_admin) ?? null)).catch(() => setAdmin(null));
  }, [open, group]);

  if (!open) return null;

  const targetContribution =
    contributions.find((c) => c.is_overdue && c.status !== "paid" && c.status !== "disputed") ?? contributions[0];

  async function runScenario(id: ScenarioId) {
    setRunning(true);
    setErrorMsg(null);
    setResult(null);
    setProgress([]);

    try {
      if (!group || !targetContribution) {
        throw new Error("No contribution available to run this scenario against.");
      }

      if (id === "missed_payment") {
        setProgress(["Checking contribution records…"]);
        const res = await api.runAgentCheck({
          contribution_id: targetContribution.contribution_id,
          member_message: "Is this contribution overdue? Take whatever action is appropriate.",
        });
        setProgress((p) => [...p, "Evaluating group rules…", "Recording agent action…"]);
        setResult(res);
      }

      if (id === "member_claims") {
        setProgress(["Checking contribution records…"]);
        const res = await api.runAgentCheck({
          contribution_id: targetContribution.contribution_id,
          member_message: "I already paid this contribution.",
        });
        setProgress((p) => [...p, "Looking for a matching payment…"]);
        setResult(res);
      }

      if (id === "valid_evidence") {
        setProgress(["Submitting evidence…"]);
        await api.submitEvidence({
          contribution_id: targetContribution.contribution_id,
          claimed_amount: Number(targetContribution.amount_due),
          claimed_recipient_account: group.registered_account_number,
          claimed_date_iso: new Date().toISOString().slice(0, 10),
        });
        setProgress((p) => [...p, "Evaluating evidence against group records…"]);
        const res = await api.runAgentCheck({
          contribution_id: targetContribution.contribution_id,
          member_message: "I paid — please check the evidence I submitted. If it checks out, please record the payment.",
        });
        setProgress((p) => [...p, "Agent is proposing an action…"]);
        setResult(res);
      }

      if (id === "conflicting_evidence") {
        setProgress(["Submitting evidence…"]);
        await api.submitEvidence({
          contribution_id: targetContribution.contribution_id,
          claimed_amount: Number(targetContribution.amount_due),
          claimed_recipient_account: "9999999999",
          claimed_date_iso: new Date().toISOString().slice(0, 10),
        });
        setProgress((p) => [...p, "Evaluating evidence against group records…"]);
        const res = await api.runAgentCheck({
          contribution_id: targetContribution.contribution_id,
          member_message: "I paid — please check the evidence I submitted.",
        });
        setProgress((p) => [...p, "Detecting the conflict…"]);
        setResult(res);
      }

      if (id === "resolve_dispute") {
        if (!admin) throw new Error("No admin member found for this group.");
        setProgress(["Looking up the open dispute…"]);
        const disputes: DisputeRow[] = await api.getDisputes(group.id);
        const open = disputes.find((d) => d.status === "open");
        if (!open) {
          setResult({ note: "No open dispute right now. Try 'Conflicting evidence' first." });
        } else {
          setResult({ note: `Open dispute found for ${open.member_name}. Go to Disputes to confirm or reject it.` });
        }
      }

      await refresh();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Scenario failed.");
    } finally {
      setRunning(false);
    }
  }

  async function handleResume(approve: boolean) {
    if (!result || !("run_id" in result) || !result.run_id || !result.interrupts?.length) return;
    setResuming(true);
    setErrorMsg(null);
    try {
      const resumed = await api.resumeRun({
        run_id: result.run_id,
        interrupt_id: result.interrupts[0].id,
        approve,
      });
      setResult(resumed);
      await refresh();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Could not resume the agent run.");
    } finally {
      setResuming(false);
    }
  }

  async function resetDemo() {
    setRunning(true);
    setErrorMsg(null);
    setResult(null);
    setProgress(["Resetting demo data…"]);
    try {
      await api.resetDemo();
      await refresh();
      setProgress((p) => [...p, "Done."]);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Reset failed.");
    } finally {
      setRunning(false);
    }
  }

  const scenario = SCENARIOS.find((s) => s.id === selected);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        aria-label="Close Demo Mode"
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-md h-full flex flex-col text-[var(--color-ink-text)]"
        style={{ background: "var(--color-ink)" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--color-ink-border)" }}>
          <div>
            <div className="font-semibold text-sm">Demo Mode</div>
            <div className="text-xs text-[var(--color-ink-text-muted)]">
              Run scenarios to see how the agent works
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-[var(--color-ink-text-muted)]">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setSelected(s.id);
                setResult(null);
                setErrorMsg(null);
                setProgress([]);
              }}
              className="w-full flex items-center justify-between rounded-[var(--radius-sm)] px-3 py-2.5 text-sm text-left border"
              style={
                selected === s.id
                  ? { background: "var(--color-ink-elevated)", borderColor: "var(--color-ink-border)" }
                  : { borderColor: "transparent" }
              }
            >
              {s.label}
              <ChevronRight size={15} className="text-[var(--color-ink-text-muted)]" />
            </button>
          ))}

          <button
            onClick={resetDemo}
            disabled={running}
            className="w-full flex items-center gap-2 justify-center rounded-[var(--radius-sm)] px-3 py-2.5 text-sm border mt-3 disabled:opacity-50"
            style={{ borderColor: "var(--color-ink-border)" }}
          >
            <RotateCcw size={14} />
            Reset demo
          </button>

          {scenario && (
            <div
              className="mt-4 rounded-[var(--radius-md)] border p-4"
              style={{ borderColor: "var(--color-ink-border)", background: "var(--color-ink-elevated)" }}
            >
              <div className="text-xs font-semibold tracking-wide uppercase text-[var(--color-ink-text-muted)] mb-2">
                {scenario.label}
              </div>
              <p className="text-sm mb-3">{scenario.description}</p>
              {targetContribution && scenario.id !== "resolve_dispute" && (
                <p className="text-xs text-[var(--color-ink-text-muted)] mb-3">
                  Target: {targetContribution.member_name} · {formatNaira(targetContribution.amount_due)}
                </p>
              )}
              <ol className="text-xs text-[var(--color-ink-text-muted)] list-decimal list-inside space-y-1 mb-4">
                {scenario.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <button
                onClick={() => runScenario(scenario.id)}
                disabled={running}
                className="w-full rounded-[var(--radius-sm)] py-2 text-sm font-medium disabled:opacity-50"
                style={{ background: "#fff", color: "var(--color-ink)" }}
              >
                {running ? "Running…" : "Run scenario"}
              </button>

              {progress.length > 0 && (
                <div className="mt-3 space-y-1 text-xs text-[var(--color-ink-text-muted)]">
                  {progress.map((p, i) => (
                    <div key={i}>{p}</div>
                  ))}
                </div>
              )}

              {errorMsg && (
                <div className="mt-3 text-xs rounded-[var(--radius-sm)] px-3 py-2" style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}>
                  {errorMsg}
                </div>
              )}

              {result && "structured_decision" in result && result.structured_decision && (
                <div className="mt-3 text-xs rounded-[var(--radius-sm)] px-3 py-2 space-y-1" style={{ background: "#0f1117" }}>
                  <div><span className="text-[var(--color-ink-text-muted)]">Decision: </span>{result.structured_decision.decision}</div>
                  <div><span className="text-[var(--color-ink-text-muted)]">Action: </span>{result.structured_decision.action_taken}</div>
                </div>
              )}

              {result && "interrupted" in result && result.interrupted && result.interrupts?.length ? (
                <div
                  className="mt-3 rounded-[var(--radius-sm)] px-3 py-3 space-y-2"
                  style={{ background: "var(--color-warning-bg)", border: "1px solid var(--color-warning-border)" }}
                >
                  <p className="text-xs font-medium" style={{ color: "var(--color-warning)" }}>
                    Agent paused — human approval required
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-text)" }}>
                    {String(result.interrupts[0].reason ?? "")}
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleResume(false)}
                      disabled={resuming}
                      className="flex-1 rounded-[var(--radius-sm)] py-1.5 text-xs font-medium border disabled:opacity-50"
                      style={{ borderColor: "var(--color-danger)", color: "var(--color-danger)" }}
                    >
                      Deny
                    </button>
                    <button
                      onClick={() => handleResume(true)}
                      disabled={resuming}
                      className="flex-1 rounded-[var(--radius-sm)] py-1.5 text-xs font-medium text-white disabled:opacity-50"
                      style={{ background: "var(--color-success)" }}
                    >
                      Approve
                    </button>
                  </div>
                </div>
              ) : null}

              {result && "note" in result && (
                <div className="mt-3 text-xs rounded-[var(--radius-sm)] px-3 py-2" style={{ background: "#0f1117", color: "var(--color-ink-text-muted)" }}>
                  {result.note}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t text-[11px] text-[var(--color-ink-text-muted)]" style={{ borderColor: "var(--color-ink-border)" }}>
          Demo environment · Fictional group data
        </div>
      </div>
    </div>
  );
}
