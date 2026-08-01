"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RouteProgress } from "@/components/layout/route-progress";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        themes={["light", "dark", "midnight", "system"]}
        disableTransitionOnChange
      >
        <TooltipProvider delayDuration={300}>
          <ToastProvider>
            <RouteProgress />
            {children}
          </ToastProvider>
        </TooltipProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
