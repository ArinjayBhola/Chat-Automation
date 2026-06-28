import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { isDbEnabled } from "@/lib/db";
import {
  deleteWorkflow,
  getWorkflow,
  updateWorkflow,
} from "@/lib/db-queries";
import {
  asEdges,
  asNodes,
  edgesSchema,
  nodesSchema,
} from "@/lib/workflows/validation";

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    nodes: nodesSchema.optional(),
    edges: edgesSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "No fields to update.",
  });

/**
 * GET /api/workflows/[id] — fetch a single workflow owned by the user.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const workflow = await getWorkflow(id, session.user.id);
  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }
  return NextResponse.json(workflow);
}

/**
 * PUT /api/workflows/[id] — update workflow metadata and/or graph.
 */
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const existing = await getWorkflow(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { name, description, nodes, edges, isActive } = parsed.data;
  const updated = await updateWorkflow(id, {
    ...(name !== undefined ? { name } : {}),
    ...(description !== undefined ? { description: description ?? undefined } : {}),
    ...(nodes !== undefined ? { nodes: asNodes(nodes) } : {}),
    ...(edges !== undefined ? { edges: asEdges(edges) } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
  });
  return NextResponse.json(updated);
}

/**
 * DELETE /api/workflows/[id] — permanently delete a workflow (cascades).
 */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isDbEnabled) {
    return NextResponse.json(
      { error: "A database is required." },
      { status: 503 },
    );
  }
  const { id } = await ctx.params;

  const ok = await deleteWorkflow(id, session.user.id);
  if (!ok) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
