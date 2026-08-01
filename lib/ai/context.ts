import type { ModelMessage } from "ai";

/** Conservative character-based estimate used without loading a tokenizer. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export const CHAT_CONTEXT_TOKEN_BUDGET = 12_000;

/** Keep the newest turns while preserving the first user request when possible. */
export function trimChatHistory<T extends { role: string; content: string }>(
  history: T[],
  budget = CHAT_CONTEXT_TOKEN_BUDGET,
): T[] {
  if (!history.length) return [];
  const first = history[0];
  const result: T[] = [];
  let used = 0;

  const add = (item: T) => {
    const cost = estimateTokens(item.content);
    if (used + cost > budget && result.length > 0) return false;
    result.push(item);
    used += Math.min(cost, budget);
    return true;
  };

  add(first);
  for (let i = history.length - 1; i >= 1; i -= 1) {
    const item = history[i];
    const cost = estimateTokens(item.content);
    if (used + cost > budget) break;
    result.push(item);
    used += cost;
  }

  return result.length > 1
    ? [result[0], ...result.slice(1).reverse()]
    : result;
}

export function trimModelMessages(
  history: ModelMessage[],
  budget = CHAT_CONTEXT_TOKEN_BUDGET,
): ModelMessage[] {
  return trimChatHistory(
    history.map((message) => ({
      ...message,
      content:
        typeof message.content === "string"
          ? message.content
          : JSON.stringify(message.content),
    })),
    budget,
  ) as ModelMessage[];
}
