"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Calendar,
  Check,
  FileText,
  HardDrive,
  Loader2,
  Mail,
  Plug,
  StickyNote,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { TOOL_META, type ToolId, type ToolStatus } from "@/lib/types";

const ICONS: Record<ToolId, LucideIcon> = {
  gmail: Mail,
  drive: HardDrive,
  docs: FileText,
  calendar: Calendar,
  notion: StickyNote,
};

const ERROR_LABELS: Record<string, string> = {
  invalid_state: "Security check failed. Please try connecting again.",
  exchange_failed: "Couldn't complete the connection with the provider.",
  not_authenticated: "Please sign in with Google before connecting tools.",
  unknown_tool: "Unknown tool.",
  access_denied: "Permission was denied.",
};

export function ToolConnections() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { toast } = useToast();
  const [tools, setTools] = useState<ToolStatus[] | null>(null);
  const [busy, setBusy] = useState<ToolId | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/tools/status");
      const d = await r.json();
      setTools(d.tools ?? []);
    } catch {
      setTools([]);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Surface OAuth callback results from the URL, then clean the query string.
  useEffect(() => {
    const connected = searchParams.get("connected");
    const toolError = searchParams.get("tool_error");
    if (!connected && !toolError) return;

    if (connected) {
      toast({
        variant: "success",
        title: `${TOOL_META[connected as ToolId]?.name ?? connected} connected`,
        description: "Relay can now act on this tool for you.",
      });
      loadStatus();
    } else if (toolError) {
      toast({
        variant: "error",
        title: "Connection failed",
        description: ERROR_LABELS[toolError] ?? `Something went wrong (${toolError}).`,
      });
    }
    router.replace("/chat");
  }, [searchParams, router, loadStatus, toast]);

  async function handleConnect(tool: ToolId) {
    setBusy(tool);
    try {
      const r = await fetch(`/api/tools/${tool}/connect`, { method: "POST" });
      const d = await r.json();
      if (r.ok && d.url) {
        window.location.href = d.url; // hand off to provider consent screen
        return;
      }
      toast({
        variant: "error",
        title: "Couldn't start connection",
        description: d.error ?? `Try connecting ${TOOL_META[tool].name} again.`,
      });
    } catch {
      toast({
        variant: "error",
        title: "Network error",
        description: "Check your connection and try again.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleDisconnect(tool: ToolId) {
    setBusy(tool);
    try {
      await fetch(`/api/tools/${tool}/disconnect`, { method: "POST" });
      toast({ title: `${TOOL_META[tool].name} disconnected` });
      await loadStatus();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-1">
      <h2 className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Tools
      </h2>

      {tools === null ? (
        <div className="space-y-1.5 py-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/60" />
          ))}
        </div>
      ) : (
        <ul className="space-y-0.5">
          {tools.map((tool) => {
            const Icon = ICONS[tool.id];
            const isBusy = busy === tool.id;
            return (
              <li
                key={tool.id}
                className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 transition-colors hover:bg-accent/60"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
                      tool.connected
                        ? "border-primary/20 bg-primary/10 text-primary"
                        : "bg-card text-muted-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="truncate text-sm">{tool.name}</span>
                </div>
                {tool.connected ? (
                  <div className="flex shrink-0 items-center gap-0.5">
                    <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3 w-3" />
                      <span className="hidden sm:inline">Linked</span>
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      aria-label={`Disconnect ${tool.name}`}
                      disabled={isBusy}
                      onClick={() => handleDisconnect(tool.id)}
                    >
                      {isBusy ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 px-2 text-xs text-primary hover:bg-primary/10 hover:text-primary"
                    disabled={isBusy}
                    onClick={() => handleConnect(tool.id)}
                  >
                    {isBusy ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Plug className="h-3 w-3" />
                    )}
                    Connect
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
