"use client";

import { Users } from "lucide-react";
import { useGroup } from "./GroupProvider";
import { useEffect, useState } from "react";
import { api, Member } from "@/lib/api";
import { formatNaira } from "@/lib/format";

export function TopBar() {
  const { group, loading, error } = useGroup();
  const [admin, setAdmin] = useState<Member | null>(null);

  useEffect(() => {
    if (!group) return;
    api
      .getMembers(group.id)
      .then((members) => setAdmin(members.find((m) => m.is_admin) ?? null))
      .catch(() => setAdmin(null));
  }, [group]);

  return (
    <header
      className="flex items-center justify-between px-6 py-4 border-b"
      style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
    >
      <div className="flex items-center gap-3">
        <div
          className="h-10 w-10 rounded-[var(--radius-md)] flex items-center justify-center"
          style={{ background: "var(--color-ink)", color: "#fff" }}
        >
          <Users size={18} />
        </div>
        <div>
          <div className="font-semibold text-[15px] leading-tight">
            {loading ? "Loading…" : error ? "Ajo Continuity Agent" : group?.name}
          </div>
          {group && !error && (
            <div className="text-xs text-[var(--color-text-muted)]">
              {group.member_count} members · {group.schedule[0].toUpperCase() + group.schedule.slice(1)} ·{" "}
              {formatNaira(group.contribution_amount)}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span
          className="text-xs font-medium px-2.5 py-1 rounded-full border"
          style={{ background: "var(--color-warning-bg)", borderColor: "var(--color-warning-border)", color: "var(--color-warning)" }}
        >
          Demo Environment
        </span>
        {admin && (
          <div className="flex items-center gap-2 pl-3 border-l" style={{ borderColor: "var(--color-border)" }}>
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold"
              style={{ background: "var(--color-ink)", color: "#fff" }}
            >
              {admin.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="leading-tight">
              <div className="text-sm font-medium">{admin.name}</div>
              <div className="text-xs text-[var(--color-text-muted)]">Group Administrator</div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
