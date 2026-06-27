import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const messages: Record<string, string> = {
    Configuration:
      "There is a problem with the server configuration. Check that AUTH_SECRET and provider credentials are set.",
    AccessDenied: "Access was denied. You may not have permission to sign in.",
    Verification: "The sign-in link is no longer valid.",
    Default: "Something went wrong while signing in.",
  };
  const message = messages[error ?? "Default"] ?? messages.Default;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-semibold">Sign-in error</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <Link
          href="/auth/signin"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-6 text-base font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
