"use client";

import { useEffect, useRef } from "react";
import { MessageBubble } from "./message-bubble";
import { Suggestions } from "./suggestions";
import { BrandBadge } from "@/components/brand/logo";
import type { ApprovalField, ClientMessage } from "@/lib/types";

type Props = {
  messages: ClientMessage[];
  userName?: string | null;
  onApprove: (messageId: string, fields: ApprovalField[]) => void;
  onSkip: (messageId: string) => void;
  onSuggestion: (prompt: string) => void;
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function MessageList({
  messages,
  userName,
  onApprove,
  onSkip,
  onSuggestion,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // A fresh conversation is just the seeded welcome message — show a hero
  // instead of rendering that as a bubble.
  const isFresh = messages.length === 1 && messages[0]?.id === "welcome";

  if (isFresh) {
    const firstName = userName?.split(" ")[0];
    return (
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center px-4 py-10">
          <div className="animate-slide-up text-center">
            <BrandBadge className="mx-auto h-12 w-12 rounded-2xl" />
            <h1 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">
              {greeting()}
              {firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              I&apos;m Relay. Connect your tools, then ask me to check email,
              organise files, summarise your week, or draft a message. I plan
              each step and always ask before anything with real consequences.
            </p>
          </div>

          <div className="mt-8 w-full animate-slide-up [animation-delay:80ms]">
            <Suggestions onPick={onSuggestion} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:py-8">
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            onApprove={onApprove}
            onSkip={onSkip}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
