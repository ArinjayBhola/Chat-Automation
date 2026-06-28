"use client";

import { Sparkles } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@/components/ui/select";
import { PROVIDER_LABEL, type ModelChoice, type ProviderId } from "@/lib/ai/models";

const PROVIDER_ORDER: ProviderId[] = [
  "anthropic",
  "openai",
  "google",
  "openrouter",
  "groq",
  "opensource",
];

/**
 * Compact, inline model selector designed to sit in the composer toolbar.
 * Renders the active model's label with a chevron; the menu flips upward.
 */
export function ModelPicker({
  models,
  value,
  onChange,
}: {
  models: ModelChoice[];
  value: string;
  onChange: (id: string) => void;
}) {
  const groups = models.reduce<Record<string, ModelChoice[]>>((acc, m) => {
    (acc[m.provider] ??= []).push(m);
    return acc;
  }, {});

  const orderedProviders = PROVIDER_ORDER.filter((p) => groups[p]?.length);
  const selected = models.find((m) => m.id === value);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label="Choose model"
        className="h-8 w-auto max-w-[11rem] justify-start gap-1.5 rounded-lg border-0 bg-transparent px-2 text-xs font-medium text-muted-foreground shadow-none hover:bg-accent hover:text-foreground focus:ring-0 data-[state=open]:bg-accent data-[state=open]:text-foreground"
      >
        {/* Icon and label are sibling children so the trigger's line-clamp
            only affects the label text — keeps the icon to its left. */}
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="truncate">{selected?.label ?? "Select model"}</span>
      </SelectTrigger>
      <SelectContent align="end" className="max-h-72 w-64">
        {orderedProviders.map((provider) => (
          <SelectGroup key={provider}>
            <SelectLabel>{PROVIDER_LABEL[provider]}</SelectLabel>
            {groups[provider].map((m) => (
              <SelectItem key={m.id} value={m.id} disabled={!m.available}>
                <span className="flex items-center gap-2">
                  {m.label}
                  {!m.available && (
                    <span className="text-[10px] text-muted-foreground">
                      · add key
                    </span>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
