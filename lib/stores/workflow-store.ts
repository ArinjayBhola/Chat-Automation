import { create } from "zustand";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { createNode } from "@/lib/workflows/node-defaults";
import type {
  NodeConfig,
  WorkflowNodeData,
  WorkflowNodeType,
} from "@/lib/types/workflow";

export type WfNode = Node<WorkflowNodeData>;
export type WfEdge = Edge;

export interface WorkflowMeta {
  id: string;
  name: string;
  description: string | null;
  version: number;
  isActive: boolean;
  isPublished: boolean;
}

export interface TestResult {
  ok: boolean;
  issues: string[];
  nodeCount: number;
  edgeCount: number;
}

interface WorkflowStore {
  meta: WorkflowMeta | null;
  nodes: WfNode[];
  edges: WfEdge[];
  selectedNodeId: string | null;
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  lastTest: TestResult | null;

  loadWorkflow: (id: string) => Promise<void>;
  clear: () => void;
  setMeta: (patch: Partial<WorkflowMeta>) => void;
  /** Update the name without marking the workflow dirty (already persisted). */
  renameMeta: (name: string) => void;

  onNodesChange: (changes: NodeChange<WfNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<WfEdge>[]) => void;
  onConnect: (connection: Connection) => void;

  addNode: (type: WorkflowNodeType, position: { x: number; y: number }) => void;
  selectNode: (id: string | null) => void;
  updateNodeLabel: (id: string, label: string) => void;
  updateNodeConfig: (id: string, config: NodeConfig) => void;
  deleteNode: (id: string) => void;

  save: () => Promise<boolean>;
  publish: () => Promise<{ ok: boolean; error?: string }>;
  test: () => Promise<TestResult | null>;
}

function toRfNodes(
  nodes: { id: string; type: string; position: { x: number; y: number }; data: WorkflowNodeData }[],
): WfNode[] {
  return nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: n.data,
  }));
}

/** Strip React Flow runtime fields down to the persisted graph shape. */
function serialize(state: { nodes: WfNode[]; edges: WfEdge[] }) {
  const nodes = state.nodes.map((n) => ({
    id: n.id,
    type: (n.type ?? "tool") as WorkflowNodeType,
    position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
    data: {
      label: n.data.label,
      ...(n.data.description ? { description: n.data.description } : {}),
      config: n.data.config ?? {},
      ...(n.data.inputs ? { inputs: n.data.inputs } : {}),
      ...(n.data.outputs ? { outputs: n.data.outputs } : {}),
    },
  }));
  const edges = state.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? null,
    targetHandle: e.targetHandle ?? null,
    ...(e.data ? { data: e.data } : {}),
  }));
  return { nodes, edges };
}

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  meta: null,
  nodes: [],
  edges: [],
  selectedNodeId: null,
  loading: false,
  saving: false,
  dirty: false,
  lastTest: null,

  loadWorkflow: async (id) => {
    set({ loading: true });
    try {
      const res = await fetch(`/api/workflows/${id}`);
      if (!res.ok) {
        set({ loading: false });
        return;
      }
      const wf = await res.json();
      set({
        meta: {
          id: wf.id,
          name: wf.name,
          description: wf.description ?? null,
          version: wf.version,
          isActive: wf.isActive,
          isPublished: wf.isPublished,
        },
        nodes: toRfNodes(wf.nodes ?? []),
        edges: (wf.edges ?? []) as WfEdge[],
        selectedNodeId: null,
        dirty: false,
        lastTest: null,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  clear: () =>
    set({
      meta: null,
      nodes: [],
      edges: [],
      selectedNodeId: null,
      dirty: false,
      lastTest: null,
    }),

  setMeta: (patch) =>
    set((s) => ({
      meta: s.meta ? { ...s.meta, ...patch } : s.meta,
      dirty: true,
    })),

  renameMeta: (name) =>
    set((s) => ({ meta: s.meta ? { ...s.meta, name } : s.meta })),

  onNodesChange: (changes) =>
    set((s) => ({
      nodes: applyNodeChanges(changes, s.nodes),
      dirty:
        s.dirty ||
        changes.some((c) => c.type !== "select" && c.type !== "dimensions"),
    })),

  onEdgesChange: (changes) =>
    set((s) => ({
      edges: applyEdgeChanges(changes, s.edges),
      dirty: s.dirty || changes.some((c) => c.type !== "select"),
    })),

  onConnect: (connection) =>
    set((s) => ({ edges: addEdge(connection, s.edges), dirty: true })),

  addNode: (type, position) => {
    const node = createNode(type, position);
    set((s) => ({
      nodes: [...s.nodes, { id: node.id, type, position, data: node.data }],
      selectedNodeId: node.id,
      dirty: true,
    }));
  },

  selectNode: (id) => set({ selectedNodeId: id }),

  updateNodeLabel: (id, label) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, label } } : n,
      ),
      dirty: true,
    })),

  updateNodeConfig: (id, config) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, config } } : n,
      ),
      dirty: true,
    })),

  deleteNode: (id) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
      dirty: true,
    })),

  save: async () => {
    const { meta, nodes, edges } = get();
    if (!meta) return false;
    set({ saving: true });
    try {
      const res = await fetch(`/api/workflows/${meta.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: meta.name,
          description: meta.description,
          ...serialize({ nodes, edges }),
        }),
      });
      set({ saving: false });
      if (!res.ok) return false;
      set({ dirty: false });
      return true;
    } catch {
      set({ saving: false });
      return false;
    }
  },

  publish: async () => {
    const ok = await get().save();
    if (!ok) return { ok: false, error: "Could not save before publishing." };
    const { meta } = get();
    if (!meta) return { ok: false, error: "No workflow loaded." };
    try {
      const res = await fetch(`/api/workflows/${meta.id}/publish`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: data?.error ?? "Publish failed." };
      }
      set((s) => ({
        meta: s.meta
          ? { ...s.meta, isPublished: true, version: data.version ?? s.meta.version }
          : s.meta,
      }));
      return { ok: true };
    } catch {
      return { ok: false, error: "Network error while publishing." };
    }
  },

  test: async () => {
    const ok = await get().save();
    const { meta } = get();
    if (!ok || !meta) return null;
    try {
      const res = await fetch(`/api/workflows/${meta.id}/test`, {
        method: "POST",
      });
      const result = (await res.json()) as TestResult;
      set({ lastTest: result });
      return result;
    } catch {
      return null;
    }
  },
}));
