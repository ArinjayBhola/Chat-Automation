"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Play,
  Save,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useWorkflowStore } from "@/lib/stores/workflow-store";
import { ScheduleDialog } from "./schedule-dialog";

export function WorkflowToolbar() {
  const { toast } = useToast();
  const meta = useWorkflowStore((s) => s.meta);
  const dirty = useWorkflowStore((s) => s.dirty);
  const saving = useWorkflowStore((s) => s.saving);
  const setMeta = useWorkflowStore((s) => s.setMeta);
  const save = useWorkflowStore((s) => s.save);
  const publish = useWorkflowStore((s) => s.publish);
  const test = useWorkflowStore((s) => s.test);

  const [busy, setBusy] = useState<"save" | "test" | "publish" | null>(null);
  const [showSchedules, setShowSchedules] = useState(false);

  if (!meta) {
    return (
      <div className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4">
        <BackLink />
        <span className="text-sm text-muted-foreground">
          Select or create a workflow to start building.
        </span>
      </div>
    );
  }

  async function run(kind: "save" | "test" | "publish") {
    setBusy(kind);
    try {
      if (kind === "save") {
        const ok = await save();
        toast(
          ok
            ? { variant: "success", title: "Workflow saved" }
            : { variant: "error", title: "Couldn't save", description: "Please try again." },
        );
      } else if (kind === "test") {
        const result = await test();
        if (!result) {
          toast({ variant: "error", title: "Test failed to run" });
        } else if (result.ok) {
          toast({
            variant: "success",
            title: "Workflow looks valid",
            description: `${result.nodeCount} nodes, ${result.edgeCount} connections.`,
          });
        } else {
          toast({
            variant: "error",
            title: "Validation issues found",
            description: result.issues[0] ?? "Check the canvas and try again.",
          });
        }
      } else {
        const res = await publish();
        toast(
          res.ok
            ? { variant: "success", title: "Workflow published", description: "It can now run on schedule." }
            : { variant: "error", title: "Publish failed", description: res.error ?? "Please try again." },
        );
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
    {showSchedules && (
      <ScheduleDialog
        workflowId={meta.id}
        published={meta.isPublished}
        onClose={() => setShowSchedules(false)}
      />
    )}
    <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-card px-4">
      <div className="flex min-w-0 items-center gap-3">
        <BackLink />
        <div className="min-w-0">
          <Input
            value={meta.name}
            onChange={(e) => setMeta({ name: e.target.value })}
            className="h-8 border-transparent bg-transparent px-1 text-sm font-semibold shadow-none hover:border-input focus-visible:border-input"
          />
          <div className="flex items-center gap-2 px-1">
            <span className="text-[11px] text-muted-foreground">
              v{meta.version}
            </span>
            {meta.isPublished ? (
              <Badge variant="success">
                <CheckCircle2 className="h-3 w-3" />
                Published
              </Badge>
            ) : (
              <Badge variant="outline">Draft</Badge>
            )}
            {dirty && <Badge variant="warning">Unsaved</Badge>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={busy !== null || saving}
          onClick={() => run("save")}
        >
          {busy === "save" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={busy !== null}
          onClick={() => run("test")}
        >
          {busy === "test" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          Test
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setShowSchedules(true)}
        >
          <CalendarClock className="h-4 w-4" />
          Schedule
        </Button>
        <Button
          size="sm"
          className="gap-1.5"
          disabled={busy !== null}
          onClick={() => run("publish")}
        >
          {busy === "publish" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Publish
        </Button>
      </div>
    </div>
    </>
  );
}

function BackLink() {
  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-muted-foreground"
    >
      <Link href="/chat" aria-label="Back to chat">
        <ArrowLeft className="h-4 w-4" />
      </Link>
    </Button>
  );
}
