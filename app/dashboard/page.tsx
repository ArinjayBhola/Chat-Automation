import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/signin");
  }
  return <DashboardClient />;
}
