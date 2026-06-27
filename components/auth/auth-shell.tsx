import { Check } from "lucide-react";
import { BrandMark } from "@/components/brand/logo";
import type { ReactNode } from "react";

const POINTS = [
  "Works across Gmail, Drive, Docs, Calendar and Notion",
  "Plans multi-step tasks and runs them for you",
  "Always asks before sending or changing anything",
];

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel (flat dark neutral, no gradient) */}
      <aside className="relative hidden flex-col justify-between bg-zinc-900 p-10 text-zinc-100 lg:flex">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
            <BrandMark className="h-5 w-5 text-white" />
          </span>
          <span className="text-lg font-semibold tracking-tight text-white">
            Relay
          </span>
        </div>

        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight text-white">
            One assistant for all your everyday tools.
          </h2>
          <p className="mt-3 text-zinc-400">
            Give Relay a plain-English instruction and it orchestrates your
            tools, asking for approval before anything with real consequences.
          </p>
          <ul className="mt-8 space-y-3">
            {POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-zinc-200">
                  <Check className="h-3 w-3" />
                </span>
                <span className="text-sm text-zinc-300">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-zinc-500">
          Your data stays yours. Tokens are encrypted and actions need your
          approval.
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex items-center justify-center bg-background px-4 py-10">
        {/* Compact brand for small screens */}
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <BrandMark className="h-4 w-4" />
            </span>
            <span className="font-semibold tracking-tight">Relay</span>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
