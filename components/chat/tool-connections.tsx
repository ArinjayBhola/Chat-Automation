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
  invalid_state: "Security check failed — please try connecting again.",
  exchange_failed: "Couldn't complete the connection with the provider.",
  not_authenticated: "Please sign in with Google before connecting tools.",
  unknown_tool: "Unknown tool.",
  access_denied: "Permission was denied.",
};

export function ToolConnections({ isDemo }: { isDemo: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tools, setTools] = useState<ToolStatus[] | null>(null);
  const [busy, setBusy] = useState<ToolId | null>(null);
  const [note, setNote] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

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
      setNote({
        kind: "ok",
        text: `${TOOL_META[connected as ToolId]?.name ?? connected} connected.`,
      });
      loadStatus();
    } else if (toolError) {
      setNote({
        kind: "err",
        text: ERROR_LABELS[toolError] ?? `Connection failed (${toolError}).`,
      });
    }
    router.replace("/chat");
  }, [searchParams, router, loadStatus]);

  async function handleConnect(tool: ToolId) {
    setNote(null);
    setBusy(tool);
    try {
      const r = await fetch(`/api/tools/${tool}/connect`, { method: "POST" });
      const d = await r.json();
      if (r.ok && d.url) {
        window.location.href = d.url; // hand off to provider consent screen
        return;
      }
      setNote({ kind: "err", text: d.error ?? "Couldn't start connection." });
    } catch {
      setNote({ kind: "err", text: "Network error starting connection." });
    } finally {
      setBusy(null);
    }
  }

  async function handleDisconnect(tool: ToolId) {
    setBusy(tool);
    try {
      await fetch(`/api/tools/${tool}/disconnect`, { method: "POST" });
      setNote({ kind: "ok", text: `${TOOL_META[tool].name} disconnected.` });
      await loadStatus();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-1">
      <h2 className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Tools
      </h2>

      {tools === null ? (
        <div className="space-y-2 py-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-9 animate-pulse rounded-md bg-muted/60" />
          ))}
        </div>
      ) : (
        tools.map((tool) => {
          const Icon = ICONS[tool.id];
          const isBusy = busy === tool.id;
          return (
            <div
              key={tool.id}
              className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent"
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{tool.name}</span>
              </div>
              {tool.connected ? (
                <div className="flex items-center gap-1">
                  <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                    <Check className="h-3 w-3" />
                    Connected
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
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
                  className="h-7 px-2 text-xs"
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
            </div>
          );
        })
      )}

      {isDemo && (
        <p className="mt-2 rounded-md bg-muted px-2 py-1.5 text-[11px] text-muted-foreground">
          You&apos;re in demo mode. Sign in with Google to link real tools.
        </p>
      )}

      {note && (
        <p
          className={cn(
            "mt-2 rounded-md px-2 py-1.5 text-xs",
            note.kind === "ok"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "bg-destructive/10 text-destructive",
          )}
        >
          {note.text}
        </p>
      )}
    </div>
  );
}
