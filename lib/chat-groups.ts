import { groupByRecency } from "./time-groups";

export type ChatListItem = {
  id: string;
  title: string;
  updatedAt: string;
  pinnedAt?: string | null;
};

export type ChatGroup = {
  id: string;
  label: string;
  chats: ChatListItem[];
};

export type GroupedChats = {
  pinned: ChatListItem[];
  groups: ChatGroup[];
};

/**
 * Split chats into a pinned list (sorted by most-recently pinned) and
 * time-based buckets (sorted newest-first). Empty buckets are dropped, so the
 * UI only renders sections that contain conversations. `now` is injectable for
 * deterministic tests.
 */
export function groupChats(
  chats: ChatListItem[],
  now: Date = new Date(),
): GroupedChats {
  const pinned = chats
    .filter((c) => c.pinnedAt)
    .sort(
      (a, b) =>
        new Date(b.pinnedAt as string).getTime() -
        new Date(a.pinnedAt as string).getTime(),
    );

  const rest = chats.filter((c) => !c.pinnedAt);
  const groups = groupByRecency(rest, (c) => c.updatedAt, now).map((g) => ({
    id: g.id,
    label: g.label,
    chats: g.items,
  }));

  return { pinned, groups };
}

/** Case-insensitive title filter. Empty/whitespace query returns all chats. */
export function filterChats(
  chats: ChatListItem[],
  query: string,
): ChatListItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return chats;
  return chats.filter((c) => c.title.toLowerCase().includes(q));
}
