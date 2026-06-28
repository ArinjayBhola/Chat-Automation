"use client";

import { useState } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { ChevronDown, MessageSquarePlus, Pin, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  filterChats,
  groupChats,
  type ChatListItem,
} from "@/lib/chat-groups";
import { ChatItem, type ChatActions } from "./chat-item";

// Re-exported so existing imports (`@/components/chat/chat-history`) keep working.
export type { ChatListItem } from "@/lib/chat-groups";
export type { ChatActions } from "./chat-item";

function Section({
  id,
  label,
  icon,
  chats,
  activeChatId,
  actions,
  collapsed,
  onToggle,
}: {
  id: string;
  label: string;
  icon?: React.ReactNode;
  chats: ChatListItem[];
  activeChatId?: string;
  actions: ChatActions;
  collapsed: boolean;
  onToggle: (id: string) => void;
}) {
  const [listRef] = useAutoAnimate<HTMLUListElement>();

  return (
    <section className="space-y-1">
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronDown
          className={cn(
            "h-3 w-3 shrink-0 transition-transform duration-200",
            collapsed && "-rotate-90",
          )}
        />
        {icon}
        <span>{label}</span>
        <span className="ml-auto tabular-nums text-muted-foreground/70">
          {chats.length}
        </span>
      </button>

      {!collapsed && (
        <ul ref={listRef} className="space-y-0.5">
          {chats.map((chat) => (
            <ChatItem
              key={chat.id}
              chat={chat}
              active={chat.id === activeChatId}
              actions={actions}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export function ChatHistory({
  chats,
  activeChatId,
  query,
  actions,
  onNewChat,
}: {
  chats: ChatListItem[];
  activeChatId?: string;
  query: string;
  actions: ChatActions;
  onNewChat: () => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [containerRef] = useAutoAnimate<HTMLDivElement>();

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Empty state: no conversations at all (and no active search).
  if (chats.length === 0 && !query.trim()) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border bg-card text-muted-foreground">
          <MessageSquarePlus className="h-5 w-5" />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            No conversations yet
          </p>
          <p className="text-xs text-muted-foreground">
            Start a chat and your history will show up here.
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={onNewChat}>
          <MessageSquarePlus className="h-4 w-4" />
          New chat
        </Button>
      </div>
    );
  }

  const filtered = filterChats(chats, query);

  // No search matches.
  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
        <SearchX className="h-5 w-5 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          No conversations match &ldquo;{query.trim()}&rdquo;.
        </p>
      </div>
    );
  }

  const { pinned, groups } = groupChats(filtered);

  return (
    <div ref={containerRef} className="space-y-4">
      {pinned.length > 0 && (
        <Section
          id="pinned"
          label="Pinned"
          icon={<Pin className="h-3 w-3 shrink-0" />}
          chats={pinned}
          activeChatId={activeChatId}
          actions={actions}
          collapsed={collapsed.has("pinned")}
          onToggle={toggle}
        />
      )}

      {groups.map((group) => (
        <Section
          key={group.id}
          id={group.id}
          label={group.label}
          chats={group.chats}
          activeChatId={activeChatId}
          actions={actions}
          collapsed={collapsed.has(group.id)}
          onToggle={toggle}
        />
      ))}
    </div>
  );
}
