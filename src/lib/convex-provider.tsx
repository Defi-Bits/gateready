"use client";

import { ReactNode } from "react";
import { ConvexProvider as ConcavProvider, ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL || "http://localhost:3000");

export function ConvexProvider({ children }: { children: ReactNode }) {
  return (
    <ConcavProvider client={convex}>
      {children}
    </ConcavProvider>
  );
}
