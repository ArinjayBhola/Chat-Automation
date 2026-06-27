import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ChatInterface } from "@/components/chat/chat-interface";
import { DEFAULT_MODEL_ID, listModels } from "@/lib/ai/models";

export default async function ChatPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/signin");
  }

  const models = listModels();
  // Prefer the configured default if available, else the first available model.
  const firstAvailable = models.find((m) => m.available);
  const defaultModelId =
    (models.find((m) => m.id === DEFAULT_MODEL_ID)?.available
      ? DEFAULT_MODEL_ID
      : undefined) ??
    firstAvailable?.id ??
    DEFAULT_MODEL_ID;

  return (
    <ChatInterface
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }}
      models={models}
      defaultModelId={defaultModelId}
    />
  );
}
