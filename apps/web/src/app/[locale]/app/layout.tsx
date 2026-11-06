"use client";

import { Header } from "@/modules/workspace/components/layout/header/header";
import { PatternBackgroundContainer } from "@/modules/shared/components/pattern-background-container";
import type { ReactNode } from "react";

export default function DefaultLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen bg-background overflow-x-hidden">
      <PatternBackgroundContainer />
      <Header />
      <div className="flex h-[calc(100vh-69px)]">
        <div className="w-full overflow-y-auto z-10">{children}</div>
      </div>
    </div>
  );
}
