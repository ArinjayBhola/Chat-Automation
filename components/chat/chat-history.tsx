"use client";

import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  onNew,
}: {
  chats: ChatListItem[];
  activeChatId?: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-1 pb-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Chats
        </h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          aria-label="New chat"
          onClick={onNew}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {chats.length === 0 ? (
        <p className="px-2 py-1 text-xs text-muted-foreground">
          No saved chats yet.
        </p>
      ) : (
        chats.map((chat) => (
          <div
            key={chat.id}
            className={cn(
              "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent",
              chat.id === activeChatId && "bg-accent",
            )}
          >
            <button
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
              onClick={() => onSelect(chat.id)}
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{chat.title}</span>
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100"
              aria-label="Delete chat"
              onClick={() => onDelete(chat.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))
      )}
    </div>
  );
}
