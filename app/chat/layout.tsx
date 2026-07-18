import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ChatInterface } from "@/components/chat/chat-interface";
import { DEFAULT_MODEL_ID, listModels } from "@/lib/ai/models";

/**
 * Chat shell layout. It renders the chat UI once and PERSISTS it across both
 * `/chat` (new chat) and `/chat/[chatId]` (a specific chat), so navigating
 * between chats never remounts the interface or loses in-flight streamed
 * messages. The page segments are intentionally empty markers; ChatInterface
 * reads the active chat id from the route param.
 */
export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/signin");
  }
  // `children` are the empty route markers; kept in the tree so route changes
  // still resolve while the chat UI above persists.
  void children;

  const models = listModels();
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
