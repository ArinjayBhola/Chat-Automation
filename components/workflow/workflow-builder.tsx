"use client";

import { useCallback, useEffect, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { useWorkflowStore } from "@/lib/stores/workflow-store";
import { WorkflowCanvas } from "./canvas";
import { NodePalette } from "./node-palette";
import { NodePropertiesPanel } from "./node-properties-panel";
import { WorkflowSidebar, type WorkflowListItem } from "./sidebar";
import { WorkflowToolbar } from "./toolbar";

export function WorkflowBuilder({
  initialWorkflowId,
}: {
  initialWorkflowId?: string;
}) {
  const [workflows, setWorkflows] = useState<WorkflowListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(
    initialWorkflowId ?? null,
  );

  const loadWorkflow = useWorkflowStore((s) => s.loadWorkflow);
  const clear = useWorkflowStore((s) => s.clear);
  const meta = useWorkflowStore((s) => s.meta);
  const renameMeta = useWorkflowStore((s) => s.renameMeta);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/workflows?limit=100&sortBy=updatedAt");
      const data = await res.json();
      const rows = (data.workflows ?? []) as (WorkflowListItem & {
        createdAt: string;
      })[];
      setWorkflows(
        rows.map((w) => ({
          id: w.id,
          name: w.name,
          description: w.description ?? null,
          isPublished: w.isPublished,
          createdAt: w.createdAt,
        })),
      );
    } catch {
      setWorkflows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Load the initially requested workflow (e.g. /workflows/[id]) once.
  useEffect(() => {
    if (initialWorkflowId) loadWorkflow(initialWorkflowId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialWorkflowId]);

  const select = useCallback(
    (id: string) => {
      setActiveId(id);
      loadWorkflow(id);
    },
    [loadWorkflow],
  );

  const handleNew = useCallback(async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled workflow" }),
      });
      if (!res.ok) return;
      const created = await res.json();
      await refresh();
      select(created.id);
    } finally {
      setCreating(false);
    }
  }, [refresh, select]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!window.confirm("Delete this workflow? This cannot be undone.")) {
        return;
      }
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
      if (id === activeId) {
        setActiveId(null);
        clear();
      }
      try {
        await fetch(`/api/workflows/${id}`, { method: "DELETE" });
      } finally {
        refresh();
      }
    },
    [activeId, clear, refresh],
  );

  const handleRename = useCallback(
    async (id: string, name: string) => {
      setWorkflows((prev) =>
        prev.map((w) => (w.id === id ? { ...w, name } : w)),
      );
      // Keep the open editor's title in sync when renaming the active workflow.
      if (id === activeId) renameMeta(name);
      try {
        await fetch(`/api/workflows/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
      } finally {
        refresh();
      }
    },
    [activeId, renameMeta, refresh],
  );

  // Keep the sidebar name in sync after a rename + save.
  useEffect(() => {
    if (!meta) return;
    setWorkflows((prev) =>
      prev.map((w) =>
        w.id === meta.id
          ? { ...w, name: meta.name, isPublished: meta.isPublished }
          : w,
      ),
    );
  }, [meta]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <WorkflowSidebar
        workflows={workflows}
        activeId={activeId}
        loading={loading}
        creating={creating}
        onSelect={select}
        onNew={handleNew}
        onDelete={handleDelete}
        onRename={handleRename}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <WorkflowToolbar />
        {activeId ? (
          <ReactFlowProvider>
            <div className="flex min-h-0 flex-1">
              <NodePalette />
              <WorkflowCanvas />
              <NodePropertiesPanel />
            </div>
          </ReactFlowProvider>
        ) : (
          <EmptyState onNew={handleNew} creating={creating} />
        )}
      </div>
    </div>
  );
}

function EmptyState({
  onNew,
  creating,
}: {
  onNew: () => void;
  creating: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <h2 className="text-lg font-semibold">Build a workflow</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Create a workflow, then drag nodes onto the canvas and connect them to
        automate your tools.
      </p>
      <button
        type="button"
        onClick={onNew}
        disabled={creating}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {creating ? "Creating..." : "New workflow"}
      </button>
    </div>
  );
}
