"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function startRouteProgress() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("relay:navigation-start"));
  }
}

export function RouteProgress() {
  const pathname = usePathname();
  const [running, setRunning] = useState(false);

  // App Router updates the pathname only after the destination has loaded.
  // Keeping the indicator tied to that change makes slow network navigation
  // behave like YouTube instead of using a fixed animation duration.
  useEffect(() => setRunning(false), [pathname]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      const link = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      setRunning(true);
    }
    document.addEventListener("click", onClick, true);
    const onNavigationStart = () => setRunning(true);
    window.addEventListener("relay:navigation-start", onNavigationStart);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("relay:navigation-start", onNavigationStart);
    };
  }, []);

  return running ? <span aria-hidden="true" className="route-progress" /> : null;
}
