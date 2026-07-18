"use client";

import { Sparkles, BrainCircuit, Cpu, Globe, Router, Zap, Code } from "lucide-react";
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

const PROVIDER_ICONS: Record<ProviderId, React.ElementType> = {
  anthropic: BrainCircuit,
  openai: Cpu,
  google: Globe,
  openrouter: Router,
  groq: Zap,
  opensource: Code,
};

/**
 * Inline model selector for the composer toolbar. Groups models by provider;
 * each row shows the label and a short description. Usage lives in Settings.
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
  const SelectedIcon = selected ? PROVIDER_ICONS[selected.provider] : Sparkles;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label="Choose model"
        className="h-8 w-auto max-w-[12rem] justify-start gap-1.5 rounded-full border border-border/40 bg-background/60 px-2.5 text-[11px] font-medium text-foreground shadow-sm backdrop-blur-md transition-all hover:bg-accent hover:border-border focus:ring-2 focus:ring-primary/20 data-[state=open]:bg-accent data-[state=open]:border-border"
      >
        <SelectedIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="truncate">{selected?.label ?? "Select model"}</span>
      </SelectTrigger>
      <SelectContent align="end" className="max-h-[22rem] w-[18rem] rounded-xl border border-border/50 bg-background/80 p-1 shadow-2xl backdrop-blur-xl">
        {orderedProviders.map((provider) => {
          const Icon = PROVIDER_ICONS[provider];
          return (
            <SelectGroup key={provider} className="mb-1.5 last:mb-0">
              <SelectLabel className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                <Icon className="h-3.5 w-3.5" />
                {PROVIDER_LABEL[provider]}
              </SelectLabel>
              {groups[provider].map((m) => (
                <SelectItem
                  key={m.id}
                  value={m.id}
                  disabled={!m.available}
                  className="mb-0.5 cursor-pointer rounded-lg px-2 py-1.5 transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:opacity-40"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-medium leading-none">
                        {m.label}
                      </span>
                      {!m.available && (
                        <span className="shrink-0 rounded bg-muted/80 px-1 py-0.5 text-[9px] font-medium uppercase tracking-widest text-muted-foreground">
                          Setup
                        </span>
                      )}
                    </div>
                    {m.description && (
                      <p className="line-clamp-1 text-xs leading-snug text-muted-foreground/80">
                        {m.description}
                      </p>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </Select>
  );
}
