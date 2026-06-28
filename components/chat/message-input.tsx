"use client";

import { useRef, useState } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ModelPicker } from "./model-picker";
import type { ModelChoice } from "@/lib/ai/models";

const MAX = 8000;

export function MessageInput({
  disabled,
  onSend,
  models,
  modelId,
  onModelChange,
}: {
  disabled: boolean;
  onSend: (text: string) => void;
  models: ModelChoice[];
  modelId: string;
  onModelChange: (id: string) => void;
}) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  function autosize() {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
    requestAnimationFrame(() => {
      if (taRef.current) taRef.current.style.height = "auto";
    });
  }

  const canSend = value.trim().length > 0 && !disabled;
  const nearLimit = value.length > MAX * 0.9;

  return (
    <div className="border-t bg-background px-4 pb-4 pt-3">
      <div className="mx-auto max-w-3xl">
        <div
          className={cn(
            "rounded-2xl border bg-card shadow-sm transition-all",
            focused ? "border-primary/50 ring-2 ring-primary/15" : "border-border",
            disabled && "opacity-70",
          )}
        >
          <textarea
            ref={taRef}
            value={value}
            disabled={disabled}
            rows={1}
            maxLength={MAX}
            placeholder="Ask Relay to check email, plan your week, draft a message…"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => {
              setValue(e.target.value);
              autosize();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            className="max-h-[200px] min-h-[2.75rem] w-full resize-none bg-transparent px-4 py-3 text-base font-medium leading-relaxed placeholder:font-medium placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed"
          />

          {/* Toolbar: everything sits to the right — model selector next to send. */}
          <div className="flex items-center justify-end gap-1 px-2 pb-2 pt-1">
            {nearLimit && (
              <span className="mr-1 text-[10px] tabular-nums text-destructive">
                {value.length.toLocaleString()}/{MAX.toLocaleString()}
              </span>
            )}
            <ModelPicker
              models={models}
              value={modelId}
              onChange={onModelChange}
            />
            <button
              type="button"
              aria-label="Send message"
              disabled={!canSend}
              onClick={submit}
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                canSend
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {disabled ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <p className="mt-1.5 px-1.5 text-center text-[10px] text-muted-foreground">
          <kbd className="font-sans font-medium text-foreground/70">Enter</kbd> to
          send · <kbd className="font-sans font-medium text-foreground/70">Shift+Enter</kbd>{" "}
          for newline
        </p>
      </div>
    </div>
  );
}
