import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { WorkflowBuilder } from "@/components/workflow/workflow-builder";

export const metadata = { title: "Workflow editor" };

export default async function WorkflowEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/signin");
  }
  const { id } = await params;
  return <WorkflowBuilder initialWorkflowId={id} />;
}
