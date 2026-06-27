"use client";

import { useCallback, useRef, useState } from "react";
import { uid } from "@/lib/utils";
import type { AgentEvent } from "@/lib/agent/events";
import type {
  ApprovalField,
  ClientMessage,
  Step,
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
  // Mirror messages so send() can read history without being recreated.
  const messagesRef = useRef<ClientMessage[]>([WELCOME]);
  messagesRef.current = messages;

  const patchMessage = useCallback(
    (id: string, fn: (m: ClientMessage) => ClientMessage) => {
      setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)));
    },
    [],
  );

  const applyEvent = useCallback(
    (id: string, event: AgentEvent) => {
      switch (event.type) {
        case "text":
          patchMessage(id, (m) => ({
            ...m,
            thinking: false,
            content: m.content + event.value,
          }));
          break;
        case "step":
          patchMessage(id, (m) => {
            const exists = m.steps.some((s) => s.id === event.step.id);
            const steps: Step[] = exists
              ? m.steps.map((s) => (s.id === event.step.id ? event.step : s))
              : [...m.steps, event.step];
            return { ...m, thinking: false, steps };
          });
          break;
        case "approval":
          patchMessage(id, (m) => ({
            ...m,
            thinking: false,
            approval: event.approval,
          }));
          break;
        case "tools":
          patchMessage(id, (m) => ({ ...m, toolsUsed: event.tools }));
          break;
        case "error":
          patchMessage(id, (m) => ({
            ...m,
            thinking: false,
            content: m.content + `\n\n⚠️ ${event.message}`,
          }));
          break;
        case "done":
          patchMessage(id, (m) => ({ ...m, thinking: false }));
          break;
      }
    },
    [patchMessage],
  );

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || isSending) return;

      const history = messagesRef.current
        .filter((m) => m.id !== "welcome" && !m.thinking && m.content)
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content }));

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
            history,
          }),
        });

        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? `Request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let nl: number;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line) continue;
            try {
              applyEvent(thinkingId, JSON.parse(line) as AgentEvent);
            } catch {
              /* ignore malformed line */
            }
          }
        }
      } catch (e) {
        patchMessage(thinkingId, (m) => ({
          ...m,
          thinking: false,
          content:
            (m.content ? m.content + "\n\n" : "") +
            "⚠️ " +
            (e instanceof Error ? e.message : "Something went wrong.") +
            "\n\nPlease try again.",
        }));
      } finally {
        setIsSending(false);
      }
    },
    [isSending, modelId, applyEvent, patchMessage],
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
                      ? "Approved (execution wired in Phase 4)."
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
