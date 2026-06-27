"use client";

import { useCallback, useRef, useState } from "react";
import { uid } from "@/lib/utils";
import type {
  ApprovalField,
  ChatResponse,
  ClientMessage,
} from "@/lib/types";

const WELCOME: ClientMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "👋 Hi! I'm your AI assistant. Ask me to check emails, organize files, " +
    "summarize your week, or draft a message — I'll plan the steps, use the " +
    "right tools, and ask before doing anything with real consequences.",
  createdAt: new Date().toISOString(),
  toolsUsed: [],
  steps: [],
};

export function useChat(initialModelId: string) {
  const [messages, setMessages] = useState<ClientMessage[]>([WELCOME]);
  const [isSending, setIsSending] = useState(false);
  const [modelId, setModelId] = useState(initialModelId);
  const chatIdRef = useRef<string | undefined>(undefined);

  const patchMessage = useCallback(
    (id: string, patch: Partial<ClientMessage>) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      );
    },
    [],
  );

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || isSending) return;

      const userMsg: ClientMessage = {
        id: uid("msg"),
        role: "user",
        content,
        createdAt: new Date().toISOString(),
        toolsUsed: [],
        steps: [],
      };
      const thinkingId = uid("msg");
      const thinking: ClientMessage = {
        id: thinkingId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
        toolsUsed: [],
        steps: [],
        thinking: true,
      };

      setMessages((prev) => [...prev, userMsg, thinking]);
      setIsSending(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content,
            chatId: chatIdRef.current,
            modelId,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? `Request failed (${res.status})`);
        }

        const data: ChatResponse = await res.json();
        chatIdRef.current = data.chatId;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === thinkingId ? { ...data.message, id: thinkingId } : m,
          ),
        );
      } catch (e) {
        patchMessage(thinkingId, {
          thinking: false,
          content:
            "⚠️ " +
            (e instanceof Error ? e.message : "Something went wrong.") +
            "\n\nPlease try again.",
        });
      } finally {
        setIsSending(false);
      }
    },
    [isSending, modelId, patchMessage],
  );

  const resolveApproval = useCallback(
    (
      messageId: string,
      decision: "approved" | "skipped",
      editedFields?: ApprovalField[],
    ) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId || !m.approval) return m;
          const approval = {
            ...m.approval,
            status: decision,
            fields: editedFields ?? m.approval.fields,
            timeoutSeconds: undefined,
          };
          const steps = m.steps.map((s) =>
            s.status === "needs_approval"
              ? {
                  ...s,
                  status:
                    decision === "approved"
                      ? ("success" as const)
                      : ("pending" as const),
                  detail:
                    decision === "approved"
                      ? "Approved and executed (demo)."
                      : "Skipped by user.",
                }
              : s,
          );
          return { ...m, approval, steps };
        }),
      );
    },
    [],
  );

  const reset = useCallback(() => {
    chatIdRef.current = undefined;
    setMessages([WELCOME]);
  }, []);

  return {
    messages,
    isSending,
    modelId,
    setModelId,
    send,
    resolveApproval,
    reset,
  };
}
