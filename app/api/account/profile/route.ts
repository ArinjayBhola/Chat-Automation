import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { isDbEnabled } from "@/lib/db";
import { getUserByEmail, updateUserProfile } from "@/lib/db-queries";
import { sanitizeLine } from "@/lib/sanitize";
import { limiterKey, rateLimit } from "@/lib/rate-limit";

const schema = z
  .object({
    name: z.string().trim().max(80).optional(),
    email: z.string().email().max(200).optional(),
  })
  .refine((v) => v.name !== undefined || v.email !== undefined, {
    message: "Nothing to update.",
  });

/** PATCH /api/account/profile — update the signed-in user's name and/or email. */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isDbEnabled) {
    return NextResponse.json(
      { error: "No database is configured." },
      { status: 503 },
    );
  }

  const rl = rateLimit(limiterKey("account-profile", session.user.id), 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid details." },
      { status: 400 },
    );
  }

  const patch: { name?: string | null; email?: string } = {};
  if (parsed.data.name !== undefined) {
    patch.name = parsed.data.name ? sanitizeLine(parsed.data.name) : null;
  }
  if (parsed.data.email !== undefined) {
    const email = parsed.data.email.toLowerCase();
    const existing = await getUserByEmail(email);
    if (existing && existing.id !== session.user.id) {
      return NextResponse.json(
        { error: "That email is already in use." },
        { status: 409 },
      );
    }
    patch.email = email;
  }

  const updated = await updateUserProfile(session.user.id, patch);
  if (!updated) {
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    user: { name: updated.name, email: updated.email },
  });
}
