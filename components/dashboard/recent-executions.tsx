"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDuration, timeAgo } from "@/lib/utils";

export interface RecentExecutionItem {
  id: string;
  workflowId: string;
  workflowName: string;
  status: string;
  triggerType: string;
  startedAt: string;
  completedAt: string | null;
  duration: number | null;
  error: string | null;
}

export function RecentExecutions({
  executions,
}: {
  executions: RecentExecutionItem[];
}) {
  return (
    <Card className="p-5">
      <h3 className="mb-3 text-sm font-semibold">Recent executions</h3>
      {executions.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No executions yet. Run a workflow to see it here.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-3 font-medium">Workflow</th>
                <th className="pb-2 pr-3 font-medium">Trigger</th>
                <th className="pb-2 pr-3 font-medium">Status</th>
                <th className="pb-2 pr-3 font-medium">Duration</th>
                <th className="pb-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {executions.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="py-2.5 pr-3">
                    <Link
                      href={`/workflows/${e.workflowId}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {e.workflowName}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-3 text-muted-foreground">
                    {e.triggerType}
                  </td>
                  <td className="py-2.5 pr-3">
                    <StatusBadge status={e.status} />
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums text-muted-foreground">
                    {formatDuration(e.duration)}
                  </td>
                  <td className="py-2.5 text-muted-foreground">
                    {timeAgo(e.startedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "success") return <Badge variant="success">success</Badge>;
  if (status === "failed") {
    return (
      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
        failed
      </span>
    );
  }
  if (status === "running" || status === "paused") {
    return <Badge variant="warning">{status}</Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
}
