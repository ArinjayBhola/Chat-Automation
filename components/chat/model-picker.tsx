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
 * Inline model selector for the composer toolbar. Groups models by provider and
 * shows each model's label + short description. (Usage lives in Settings.)
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
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="truncate">{selected?.label ?? "Select model"}</span>
      </SelectTrigger>
      <SelectContent align="end" className="max-h-96 w-[19rem]">
        {orderedProviders.map((provider, i) => (
          <SelectGroup key={provider} className={i > 0 ? "mt-1" : undefined}>
            <SelectLabel>{PROVIDER_LABEL[provider]}</SelectLabel>
            {groups[provider].map((m) => (
              <SelectItem
                key={m.id}
                value={m.id}
                disabled={!m.available}
                className="py-2"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {m.label}
                    </span>
                    {!m.available && (
                      <span className="shrink-0 rounded border border-border px-1 py-px text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                        add key
                      </span>
                    )}
                  </div>
                  {m.description && (
                    <p className="truncate text-[11px] leading-snug text-muted-foreground">
                      {m.description}
                    </p>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
