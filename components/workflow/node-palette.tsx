"use client";

import { NODE_PALETTE } from "@/lib/workflows/node-defaults";
import { useWorkflowStore } from "@/lib/stores/workflow-store";
import { cn } from "@/lib/utils";

/**
 * Left rail of draggable node types. Drag onto the canvas (the canvas reads the
 * drop position), or click to drop near the center.
 */
export function NodePalette() {
  const addNode = useWorkflowStore((s) => s.addNode);
  const hasWorkflow = useWorkflowStore((s) => Boolean(s.meta));

  return (
    <div className="flex w-44 shrink-0 flex-col border-r bg-surface">
      <h3 className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Nodes
      </h3>
      <div className="flex-1 space-y-1.5 overflow-y-auto scrollbar-thin p-2">
        {NODE_PALETTE.map((def) => {
          const Icon = def.Icon;
          return (
            <button
              key={def.type}
              type="button"
              draggable={hasWorkflow}
              disabled={!hasWorkflow}
              onDragStart={(e) => {
                e.dataTransfer.setData("application/reactflow", def.type);
                e.dataTransfer.effectAllowed = "move";
              }}
              onClick={() =>
                addNode(def.type, {
                  x: 80 + Math.random() * 120,
                  y: 80 + Math.random() * 120,
                })
              }
              className={cn(
                "flex w-full items-center gap-2 rounded-lg border bg-card px-2.5 py-2 text-left text-sm transition-colors",
                "hover:border-primary/40 hover:bg-accent/60",
                "disabled:cursor-not-allowed disabled:opacity-50",
                hasWorkflow ? "cursor-grab active:cursor-grabbing" : "",
              )}
              title={def.description}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                  def.chip,
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="truncate">{def.label}</span>
            </button>
          );
        })}
      </div>
      <p className="border-t p-2.5 text-[10px] leading-relaxed text-muted-foreground">
        Drag onto the canvas or click to add. Connect nodes by dragging between
        handles.
      </p>
    </div>
  );
}
