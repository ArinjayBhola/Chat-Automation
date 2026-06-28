import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { WorkflowBuilder } from "@/components/workflow/workflow-builder";

export const metadata = { title: "Workflows" };

export default async function WorkflowsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/signin");
  }
  return <WorkflowBuilder />;
}
