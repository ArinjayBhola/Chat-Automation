import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { buildAssistantMessage } from "@/lib/ai/mock-agent";
import { uid } from "@/lib/utils";
import type { ChatResponse } from "@/lib/types";

const bodySchema = z.object({
  message: z.string().min(1).max(8000),
  chatId: z.string().optional(),
  modelId: z.string().optional(),
});

/**
 * POST /api/chat — send a message, get an assistant response.
 *
 * Phase 1: returns a deterministic mock plan (steps + optional approval) so the
 * UI is fully exercisable in demo mode. Phase 3 replaces the body with the real
 * streaming agent while keeping this contract.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { message, chatId } = parsed.data;

  // Simulate "thinking" latency so the UI spinner is visible in demo mode.
  await new Promise((r) => setTimeout(r, 600));

  const assistant = buildAssistantMessage(message);

  const response: ChatResponse = {
    chatId: chatId ?? uid("chat"),
    message: assistant,
  };

  return NextResponse.json(response);
}
