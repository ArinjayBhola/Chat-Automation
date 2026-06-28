"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "./header";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
import type { ChatListItem } from "./chat-history";
import { AppShell } from "@/components/layout/app-shell";
import { useChat } from "@/lib/hooks/use-chat";
import type { ModelChoice } from "@/lib/ai/models";

type SessionUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export function ChatInterface({
  user,
  models,
  defaultModelId,
}: {
  user: SessionUser;
  models: ModelChoice[];
  defaultModelId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [chats, setChats] = useState<ChatListItem[]>([]);

  const {
    messages,
    isSending,
    modelId,
    chatId,
    setModelId,
    send,
    resolveApproval,
    reset,
    loadChat,
  } = useChat(defaultModelId);

  const refreshChats = useCallback(async () => {
    try {
      const res = await fetch("/api/chat");
      if (!res.ok) return;
      const data: { chats: ChatListItem[] } = await res.json();
      setChats(data.chats ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  // Load list on mount and refresh whenever a (new) chat becomes active.
  useEffect(() => {
    refreshChats();
  }, [refreshChats, chatId]);

  // Open a specific chat when arrived via `/chat?c=<id>` (e.g. from settings),
  // then strip the param so refreshes don't reload it.
  const openedFromUrl = useRef(false);
  useEffect(() => {
    const c = searchParams.get("c");
    if (c && !openedFromUrl.current) {
      openedFromUrl.current = true;
      loadChat(c);
      router.replace("/chat");
    }
  }, [searchParams, loadChat, router]);

  const handleSelectChat = useCallback(
    (id: string) => {
      loadChat(id);
    },
    [loadChat],
  );

  const handleDeleteChat = useCallback(
    async (id: string) => {
      setChats((prev) => prev.filter((c) => c.id !== id));
      if (id === chatId) reset();
      try {
        await fetch(`/api/chat/${id}`, { method: "DELETE" });
      } finally {
        refreshChats();
      }
    },
    [chatId, reset, refreshChats],
  );

  const handleRenameChat = useCallback(
    async (id: string, title: string) => {
      setChats((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title } : c)),
      );
      try {
        await fetch(`/api/chat/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
      } finally {
        refreshChats();
      }
    },
    [refreshChats],
  );

  const activeTitle = chats.find((c) => c.id === chatId)?.title ?? "New chat";

  return (
    <AppShell
      sidebar={{
        user,
        chats,
        activeChatId: chatId,
        onSelectChat: handleSelectChat,
        onDeleteChat: handleDeleteChat,
        onRenameChat: handleRenameChat,
        onNewChat: reset,
      }}
    >
      {({ toggleSidebar }) => (
        <>
          <Header
            title={activeTitle}
            onToggleSidebar={toggleSidebar}
            onNewChat={reset}
          />
          <MessageList
            messages={messages}
            userName={user.name}
            onApprove={(id, fields) => resolveApproval(id, "approved", fields)}
            onSkip={(id) => resolveApproval(id, "skipped")}
            onSuggestion={send}
          />
          <MessageInput
            disabled={isSending}
            onSend={send}
            models={models}
            modelId={modelId}
            onModelChange={setModelId}
          />
        </>
      )}
    </AppShell>
  );
}
