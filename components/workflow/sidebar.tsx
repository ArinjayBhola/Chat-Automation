"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { groupByRecency } from "@/lib/time-groups";

export interface WorkflowListItem {
  id: string;
  name: string;
  description: string | null;
  isPublished: boolean;
  createdAt: string;
}

function WorkflowItem({
  workflow,
  active,
  onSelect,
  onRename,
  onDelete,
}: {
  workflow: WorkflowListItem;
  active: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState(workflow.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function startEdit() {
    setDraft(workflow.name);
    setEditing(true);
  }

  function commit() {
    if (!editing) return;
    setEditing(false);
    const next = draft.trim();
    if (next && next !== workflow.name) onRename(workflow.id, next);
  }

  function cancel() {
    setEditing(false);
    setDraft(workflow.name);
  }

  if (editing) {
    return (
      <li>
        <input
          ref={inputRef}
          value={draft}
          maxLength={100}
          aria-label="Rename workflow"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancel();
          }}
          className="m-1 w-[calc(100%-0.5rem)] rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </li>
    );
  }

  return (
    <li
      onContextMenu={(e) => {
        e.preventDefault();
        setMenuOpen(true);
      }}
      className={cn(
        "group flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors",
        active
          ? "bg-card text-foreground shadow-sm ring-1 ring-border"
          : "hover:bg-accent/60",
      )}
    >
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={() => onSelect(workflow.id)}
        onDoubleClick={startEdit}
      >
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{workflow.name}</span>
          {workflow.isPublished && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
          )}
        </div>
        {workflow.description && (
          <p className="truncate text-[11px] text-muted-foreground">
            {workflow.description}
          </p>
        )}
      </button>

      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger
          aria-label={`Options for ${workflow.name}`}
          className={cn(
            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-opacity hover:bg-background hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring",
            "opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100",
          )}
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[9rem]">
          <DropdownMenuItem onSelect={() => startEdit()}>
            <Pencil />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => onDelete(workflow.id)}
            className="text-destructive focus:bg-destructive/10 focus:text-destructive [&_svg]:text-destructive"
          >
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

export function WorkflowSidebar({
  workflows,
  activeId,
  loading,
  creating,
  onSelect,
  onNew,
  onDelete,
  onRename,
}: {
  workflows: WorkflowListItem[];
  activeId: string | null;
  loading: boolean;
  creating: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  // Group by creation date so the list reads as a history.
  const groups = useMemo(
    () => groupByRecency(workflows, (w) => w.createdAt),
    [workflows],
  );

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

      <div className="flex-1 overflow-y-auto scrollbar-overlay px-2 pb-3">
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
          <div className="space-y-4 px-1 pt-1">
            {groups.map((group) => (
              <section key={group.id} className="space-y-1">
                <h2 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </h2>
                <ul className="space-y-0.5">
                  {group.items.map((w) => (
                    <WorkflowItem
                      key={w.id}
                      workflow={w}
                      active={w.id === activeId}
                      onSelect={onSelect}
                      onRename={onRename}
                      onDelete={onDelete}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
