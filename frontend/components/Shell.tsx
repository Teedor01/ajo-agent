"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { DemoModePanel } from "./DemoModePanel";
import { GroupProvider } from "./GroupProvider";

export function Shell({ children }: { children: React.ReactNode }) {
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <GroupProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar onOpenDemoMode={() => setDemoOpen(true)} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto" style={{ background: "var(--color-app-bg)" }}>
            {children}
          </main>
        </div>
      </div>
      <DemoModePanel open={demoOpen} onClose={() => setDemoOpen(false)} />
    </GroupProvider>
  );
}
