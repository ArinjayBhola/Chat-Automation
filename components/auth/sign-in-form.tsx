"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { Bot, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function SignInForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [loading, setLoading] = useState<"google" | "demo" | null>(null);

  return (
    <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-sm">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Bot className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold">Welcome to auto-chat</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your AI assistant for Gmail, Drive, Docs, Calendar &amp; Notion.
        </p>
      </div>

      <div className="space-y-3">
        <Button
          className="w-full"
          size="lg"
          disabled={!googleEnabled || loading !== null}
          onClick={() => {
            setLoading("google");
            signIn("google", { callbackUrl: "/chat" });
          }}
        >
          {loading === "google" ? (
            <Spinner />
          ) : (
            <GoogleGlyph />
          )}
          Continue with Google
        </Button>

        <div className="relative py-1 text-center">
          <span className="bg-card px-2 text-xs uppercase tracking-wide text-muted-foreground">
            or
          </span>
          <div className="absolute inset-x-0 top-1/2 -z-10 h-px bg-border" />
        </div>

        <Button
          variant="outline"
          className="w-full"
          size="lg"
          disabled={loading !== null}
          onClick={() => {
            setLoading("demo");
            signIn("demo", { callbackUrl: "/chat" });
          }}
        >
          {loading === "demo" ? <Spinner /> : <Sparkles className="h-4 w-4" />}
          Try Demo
        </Button>
      </div>

      {!googleEnabled && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Google sign-in isn&apos;t configured on this server. Use{" "}
          <span className="font-medium">Try Demo</span> to explore the full UI
          with mock data.
        </p>
      )}
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
