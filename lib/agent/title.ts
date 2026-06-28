import "server-only";
import { generateText } from "ai";
import { resolveModel } from "../ai/provider";

/**
 * Generates a short, human-friendly title (2-4 words) for a new chat from the
 * user's first message, e.g. "hello how are you" -> "Friendly Greeting".
 * Falls back to a heuristic when no AI provider is configured or the call fails,
 * so a chat always gets a sensible name without ever throwing.
 */
export async function generateChatTitle(
  modelId: string,
  message: string,
): Promise<string> {
  const fallback = fallbackTitle(message);

  let resolved: Awaited<ReturnType<typeof resolveModel>> = null;
  try {
    resolved = await resolveModel(modelId);
  } catch {
    resolved = null;
  }
  if (!resolved) return fallback;

  try {
    const { text } = await generateText({
      model: resolved.model,
      maxOutputTokens: 16,
      temperature: 0.3,
      prompt:
        "Summarize the user's message as a short title of 2 to 4 words in Title Case. " +
        "Do not use quotes, punctuation, or a trailing period. Reply with the title only.\n\n" +
        `Message: ${message.slice(0, 500)}\n\nTitle:`,
    });
    return cleanTitle(text) || fallback;
  } catch {
    return fallback;
  }
}

/** Tidy a model-produced title: strip quotes/labels/punctuation, cap length. */
function cleanTitle(raw: string): string {
  let t = (raw ?? "").trim();
  t = t.replace(/^title[:\-\s]+/i, ""); // drop a leading "Title:" the model may add
  t = t.replace(/["'`]/g, "").replace(/\s+/g, " ").trim();
  t = t.replace(/[.;,!?]+$/g, "").trim();
  const words = t.split(" ").filter(Boolean).slice(0, 6);
  return words.join(" ").slice(0, 60);
}

/** Heuristic title from the first few words of the message. */
function fallbackTitle(message: string): string {
  const words = message
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 4);
  if (words.length === 0) return "New chat";
  const title = words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return title.slice(0, 60);
}
