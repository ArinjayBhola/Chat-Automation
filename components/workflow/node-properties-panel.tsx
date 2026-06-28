"use client";

import { useMemo, useState } from "react";
import { Trash2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NODE_DEFS } from "@/lib/workflows/node-defaults";
import { useWorkflowStore } from "@/lib/stores/workflow-store";
import type {
  ApprovalConfig,
  ConditionConfig,
  ConditionOperator,
  DelayConfig,
  EndConfig,
  LoopConfig,
  NodeConfig,
  ToolConfig,
  ToolName,
  TransformConfig,
  TriggerConfig,
} from "@/lib/types/workflow";

const OPERATORS: ConditionOperator[] = [
  "==",
  "!=",
  ">",
  "<",
  "includes",
  "exists",
];
const TOOLS: ToolName[] = ["gmail", "drive", "docs", "calendar", "notion"];

export function NodePropertiesPanel() {
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const node = useWorkflowStore((s) =>
    s.nodes.find((n) => n.id === s.selectedNodeId),
  );
  const updateNodeLabel = useWorkflowStore((s) => s.updateNodeLabel);
  const updateNodeConfig = useWorkflowStore((s) => s.updateNodeConfig);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);

  if (!node || !selectedNodeId) {
    return (
      <div className="flex w-80 shrink-0 items-center justify-center border-l bg-surface p-6 text-center text-sm text-muted-foreground">
        Select a node to edit its properties.
      </div>
    );
  }

  const type = (node.type ?? "tool") as keyof typeof NODE_DEFS;
  const def = NODE_DEFS[type];
  const Icon = def.Icon;
  const config = (node.data.config ?? {}) as NodeConfig;
  const set = (next: NodeConfig) => updateNodeConfig(node.id, next);

  return (
    <div className="flex w-80 shrink-0 flex-col border-l bg-surface">
      <div className="flex items-center gap-2.5 border-b px-4 py-3">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-md ${def.chip}`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="text-sm font-semibold">{def.label} node</div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto scrollbar-thin p-4">
        <Field label="Label">
          <Input
            value={node.data.label}
            onChange={(e) => updateNodeLabel(node.id, e.target.value)}
            placeholder="Node label"
          />
        </Field>

        {type === "trigger" && (
          <TriggerEditor value={config as TriggerConfig} onChange={set} />
        )}
        {type === "tool" && (
          <ToolEditor value={config as ToolConfig} onChange={set} />
        )}
        {type === "condition" && (
          <ConditionEditor value={config as ConditionConfig} onChange={set} />
        )}
        {type === "loop" && (
          <LoopEditor value={config as LoopConfig} onChange={set} />
        )}
        {type === "delay" && (
          <DelayEditor value={config as DelayConfig} onChange={set} />
        )}
        {type === "transform" && (
          <TransformEditor value={config as TransformConfig} onChange={set} />
        )}
        {type === "approval" && (
          <ApprovalEditor value={config as ApprovalConfig} onChange={set} />
        )}
        {type === "end" && (
          <EndEditor value={config as EndConfig} onChange={set} />
        )}
      </div>

      <div className="border-t p-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive [&_svg]:text-destructive"
          onClick={() => deleteNode(node.id)}
        >
          <Trash2 className="h-4 w-4" />
          Delete node
        </Button>
      </div>
    </div>
  );
}

// --- shared field wrapper --------------------------------------------------
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// --- per-type editors ------------------------------------------------------
function TriggerEditor({
  value,
  onChange,
}: {
  value: TriggerConfig;
  onChange: (c: TriggerConfig) => void;
}) {
  return (
    <>
      <Field label="Trigger type">
        <Select
          value={value.type ?? "manual"}
          onValueChange={(v) =>
            onChange({ ...value, type: v as TriggerConfig["type"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="schedule">Schedule</SelectItem>
            <SelectItem value="webhook">Webhook</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      {value.type === "schedule" && (
        <Field label="Schedule id" hint="Links to a saved cron schedule.">
          <Input
            value={value.scheduleId ?? ""}
            onChange={(e) => onChange({ ...value, scheduleId: e.target.value })}
            placeholder="schedule_..."
          />
        </Field>
      )}
      {value.type === "webhook" && (
        <Field label="Webhook URL">
          <Input
            value={value.webhookUrl ?? ""}
            onChange={(e) => onChange({ ...value, webhookUrl: e.target.value })}
            placeholder="https://..."
          />
        </Field>
      )}
      <Field label="Description">
        <Textarea
          value={value.description ?? ""}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
          placeholder="What starts this workflow?"
        />
      </Field>
    </>
  );
}

function ToolEditor({
  value,
  onChange,
}: {
  value: ToolConfig;
  onChange: (c: ToolConfig) => void;
}) {
  return (
    <>
      <Field label="Tool">
        <Select
          value={value.toolName ?? "gmail"}
          onValueChange={(v) => onChange({ ...value, toolName: v as ToolName })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TOOLS.map((t) => (
              <SelectItem key={t} value={t} className="capitalize">
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Action" hint="e.g. send_email, search_files, create_event">
        <Input
          value={value.action ?? ""}
          onChange={(e) => onChange({ ...value, action: e.target.value })}
          placeholder="send_email"
        />
      </Field>
      <JsonField
        label="Parameters"
        value={value.parameters ?? {}}
        onChange={(params) => onChange({ ...value, parameters: params })}
      />
    </>
  );
}

function ConditionEditor({
  value,
  onChange,
}: {
  value: ConditionConfig;
  onChange: (c: ConditionConfig) => void;
}) {
  const conditions = value.conditions ?? [];
  const update = (i: number, patch: Partial<(typeof conditions)[number]>) =>
    onChange({
      ...value,
      conditions: conditions.map((c, idx) =>
        idx === i ? { ...c, ...patch } : c,
      ),
    });
  return (
    <>
      <Field label="Combine with">
        <Select
          value={value.combineWith ?? "AND"}
          onValueChange={(v) =>
            onChange({ ...value, combineWith: v as "AND" | "OR" })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AND">AND (all)</SelectItem>
            <SelectItem value="OR">OR (any)</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <div className="space-y-3">
        <Label>Conditions</Label>
        {conditions.map((c, i) => (
          <div key={i} className="space-y-2 rounded-lg border bg-card p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">
                #{i + 1}
              </span>
              <button
                type="button"
                aria-label="Remove condition"
                className="text-muted-foreground hover:text-destructive"
                onClick={() =>
                  onChange({
                    ...value,
                    conditions: conditions.filter((_, idx) => idx !== i),
                  })
                }
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <Input
              value={c.variable}
              onChange={(e) => update(i, { variable: e.target.value })}
              placeholder="variable (e.g. emails.length)"
            />
            <div className="flex gap-2">
              <Select
                value={c.operator}
                onValueChange={(v) =>
                  update(i, { operator: v as ConditionOperator })
                }
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPERATORS.map((op) => (
                    <SelectItem key={op} value={op}>
                      {op}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={c.value}
                onChange={(e) => update(i, { value: e.target.value })}
                placeholder="value"
                disabled={c.operator === "exists"}
              />
            </div>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5"
          onClick={() =>
            onChange({
              ...value,
              conditions: [
                ...conditions,
                { variable: "", operator: "==", value: "" },
              ],
            })
          }
        >
          <Plus className="h-3.5 w-3.5" />
          Add condition
        </Button>
      </div>
    </>
  );
}

function LoopEditor({
  value,
  onChange,
}: {
  value: LoopConfig;
  onChange: (c: LoopConfig) => void;
}) {
  return (
    <>
      <Field label="Array variable" hint="Variable holding the list to loop.">
        <Input
          value={value.array ?? ""}
          onChange={(e) => onChange({ ...value, array: e.target.value })}
          placeholder="emails"
        />
      </Field>
      <Field label="Item variable name">
        <Input
          value={value.itemVariableName ?? ""}
          onChange={(e) =>
            onChange({ ...value, itemVariableName: e.target.value })
          }
          placeholder="email"
        />
      </Field>
      <Field label="Max iterations">
        <Input
          type="number"
          min={1}
          value={value.maxIterations ?? 100}
          onChange={(e) =>
            onChange({ ...value, maxIterations: Number(e.target.value) || 1 })
          }
        />
      </Field>
    </>
  );
}

function DelayEditor({
  value,
  onChange,
}: {
  value: DelayConfig;
  onChange: (c: DelayConfig) => void;
}) {
  return (
    <div className="flex gap-2">
      <Field label="Duration">
        <Input
          type="number"
          min={0}
          value={value.duration ?? 0}
          onChange={(e) =>
            onChange({ ...value, duration: Number(e.target.value) || 0 })
          }
        />
      </Field>
      <Field label="Unit">
        <Select
          value={value.unit ?? "minutes"}
          onValueChange={(v) =>
            onChange({ ...value, unit: v as DelayConfig["unit"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="seconds">Seconds</SelectItem>
            <SelectItem value="minutes">Minutes</SelectItem>
            <SelectItem value="hours">Hours</SelectItem>
            <SelectItem value="days">Days</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

function TransformEditor({
  value,
  onChange,
}: {
  value: TransformConfig;
  onChange: (c: TransformConfig) => void;
}) {
  const items = value.transformations ?? [];
  const update = (i: number, patch: Partial<(typeof items)[number]>) =>
    onChange({
      ...value,
      transformations: items.map((t, idx) =>
        idx === i ? { ...t, ...patch } : t,
      ),
    });
  return (
    <div className="space-y-3">
      <Label>Transformations</Label>
      {items.map((t, i) => (
        <div key={i} className="space-y-2 rounded-lg border bg-card p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">
              #{i + 1}
            </span>
            <button
              type="button"
              aria-label="Remove transformation"
              className="text-muted-foreground hover:text-destructive"
              onClick={() =>
                onChange({
                  ...value,
                  transformations: items.filter((_, idx) => idx !== i),
                })
              }
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <Input
            value={t.outputVariable}
            onChange={(e) => update(i, { outputVariable: e.target.value })}
            placeholder="outputVariable"
          />
          <Textarea
            value={t.expression}
            onChange={(e) => update(i, { expression: e.target.value })}
            placeholder="data.emails.filter(e => e.unread)"
            className="font-mono text-xs"
          />
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-1.5"
        onClick={() =>
          onChange({
            ...value,
            language: "javascript",
            transformations: [...items, { outputVariable: "", expression: "" }],
          })
        }
      >
        <Plus className="h-3.5 w-3.5" />
        Add transformation
      </Button>
    </div>
  );
}

function ApprovalEditor({
  value,
  onChange,
}: {
  value: ApprovalConfig;
  onChange: (c: ApprovalConfig) => void;
}) {
  return (
    <>
      <Field
        label="Approvers"
        hint="Comma-separated user ids or emails."
      >
        <Input
          value={(value.approvers ?? []).join(", ")}
          onChange={(e) =>
            onChange({
              ...value,
              approvers: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="alice@acme.com, bob@acme.com"
        />
      </Field>
      <Field label="Timeout (minutes)">
        <Input
          type="number"
          min={0}
          value={value.timeout ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              timeout: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          placeholder="Optional"
        />
      </Field>
      <Field label="Message">
        <Textarea
          value={value.message ?? ""}
          onChange={(e) => onChange({ ...value, message: e.target.value })}
          placeholder="What should the approver review?"
        />
      </Field>
    </>
  );
}

function EndEditor({
  value,
  onChange,
}: {
  value: EndConfig;
  onChange: (c: EndConfig) => void;
}) {
  return (
    <>
      <Field label="Final status">
        <Select
          value={value.status ?? "success"}
          onValueChange={(v) =>
            onChange({ ...value, status: v as EndConfig["status"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Note">
        <Input
          value={value.note ?? ""}
          onChange={(e) => onChange({ ...value, note: e.target.value })}
          placeholder="Optional"
        />
      </Field>
    </>
  );
}

// --- JSON editor field -----------------------------------------------------
function JsonField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Record<string, unknown>;
  onChange: (v: Record<string, unknown>) => void;
}) {
  const initial = useMemo(() => JSON.stringify(value, null, 2), [value]);
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  return (
    <Field label={label}>
      <Textarea
        value={text}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          try {
            const parsed = next.trim() ? JSON.parse(next) : {};
            if (typeof parsed !== "object" || Array.isArray(parsed)) {
              setError("Must be a JSON object.");
              return;
            }
            setError(null);
            onChange(parsed as Record<string, unknown>);
          } catch {
            setError("Invalid JSON.");
          }
        }}
        className="min-h-[96px] font-mono text-xs"
        placeholder="{ }"
      />
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </Field>
  );
}
