import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { isDbEnabled } from "@/lib/db";
import { getUserById, setUserPassword } from "@/lib/db-queries";
import { hashPassword, verifyPassword } from "@/lib/password";
import { limiterKey, rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  currentPassword: z.string().max(200).optional(),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(200),
});

/**
 * POST /api/account/password — change the password, or set one for the first
 * time (OAuth-only accounts creating email/password credentials).
 */
export async function POST(req: NextRequest) {
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

  const rl = rateLimit(limiterKey("account-password", session.user.id), 5, 60_000);
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

  const user = await getUserById(session.user.id);
  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  // Existing credentials accounts must confirm their current password.
  if (user.passwordHash) {
    if (!parsed.data.currentPassword) {
      return NextResponse.json(
        { error: "Enter your current password." },
        { status: 400 },
      );
    }
    const valid = await verifyPassword(
      parsed.data.currentPassword,
      user.passwordHash,
    );
    if (!valid) {
      return NextResponse.json(
        { error: "Current password is incorrect." },
        { status: 400 },
      );
    }
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await setUserPassword(session.user.id, passwordHash);

  return NextResponse.json({ ok: true, hasPassword: true });
}
