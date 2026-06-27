import { AuthShell } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/auth/auth-form";

export default function SignUpPage() {
  return (
    <AuthShell>
      <AuthForm initialMode="signup" />
    </AuthShell>
  );
}
