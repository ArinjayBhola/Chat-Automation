"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  KeyRound,
  Loader2,
  LogOut,
  PanelLeft,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { ToolConnections } from "@/components/chat/tool-connections";
import { AppShell } from "@/components/layout/app-shell";
import type { ChatListItem } from "@/components/chat/chat-history";
import { cn } from "@/lib/utils";

type Initial = {
  name: string;
  email: string;
  image: string | null;
  hasPassword: boolean;
  isOAuth: boolean;
};

type Note = { kind: "ok" | "err"; text: string } | null;

function initials(name?: string | null) {
  if (!name) return "U";
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function SettingsView({ initial }: { initial: Initial }) {
  const router = useRouter();
  const { update } = useSession();
  const [chats, setChats] = useState<ChatListItem[]>([]);

  const refreshChats = useCallback(async () => {
    try {
      const res = await fetch("/api/chat");
      if (!res.ok) return;
      const data: { chats: ChatListItem[] } = await res.json();
      setChats(data.chats ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refreshChats();
  }, [refreshChats]);

  const handleDeleteChat = useCallback(
    async (id: string) => {
      setChats((prev) => prev.filter((c) => c.id !== id));
      try {
        await fetch(`/api/chat/${id}`, { method: "DELETE" });
      } finally {
        refreshChats();
      }
    },
    [refreshChats],
  );

  return (
    <AppShell
      sidebar={{
        user: { name: initial.name, email: initial.email, image: initial.image },
        chats,
        activeChatId: undefined,
        onSelectChat: (id) => router.push(`/chat?c=${id}`),
        onDeleteChat: handleDeleteChat,
        onNewChat: () => router.push("/chat"),
      }}
    >
      {({ toggleSidebar }) => (
        <>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur sm:px-4">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle sidebar"
              onClick={toggleSidebar}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
            <h1 className="flex-1 text-sm font-medium">Settings</h1>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive [&_svg]:text-destructive"
              onClick={() => signOut({ callbackUrl: "/auth/signin" })}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </header>

          <div className="flex-1 overflow-y-auto scrollbar-thin">
            <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">
                  Account settings
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Manage your profile, security, connected tools, and data.
                </p>
              </div>

              <ProfileSection
                initial={initial}
                onSaved={async (name, email) => {
                  await update({ name, email });
                  router.refresh();
                }}
              />

              <PasswordSection
                hasPassword={initial.hasPassword}
                isOAuth={initial.isOAuth}
              />

              <Card>
                <CardHeader>
                  <CardTitle>Connected tools</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Connect or disconnect the services Relay can act on.
                  </p>
                </CardHeader>
                <CardContent>
                  <ToolConnections />
                </CardContent>
              </Card>

              <DataSection />

              <DangerSection />
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------
function ProfileSection({
  initial,
  onSaved,
}: {
  initial: Initial;
  onSaved: (name: string, email: string) => Promise<void>;
}) {
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<Note>(null);

  const dirty = name !== initial.name || email !== initial.email;

  async function save() {
    setNote(null);
    setSaving(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNote({ kind: "err", text: data.error ?? "Couldn't save changes." });
        return;
      }
      setNote({ kind: "ok", text: "Profile updated." });
      await onSaved(data.user?.name ?? name, data.user?.email ?? email);
    } catch {
      setNote({ kind: "err", text: "Network error. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <p className="text-sm text-muted-foreground">
          Update your display name and email address.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14 border">
            {initial.image && (
              <AvatarImage src={initial.image} alt={name || "User"} />
            )}
            <AvatarFallback className="text-lg">
              {initials(name || initial.email)}
            </AvatarFallback>
          </Avatar>
          <p className="text-xs text-muted-foreground">
            {initial.isOAuth
              ? "Signed in with Google."
              : "Email & password account."}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            maxLength={80}
            placeholder="Your name"
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            placeholder="you@example.com"
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <NoteLine note={note} />

        <div className="flex justify-end">
          <Button onClick={save} disabled={!dirty || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Password / credentials
// ---------------------------------------------------------------------------
function PasswordSection({
  hasPassword: initialHasPassword,
  isOAuth,
}: {
  hasPassword: boolean;
  isOAuth: boolean;
}) {
  const [hasPassword, setHasPassword] = useState(initialHasPassword);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<Note>(null);

  async function save() {
    setNote(null);
    if (next.length < 8) {
      setNote({ kind: "err", text: "Password must be at least 8 characters." });
      return;
    }
    if (next !== confirm) {
      setNote({ kind: "err", text: "Passwords don't match." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: hasPassword ? current : undefined,
          newPassword: next,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNote({ kind: "err", text: data.error ?? "Couldn't update password." });
        return;
      }
      setHasPassword(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      setNote({
        kind: "ok",
        text: hasPassword
          ? "Password updated."
          : "Password created — you can now sign in with email and password.",
      });
    } catch {
      setNote({ kind: "err", text: "Network error. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          {hasPassword ? "Password" : "Create a password"}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {hasPassword
            ? "Change the password used for email sign-in."
            : isOAuth
              ? "Add email & password credentials so you can sign in without Google."
              : "Set a password for your account."}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasPassword && (
          <div className="space-y-1.5">
            <Label htmlFor="current">Current password</Label>
            <PasswordInput
              id="current"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="new">New password</Label>
          <PasswordInput
            id="new"
            autoComplete="new-password"
            value={next}
            placeholder="At least 8 characters"
            onChange={(e) => setNext(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm new password</Label>
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        <NoteLine note={note} />

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving || !next}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {hasPassword ? "Update password" : "Create password"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Data (delete all chats)
// ---------------------------------------------------------------------------
function DataSection() {
  const router = useRouter();
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState(false);

  async function deleteChats() {
    setNote(null);
    setBusy(true);
    try {
      const res = await fetch("/api/account/chats", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNote({ kind: "err", text: data.error ?? "Couldn't delete chats." });
        return;
      }
      setNote({
        kind: "ok",
        text:
          data.count > 0
            ? `Deleted ${data.count} conversation${data.count === 1 ? "" : "s"}.`
            : "There were no conversations to delete.",
      });
      router.refresh();
    } catch {
      setNote({ kind: "err", text: "Network error. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversations</CardTitle>
        <p className="text-sm text-muted-foreground">
          Permanently delete every conversation and its messages. This can&apos;t
          be undone.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <NoteLine note={note} />
        <ConfirmButton
          label="Delete all chats"
          confirmLabel="Yes, delete everything"
          icon={<Trash2 className="h-4 w-4" />}
          variant="outline"
          busy={busy}
          onConfirm={deleteChats}
        />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Danger zone (delete account)
// ---------------------------------------------------------------------------
function DangerSection() {
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState(false);

  async function deleteAccount() {
    setNote(null);
    setBusy(true);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setNote({ kind: "err", text: data.error ?? "Couldn't delete account." });
        setBusy(false);
        return;
      }
      await signOut({ callbackUrl: "/auth/signin" });
    } catch {
      setNote({ kind: "err", text: "Network error. Please try again." });
      setBusy(false);
    }
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <TriangleAlert className="h-4 w-4" />
          Danger zone
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Delete your account along with all chats, messages, and tool
          connections. This is permanent.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <NoteLine note={note} />
        <ConfirmButton
          label="Delete account"
          confirmLabel="Permanently delete account"
          icon={<Trash2 className="h-4 w-4" />}
          variant="destructive"
          busy={busy}
          onConfirm={deleteAccount}
        />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------
function NoteLine({ note }: { note: Note }) {
  if (!note) return null;
  return (
    <p
      className={cn(
        "rounded-lg px-3 py-2 text-sm",
        note.kind === "ok"
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "bg-destructive/10 text-destructive",
      )}
    >
      {note.text}
    </p>
  );
}

function ConfirmButton({
  label,
  confirmLabel,
  icon,
  variant,
  busy,
  onConfirm,
}: {
  label: string;
  confirmLabel: string;
  icon: React.ReactNode;
  variant: "outline" | "destructive";
  busy: boolean;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <Button variant={variant} className="gap-2" onClick={() => setArmed(true)}>
        {icon}
        {label}
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="destructive" disabled={busy} onClick={onConfirm}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {confirmLabel}
      </Button>
      <Button variant="ghost" disabled={busy} onClick={() => setArmed(false)}>
        Cancel
      </Button>
    </div>
  );
}
