"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, ListChecks, Activity, ShieldAlert, FileCheck2, FlaskConical } from "lucide-react";
import { formatRelative } from "@/lib/format";
import { api } from "@/lib/api";
import { useState, useEffect, useCallback } from "react";

const NAV = [
  { href: "/", label: "Group", icon: Users },
  { href: "/contributions", label: "Contributions", icon: ListChecks },
  { href: "/agent-activity", label: "Agent Activity", icon: Activity },
  { href: "/disputes", label: "Disputes", icon: ShieldAlert },
  { href: "/receipts", label: "Action Receipts", icon: FileCheck2 },
];

export function Sidebar({ onOpenDemoMode }: { onOpenDemoMode: () => void }) {
  const pathname = usePathname();
  const [lastHealthyAt, setLastHealthyAt] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [, forceTick] = useState(0);

  const pingHealth = useCallback(async () => {
    try {
      await api.health();
      setLastHealthyAt(new Date().toISOString());
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    pingHealth();
    const pingId = setInterval(pingHealth, 30_000);
    const tickId = setInterval(() => forceTick((n) => n + 1), 15_000);
    return () => {
      clearInterval(pingId);
      clearInterval(tickId);
    };
  }, [pingHealth]);

  return (
    <aside
      className="w-60 shrink-0 flex flex-col h-full text-[var(--color-ink-text)]"
      style={{ background: "var(--color-ink)" }}
    >
      <div className="px-5 py-5 border-b" style={{ borderColor: "var(--color-ink-border)" }}>
        <div className="text-sm font-semibold tracking-tight leading-tight">AJO</div>
        <div className="text-[10px] tracking-[0.2em] text-[var(--color-ink-text-muted)]">CONTINUITY</div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-sm transition-colors"
              style={
                active
                  ? { background: "var(--color-ink-elevated)", color: "#fff" }
                  : { color: "var(--color-ink-text-muted)" }
              }
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-3">
        <button
          onClick={onOpenDemoMode}
          className="w-full flex items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2.5 text-sm font-medium border"
          style={{ borderColor: "var(--color-ink-border)", background: "var(--color-ink-elevated)" }}
        >
          <FlaskConical size={16} />
          Demo Mode
        </button>
      </div>

      <div className="px-5 py-4 border-t text-xs" style={{ borderColor: "var(--color-ink-border)" }}>
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: offline ? "var(--color-danger)" : "var(--color-success)" }}
          />
          <span className="font-medium">{offline ? "API unreachable" : "API connected"}</span>
        </div>
        <div className="text-[var(--color-ink-text-muted)] mt-1">
          {lastHealthyAt ? `Last checked ${formatRelative(lastHealthyAt)}` : "Checking…"}
        </div>
      </div>
    </aside>
  );
}
