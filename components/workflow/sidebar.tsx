"use client";

import { Loader2, Plus, Trash2, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

export interface WorkflowListItem {
  id: string;
  name: string;
  description: string | null;
  isPublished: boolean;
}

export function WorkflowSidebar({
  workflows,
  activeId,
  loading,
  creating,
  onSelect,
  onNew,
  onDelete,
}: {
  workflows: WorkflowListItem[];
  activeId: string | null;
  loading: boolean;
  creating: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-surface">
      <div className="flex h-14 items-center px-4">
        <Logo badgeClassName="h-7 w-7" />
      </div>

      <div className="px-3 pb-2">
        <Button
          className="w-full justify-start gap-2"
          size="sm"
          onClick={onNew}
          disabled={creating}
        >
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          New workflow
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-3">
        {loading ? (
          <div className="space-y-1.5 p-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/60" />
            ))}
          </div>
        ) : workflows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
            <Workflow className="h-6 w-6 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              No workflows yet. Create your first one.
            </p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {workflows.map((w) => (
              <li key={w.id}>
                <div
                  className={cn(
                    "group flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors",
                    w.id === activeId
                      ? "bg-accent text-foreground"
                      : "hover:bg-accent/60",
                  )}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => onSelect(w.id)}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium">
                        {w.name}
                      </span>
                      {w.isPublished && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                      )}
                    </div>
                    {w.description && (
                      <p className="truncate text-[11px] text-muted-foreground">
                        {w.description}
                      </p>
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${w.name}`}
                    className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    onClick={() => onDelete(w.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
