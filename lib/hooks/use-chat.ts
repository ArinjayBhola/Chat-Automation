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
    "Hi, I'm Relay. Connect your tools in the sidebar, then ask me to check " +
    "email, organise files, summarise your week, or draft a message. I plan the " +
    "steps, use only the tools I need, and always ask before doing anything with " +
    "real consequences.",
  createdAt: new Date().toISOString(),
  toolsUsed: [],
  steps: [],
};

export function useChat(initialModelId: string) {
  const [messages, setMessages] = useState<ClientMessage[]>([WELCOME]);
  const [isSending, setIsSending] = useState(false);
  const [modelId, setModelId] = useState(initialModelId);
  const [chatId, setChatIdState] = useState<string | undefined>(undefined);
  const chatIdRef = useRef<string | undefined>(undefined);
  const setChatId = useCallback((id: string | undefined) => {
    chatIdRef.current = id;
    setChatIdState(id);
  }, []);
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
        case "meta":
          if (chatIdRef.current !== event.chatId) setChatId(event.chatId);
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
    async (
      messageId: string,
      decision: "approved" | "skipped",
      editedFields?: ApprovalField[],
    ) => {
      const msg = messagesRef.current.find((m) => m.id === messageId);
      const approval = msg?.approval;
      if (!approval) return;
      const fields = editedFields ?? approval.fields;

      // Call the server to execute (approve) or record (skip).
      const executed = decision === "approved";
      let detail =
        decision === "approved"
          ? "Approved and executed."
          : "Skipped by user.";
      let failure: string | null = null;

      try {
        const path = decision === "approved" ? "approve" : "skip";
        const res = await fetch(`/api/approvals/${approval.id}/${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields }),
        });
        const data = await res.json().catch(() => ({}));
        if (decision === "approved") {
          if (res.ok && data.ok) {
            detail = data.summary ?? "Approved and executed.";
          } else if (data.error) {
            failure = data.error as string; // execution failed → allow retry
          }
        }
      } catch {
        // network issue — fall back to local marking
      }

      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId || !m.approval) return m;

          if (failure) {
            // Keep the approval pending so the user can edit/retry.
            return {
              ...m,
              content:
                m.content + `\n\n⚠️ Couldn't complete the action: ${failure}`,
              approval: { ...m.approval, fields, timeoutSeconds: undefined },
            };
          }

          const updatedApproval = {
            ...m.approval,
            status: decision,
            fields,
            timeoutSeconds: undefined,
          };
          const steps = m.steps.map((s) =>
            s.status === "needs_approval"
              ? {
                  ...s,
                  status: executed
                    ? ("success" as const)
                    : ("pending" as const),
                  detail,
                }
              : s,
          );
          return { ...m, approval: updatedApproval, steps };
        }),
      );
    },
    [],
  );

  const reset = useCallback(() => {
    setChatId(undefined);
    setMessages([WELCOME]);
  }, [setChatId]);

  const loadChat = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/chat/${id}`);
        if (!res.ok) return;
        const data: { messages: ClientMessage[] } = await res.json();
        setChatId(id);
        setMessages(data.messages.length ? data.messages : [WELCOME]);
      } catch {
        /* ignore load failure */
      }
    },
    [setChatId],
  );

  return {
    messages,
    isSending,
    modelId,
    chatId,
    setModelId,
    send,
    resolveApproval,
    reset,
    loadChat,
  };
}
