"use client";

import { useCallback, useEffect, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { Loader2, Plus, Workflow } from "lucide-react";
import { useWorkflowStore } from "@/lib/stores/workflow-store";
import { WorkflowCanvas } from "./canvas";
import { NodePalette } from "./node-palette";
import { NodePropertiesPanel } from "./node-properties-panel";
import { WorkflowSidebar, type WorkflowListItem } from "./sidebar";
import { WorkflowToolbar } from "./toolbar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

export function WorkflowBuilder({
  initialWorkflowId,
}: {
  initialWorkflowId?: string;
}) {
  const { toast } = useToast();
  const [workflows, setWorkflows] = useState<WorkflowListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(
    initialWorkflowId ?? null,
  );
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

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
      if (!res.ok) {
        toast({
          variant: "error",
          title: "Couldn't create workflow",
          description: "Please try again.",
        });
        return;
      }
      const created = await res.json();
      await refresh();
      select(created.id);
    } catch {
      toast({
        variant: "error",
        title: "Network error",
        description: "Please try again.",
      });
    } finally {
      setCreating(false);
    }
  }, [refresh, select, toast]);

  const confirmDelete = useCallback(async () => {
    const id = pendingDelete;
    if (!id) return;
    setPendingDelete(null);
    setWorkflows((prev) => prev.filter((w) => w.id !== id));
    if (id === activeId) {
      setActiveId(null);
      clear();
    }
    try {
      await fetch(`/api/workflows/${id}`, { method: "DELETE" });
      toast({ title: "Workflow deleted" });
    } finally {
      refresh();
    }
  }, [pendingDelete, activeId, clear, refresh, toast]);

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
        onDelete={setPendingDelete}
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

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this workflow?"
        description="This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
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
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border bg-card text-muted-foreground">
        <Workflow className="h-6 w-6" />
      </span>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold">Build a workflow</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Create a workflow, then drag nodes onto the canvas and connect them to
          automate your tools.
        </p>
      </div>
      <Button onClick={onNew} disabled={creating} className="gap-1.5">
        {creating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        {creating ? "Creating..." : "New workflow"}
      </Button>
    </div>
  );
}
