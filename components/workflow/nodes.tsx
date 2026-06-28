"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps, type NodeTypes } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { NODE_DEFS } from "@/lib/workflows/node-defaults";
import type {
  ApprovalConfig,
  ConditionConfig,
  DelayConfig,
  LoopConfig,
  ToolConfig,
  TransformConfig,
  TriggerConfig,
  WorkflowNodeType,
} from "@/lib/types/workflow";
import type { WfNode } from "@/lib/stores/workflow-store";

const handleClass =
  "!h-2.5 !w-2.5 !rounded-full !border-2 !border-background !bg-muted-foreground";

function summarize(type: WorkflowNodeType, config: unknown): string {
  const c = (config ?? {}) as Record<string, unknown>;
  switch (type) {
    case "trigger":
      return (c as unknown as TriggerConfig).type ?? "manual";
    case "tool": {
      const t = c as unknown as ToolConfig;
      return [t.toolName, t.action].filter(Boolean).join(" · ") || "tool";
    }
    case "condition": {
      const t = c as unknown as ConditionConfig;
      const n = t.conditions?.length ?? 0;
      return `${n} check${n === 1 ? "" : "s"} (${t.combineWith ?? "AND"})`;
    }
    case "loop": {
      const t = c as unknown as LoopConfig;
      return t.array ? `for each ${t.itemVariableName || "item"} in ${t.array}` : "loop";
    }
    case "delay": {
      const t = c as unknown as DelayConfig;
      return `wait ${t.duration ?? 0} ${t.unit ?? "minutes"}`;
    }
    case "transform": {
      const t = c as unknown as TransformConfig;
      const n = t.transformations?.length ?? 0;
      return `${n} transform${n === 1 ? "" : "s"}`;
    }
    case "approval": {
      const t = c as unknown as ApprovalConfig;
      return t.message ? t.message.slice(0, 40) : "approval gate";
    }
    case "end":
      return "end";
    default:
      return type;
  }
}

function BaseNode({
  type,
  data,
  selected,
  children,
}: {
  type: WorkflowNodeType;
  data: WfNode["data"];
  selected?: boolean;
  children?: React.ReactNode;
}) {
  const def = NODE_DEFS[type];
  const Icon = def.Icon;
  return (
    <div
      className={cn(
        "w-52 rounded-xl border bg-card text-card-foreground shadow-sm transition-shadow",
        def.ring,
        selected ? "ring-2 ring-ring shadow-md" : "hover:shadow-md",
      )}
    >
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
            def.chip,
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{data.label}</div>
          <div className="truncate text-[11px] text-muted-foreground">
            {summarize(type, data.config)}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

const targetHandle = (
  <Handle type="target" position={Position.Top} className={handleClass} />
);
const sourceHandle = (
  <Handle type="source" position={Position.Bottom} className={handleClass} />
);

export const TriggerNode = memo(function TriggerNode({
  data,
  selected,
}: NodeProps<WfNode>) {
  return (
    <BaseNode type="trigger" data={data} selected={selected}>
      {sourceHandle}
    </BaseNode>
  );
});

export const ToolNode = memo(function ToolNode({
  data,
  selected,
}: NodeProps<WfNode>) {
  return (
    <BaseNode type="tool" data={data} selected={selected}>
      {targetHandle}
      {sourceHandle}
    </BaseNode>
  );
});

export const ConditionNode = memo(function ConditionNode({
  data,
  selected,
}: NodeProps<WfNode>) {
  return (
    <BaseNode type="condition" data={data} selected={selected}>
      {targetHandle}
      <Handle
        id="true"
        type="source"
        position={Position.Bottom}
        style={{ left: "30%" }}
        className={handleClass}
      />
      <Handle
        id="false"
        type="source"
        position={Position.Bottom}
        style={{ left: "70%" }}
        className={handleClass}
      />
      <div className="flex justify-between px-3 pb-1.5 text-[10px] font-medium text-muted-foreground">
        <span className="text-emerald-600 dark:text-emerald-400">true</span>
        <span className="text-rose-600 dark:text-rose-400">false</span>
      </div>
    </BaseNode>
  );
});

export const LoopNode = memo(function LoopNode({
  data,
  selected,
}: NodeProps<WfNode>) {
  return (
    <BaseNode type="loop" data={data} selected={selected}>
      {targetHandle}
      {sourceHandle}
    </BaseNode>
  );
});

export const DelayNode = memo(function DelayNode({
  data,
  selected,
}: NodeProps<WfNode>) {
  return (
    <BaseNode type="delay" data={data} selected={selected}>
      {targetHandle}
      {sourceHandle}
    </BaseNode>
  );
});

export const TransformNode = memo(function TransformNode({
  data,
  selected,
}: NodeProps<WfNode>) {
  return (
    <BaseNode type="transform" data={data} selected={selected}>
      {targetHandle}
      {sourceHandle}
    </BaseNode>
  );
});

export const ApprovalNode = memo(function ApprovalNode({
  data,
  selected,
}: NodeProps<WfNode>) {
  return (
    <BaseNode type="approval" data={data} selected={selected}>
      {targetHandle}
      {sourceHandle}
    </BaseNode>
  );
});

export const EndNode = memo(function EndNode({
  data,
  selected,
}: NodeProps<WfNode>) {
  return (
    <BaseNode type="end" data={data} selected={selected}>
      {targetHandle}
    </BaseNode>
  );
});

export const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  tool: ToolNode,
  condition: ConditionNode,
  loop: LoopNode,
  delay: DelayNode,
  transform: TransformNode,
  approval: ApprovalNode,
  end: EndNode,
};
