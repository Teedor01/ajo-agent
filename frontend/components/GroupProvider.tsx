"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, GroupOverview } from "@/lib/api";

type GroupContextValue = {
  group: GroupOverview | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const GroupContext = createContext<GroupContextValue | null>(null);

export function GroupProvider({ children }: { children: React.ReactNode }) {
  const [group, setGroup] = useState<GroupOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const groups = await api.listGroups();
      if (groups.length === 0) {
        setError("No group found. Run Reset demo to seed one.");
        setGroup(null);
        return;
      }
      const overview = await api.getGroup(groups[0].id);
      setGroup(overview);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach the backend API.");
      setGroup(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <GroupContext.Provider value={{ group, loading, error, refresh }}>
      {children}
    </GroupContext.Provider>
  );
}

export function useGroup(): GroupContextValue {
  const ctx = useContext(GroupContext);
  if (!ctx) throw new Error("useGroup must be used within GroupProvider");
  return ctx;
}
