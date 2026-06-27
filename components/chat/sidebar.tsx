"use client";

import Image from "next/image";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { ToolConnections } from "./tool-connections";
import { ModelPicker } from "./model-picker";
import type { ModelChoice } from "@/lib/ai/models";

type Props = {
  open: boolean;
  user: { name?: string | null; email?: string | null; image?: string | null; isDemo: boolean };
  models: ModelChoice[];
  modelId: string;
  onModelChange: (id: string) => void;
};

export function Sidebar({ open, user, models, modelId, onModelChange }: Props) {
  return (
    <aside
      className={cn(
        "absolute inset-y-0 left-0 z-20 flex w-64 shrink-0 flex-col border-r bg-card transition-transform md:static md:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}
    >
      {/* Profile card */}
      <div className="border-b p-3">
        <div className="flex items-center gap-3 rounded-lg border bg-background p-2.5">
          {user.image ? (
            <Image
              src={user.image}
              alt={user.name ?? "User"}
              width={36}
              height={36}
              className="h-9 w-9 rounded-full"
              unoptimized
            />
          ) : (
            <div className="h-9 w-9 rounded-full bg-muted" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.name ?? "User"}</p>
            <p className="truncate text-xs text-muted-foreground">
              {user.email ?? "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto scrollbar-thin p-3">
        <ToolConnections isDemo={user.isDemo} />

        <div>
          <h2 className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Model
          </h2>
          <ModelPicker
            models={models}
            value={modelId}
            onChange={onModelChange}
          />
        </div>
      </div>

      <div className="border-t p-3">
        <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
          <Settings className="h-4 w-4" />
          Settings
        </button>
      </div>
    </aside>
  );
}
