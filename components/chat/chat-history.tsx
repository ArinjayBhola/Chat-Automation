"use client";

import { useEffect, useRef, useState } from "react";
import { Check, MessageSquare, Pencil, Trash2, X } from "lucide-react";
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
  onRename,
}: {
  chats: ChatListItem[];
  activeChatId?: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) inputRef.current?.select();
  }, [editingId]);

  function startEdit(chat: ChatListItem) {
    setEditingId(chat.id);
    setDraft(chat.title);
  }

  function commit() {
    if (editingId) {
      const next = draft.trim();
      if (next) onRename(editingId, next);
    }
    setEditingId(null);
  }

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
            const editing = editingId === chat.id;
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

                {editing ? (
                  <div className="flex w-full items-center gap-1 px-2 py-1.5">
                    <input
                      ref={inputRef}
                      value={draft}
                      maxLength={80}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commit();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <button
                      className="rounded-md p-1 text-muted-foreground hover:text-emerald-600"
                      aria-label="Save name"
                      onClick={commit}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="rounded-md p-1 text-muted-foreground hover:text-destructive"
                      aria-label="Cancel rename"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left"
                      onClick={() => onSelect(chat.id)}
                      onDoubleClick={() => startEdit(chat)}
                    >
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{chat.title}</span>
                    </button>
                    <div className="mr-1 flex items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                      <button
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"
                        aria-label="Rename chat"
                        onClick={() => startEdit(chat)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-destructive"
                        aria-label="Delete chat"
                        onClick={() => onDelete(chat.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
