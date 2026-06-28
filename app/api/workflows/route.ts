import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { isDbEnabled } from "@/lib/db";
import { createWorkflow, listWorkflows } from "@/lib/db-queries";
import { limiterKey, rateLimit } from "@/lib/rate-limit";

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000).optional(),
});

/**
 * GET /api/workflows — list the current user's workflows (paginated, searchable).
 * Query params: page, limit, search, sortBy (createdAt|updatedAt|name).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isDbEnabled) {
    return NextResponse.json({ workflows: [], total: 0, pages: 0 });
  }

  const sp = req.nextUrl.searchParams;
  const page = Math.max(Number(sp.get("page") ?? 1) || 1, 1);
  const limit = Math.min(Math.max(Number(sp.get("limit") ?? 20) || 20, 1), 100);
  const search = sp.get("search")?.trim() || undefined;
  const sortByRaw = sp.get("sortBy");
  const sortBy =
    sortByRaw === "createdAt" || sortByRaw === "name" ? sortByRaw : "updatedAt";

  const { rows, total } = await listWorkflows(session.user.id, {
    search,
    sortBy,
    limit,
    offset: (page - 1) * limit,
  });

  return NextResponse.json({
    workflows: rows,
    total,
    page,
    pages: Math.max(Math.ceil(total / limit), 1),
  });
}

/**
 * POST /api/workflows — create a new (empty) workflow.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isDbEnabled) {
    return NextResponse.json(
      { error: "A database is required to create workflows." },
      { status: 503 },
    );
  }

  const rl = rateLimit(limiterKey("workflow:create", session.user.id), 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const workflow = await createWorkflow(
    session.user.id,
    parsed.data.name,
    parsed.data.description,
  );
  if (!workflow) {
    return NextResponse.json(
      { error: "Failed to create workflow." },
      { status: 500 },
    );
  }
  return NextResponse.json(workflow, { status: 201 });
}
