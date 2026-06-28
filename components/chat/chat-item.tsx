"use client";

import { useEffect, useRef, useState } from "react";
import {
  Archive,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ChatListItem } from "@/lib/chat-groups";

export type ChatActions = {
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
};

export function ChatItem({
  chat,
  active,
  actions,
}: {
  chat: ChatListItem;
  active: boolean;
  actions: ChatActions;
}) {
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState(chat.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const pinned = Boolean(chat.pinnedAt);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function startEdit() {
    setDraft(chat.title);
    setEditing(true);
  }

  function commit() {
    if (!editing) return;
    setEditing(false);
    const next = draft.trim();
    if (next && next !== chat.title) actions.onRename(chat.id, next);
  }

  function cancel() {
    setEditing(false);
    setDraft(chat.title);
  }

  return (
    <li
      onContextMenu={(e) => {
        if (editing) return;
        e.preventDefault();
        setMenuOpen(true);
      }}
      className={cn(
        "group relative flex items-center rounded-lg text-sm transition-colors",
        active
          ? "bg-card text-foreground shadow-sm ring-1 ring-border"
          : "text-foreground/80 hover:bg-accent/60",
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
      )}

      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          maxLength={80}
          aria-label="Rename conversation"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancel();
          }}
          className="m-1 min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      ) : (
        <>
          <button
            className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left"
            onClick={() => actions.onSelect(chat.id)}
            onDoubleClick={startEdit}
            title={chat.title}
          >
            <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{chat.title}</span>
          </button>

          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger
              aria-label="Conversation options"
              className={cn(
                "mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-opacity hover:bg-background hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring",
                "opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100",
              )}
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[10rem]">
              <DropdownMenuItem onSelect={() => startEdit()}>
                <Pencil />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => actions.onPin(chat.id, !pinned)}
              >
                {pinned ? <PinOff /> : <Pin />}
                {pinned ? "Unpin" : "Pin"}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => actions.onArchive(chat.id)}>
                <Archive />
                Archive
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => actions.onDelete(chat.id)}
                className="text-destructive focus:bg-destructive/10 focus:text-destructive [&_svg]:text-destructive"
              >
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </li>
  );
}
