"use client";

import { MessageSquare, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChatListItem = {
  id: string;
  title: string;
  updatedAt: string;
};

export function ChatHistory({
  chats,
  activeChatId,
  onSelect,
  onDelete,
}: {
  chats: ChatListItem[];
  activeChatId?: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-1">
      <h2 className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Recent
      </h2>

      {chats.length === 0 ? (
        <p className="rounded-lg px-2 py-3 text-center text-xs text-muted-foreground">
          No conversations yet.
        </p>
      ) : (
        <ul className="space-y-0.5">
          {chats.map((chat) => {
            const active = chat.id === activeChatId;
            return (
              <li
                key={chat.id}
                className={cn(
                  "group relative flex items-center rounded-lg text-sm transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground/80 hover:bg-accent/60",
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
                )}
                <button
                  className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left"
                  onClick={() => onSelect(chat.id)}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{chat.title}</span>
                </button>
                <button
                  className="mr-1 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                  aria-label="Delete chat"
                  onClick={() => onDelete(chat.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
