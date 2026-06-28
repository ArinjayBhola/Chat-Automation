import {
  CircleStop,
  Clock,
  GitBranch,
  Play,
  Repeat,
  ShieldCheck,
  Wand2,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type {
  NodeConfig,
  WorkflowNode,
  WorkflowNodeType,
} from "@/lib/types/workflow";

/**
 * Presentation + defaults for each of the 8 workflow node types. Shared by the
 * palette, the node renderers, and the properties panel so a node looks and
 * behaves consistently everywhere. Accent colors are expressed with opacity so
 * they read correctly in both light and dark themes (no gradients).
 */
export interface NodeDef {
  type: WorkflowNodeType;
  label: string;
  description: string;
  Icon: LucideIcon;
  /** Icon chip classes (tinted bg + text). */
  chip: string;
  /** Card ring/border accent classes. */
  ring: string;
}

export const NODE_DEFS: Record<WorkflowNodeType, NodeDef> = {
  trigger: {
    type: "trigger",
    label: "Trigger",
    description: "Start the workflow",
    Icon: Play,
    chip: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    ring: "border-blue-500/40",
  },
  tool: {
    type: "tool",
    label: "Tool",
    description: "Run a connected tool",
    Icon: Wrench,
    chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    ring: "border-emerald-500/40",
  },
  condition: {
    type: "condition",
    label: "Condition",
    description: "Branch on a check",
    Icon: GitBranch,
    chip: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    ring: "border-amber-500/40",
  },
  loop: {
    type: "loop",
    label: "Loop",
    description: "Iterate over a list",
    Icon: Repeat,
    chip: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    ring: "border-violet-500/40",
  },
  delay: {
    type: "delay",
    label: "Delay",
    description: "Wait before continuing",
    Icon: Clock,
    chip: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    ring: "border-orange-500/40",
  },
  transform: {
    type: "transform",
    label: "Transform",
    description: "Reshape or extract data",
    Icon: Wand2,
    chip: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
    ring: "border-pink-500/40",
  },
  approval: {
    type: "approval",
    label: "Approval",
    description: "Pause for human approval",
    Icon: ShieldCheck,
    chip: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    ring: "border-indigo-500/40",
  },
  end: {
    type: "end",
    label: "End",
    description: "Finish the workflow",
    Icon: CircleStop,
    chip: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    ring: "border-rose-500/40",
  },
};

/** Ordered list for the palette. */
export const NODE_PALETTE: NodeDef[] = [
  NODE_DEFS.trigger,
  NODE_DEFS.tool,
  NODE_DEFS.condition,
  NODE_DEFS.loop,
  NODE_DEFS.delay,
  NODE_DEFS.transform,
  NODE_DEFS.approval,
  NODE_DEFS.end,
];

/** Sensible starting configuration for a freshly added node. */
export function defaultConfig(type: WorkflowNodeType): NodeConfig {
  switch (type) {
    case "trigger":
      return { type: "manual", description: "Runs when triggered manually" };
    case "tool":
      return { toolName: "gmail", action: "", parameters: {} };
    case "condition":
      return {
        conditions: [{ variable: "", operator: "==", value: "" }],
        combineWith: "AND",
      };
    case "loop":
      return { array: "", itemVariableName: "item", maxIterations: 100 };
    case "delay":
      return { duration: 1, unit: "minutes" };
    case "transform":
      return {
        transformations: [{ outputVariable: "", expression: "" }],
        language: "javascript",
      };
    case "approval":
      return { approvers: [], message: "Please review and approve" };
    case "end":
      return { status: "success" };
    default:
      return {};
  }
}

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `node_${Math.random().toString(36).slice(2, 10)}`;
}

/** Build a new node ready to drop on the canvas. */
export function createNode(
  type: WorkflowNodeType,
  position: { x: number; y: number },
): WorkflowNode {
  return {
    id: genId(),
    type,
    position,
    data: { label: NODE_DEFS[type].label, config: defaultConfig(type) },
  };
}
