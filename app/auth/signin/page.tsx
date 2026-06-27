import { SignInForm } from "@/components/auth/sign-in-form";
import { isGoogleAuthConfigured } from "@/lib/auth";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted px-4">
      <SignInForm googleEnabled={isGoogleAuthConfigured} />
    </main>
  );
}
