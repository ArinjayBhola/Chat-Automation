"use client";

import { useState } from "react";
import { Bot, Check, Copy, User as UserIcon } from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import { TOOL_META } from "@/lib/types";
import type { ApprovalField, ClientMessage } from "@/lib/types";
import { StepsList } from "./steps-list";
import { ApprovalPanel } from "./approval-panel";

type Props = {
  message: ClientMessage;
  onApprove: (messageId: string, fields: ApprovalField[]) => void;
  onSkip: (messageId: string) => void;
};

export function MessageBubble({ message, onApprove, onSkip }: Props) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div
      className={cn(
        "flex animate-fade-in gap-3",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
        )}
      >
        {isUser ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div className={cn("min-w-0 max-w-[85%]", isUser && "items-end")}>
        <div
          className={cn(
            "group relative rounded-2xl px-4 py-2.5 text-sm",
            isUser
              ? "bg-primary text-primary-foreground"
              : "border bg-card text-card-foreground",
          )}
        >
          {message.thinking ? (
            <ThinkingDots />
          ) : (
            <div className="whitespace-pre-wrap break-words leading-relaxed">
              {message.content}
            </div>
          )}

          {!isUser && !message.thinking && message.content && (
            <button
              onClick={copy}
              aria-label="Copy message"
              className="absolute -right-2 -top-2 hidden rounded-md border bg-background p-1 text-muted-foreground shadow-sm hover:text-foreground group-hover:block"
            >
              {copied ? (
                <Check className="h-3 w-3 text-emerald-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </button>
          )}
        </div>

        {/* Tool chips */}
        {message.toolsUsed.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {message.toolsUsed.map((t) => (
              <span
                key={t}
                className="rounded-full border bg-background px-2 py-0.5 text-[10px] text-muted-foreground"
              >
                {TOOL_META[t].name}
              </span>
            ))}
          </div>
        )}

        {!isUser && <StepsList steps={message.steps} />}

        {message.approval && (
          <ApprovalPanel
            approval={message.approval}
            onApprove={(fields) => onApprove(message.id, fields)}
            onSkip={() => onSkip(message.id)}
          />
        )}

        {!message.thinking && (
          <p
            className={cn(
              "mt-1 text-[10px] text-muted-foreground",
              isUser ? "text-right" : "text-left",
            )}
          >
            {formatTime(message.createdAt)}
          </p>
        )}
      </div>
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 py-1 text-muted-foreground">
      <span className="text-xs">thinking</span>
      <span className="flex gap-1">
        {[0, 150, 300].map((d) => (
          <span
            key={d}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
            style={{ animationDelay: `${d}ms` }}
          />
        ))}
      </span>
    </div>
  );
}
