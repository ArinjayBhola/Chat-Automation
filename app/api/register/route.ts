import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isDbEnabled } from "@/lib/db";
import { createCredentialsUser, getUserByEmail } from "@/lib/db-queries";
import { hashPassword } from "@/lib/password";
import { sanitizeLine } from "@/lib/sanitize";
import { limiterKey, rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  name: z.string().trim().max(80).optional(),
  email: z.string().email().max(200),
  password: z.string().min(8, "Password must be at least 8 characters.").max(200),
});

/**
 * POST /api/register - create an email/password account.
 */
export async function POST(req: NextRequest) {
  if (!isDbEnabled) {
    return NextResponse.json(
      { error: "Sign-up is unavailable: no database is configured." },
      { status: 503 },
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(limiterKey("register", ip), 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a moment and try again." },
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

  const email = parsed.data.email.toLowerCase();
  const name = parsed.data.name ? sanitizeLine(parsed.data.name) : null;

  const existing = await getUserByEmail(email);
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await createCredentialsUser({ email, name, passwordHash });

  return NextResponse.json({ ok: true });
}
