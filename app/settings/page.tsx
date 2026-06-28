import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUserById } from "@/lib/db-queries";
import { SettingsView } from "@/components/settings/settings-view";

export const metadata = { title: "Settings · Relay" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/signin");
  }

  const user = await getUserById(session.user.id);

  return (
    <SettingsView
      initial={{
        name: user?.name ?? session.user.name ?? "",
        email: user?.email ?? session.user.email ?? "",
        image: user?.picture ?? session.user.image ?? null,
        hasPassword: Boolean(user?.passwordHash),
        isOAuth: Boolean(user?.googleId),
      }}
    />
  );
}
