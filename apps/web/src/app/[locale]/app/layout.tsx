"use client";

import { Header } from "@/modules/workspace/components/layout/header/header";
import { PatternBackgroundContainer } from "@/modules/shared/components/pattern-background-container";
import type { ReactNode } from "react";

// The header height changes (a slim bar on phones), so the content takes whatever is left instead of 100vh - 69px.
export default function DefaultLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen h-dvh bg-background overflow-x-hidden">
      <PatternBackgroundContainer />
      <div className="flex h-full flex-col">
        <Header />
        <div className="flex min-h-0 flex-1">
          <div className="w-full overflow-y-auto z-10">{children}</div>
        </div>
      </div>
    </div>
  );
}
