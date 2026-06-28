import { describe, expect, it } from "vitest";
import {
  filterChats,
  groupChats,
  type ChatListItem,
} from "@/lib/chat-groups";

// Fixed reference point: 2026-06-28 12:00 local.
const NOW = new Date(2026, 5, 28, 12, 0, 0);
const DAY = 86_400_000;

function chat(
  id: string,
  daysAgo: number,
  extra: Partial<ChatListItem> = {},
): ChatListItem {
  return {
    id,
    title: `Chat ${id}`,
    updatedAt: new Date(NOW.getTime() - daysAgo * DAY).toISOString(),
    ...extra,
  };
}

describe("groupChats", () => {
  it("buckets chats by recency into the expected sections", () => {
    const chats = [
      chat("today", 0),
      chat("yesterday", 1),
      chat("week", 4),
      chat("month", 20),
      chat("old", 90),
    ];

    const { groups } = groupChats(chats, NOW);
    const labels = groups.map((g) => g.label);

    expect(labels).toEqual([
      "Today",
      "Yesterday",
      "Previous 7 Days",
      "Previous 30 Days",
      "Older",
    ]);
  });

  it("drops empty buckets", () => {
    const { groups } = groupChats([chat("a", 0), chat("b", 0)], NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Today");
    expect(groups[0].chats).toHaveLength(2);
  });

  it("sorts each bucket newest-first", () => {
    const { groups } = groupChats(
      [chat("older-today", 0.4), chat("newer-today", 0.1)],
      NOW,
    );
    expect(groups[0].chats.map((c) => c.id)).toEqual([
      "newer-today",
      "older-today",
    ]);
  });

  it("extracts pinned chats and sorts by most-recently pinned", () => {
    const chats = [
      chat("a", 0, { pinnedAt: new Date(NOW.getTime() - 10 * DAY).toISOString() }),
      chat("b", 0, { pinnedAt: new Date(NOW.getTime() - 1 * DAY).toISOString() }),
      chat("c", 0),
    ];

    const { pinned, groups } = groupChats(chats, NOW);
    expect(pinned.map((c) => c.id)).toEqual(["b", "a"]);
    // Pinned chats are excluded from the time groups.
    expect(groups.flatMap((g) => g.chats).map((c) => c.id)).toEqual(["c"]);
  });
});

describe("filterChats", () => {
  const chats = [
    chat("a", 0, { title: "Quarterly report" }),
    chat("b", 0, { title: "Lunch plans" }),
    chat("c", 0, { title: "REPORT draft" }),
  ];

  it("returns all chats for an empty query", () => {
    expect(filterChats(chats, "   ")).toHaveLength(3);
  });

  it("matches titles case-insensitively", () => {
    expect(filterChats(chats, "report").map((c) => c.id)).toEqual(["a", "c"]);
  });

  it("returns nothing when no titles match", () => {
    expect(filterChats(chats, "zzz")).toHaveLength(0);
  });
});
