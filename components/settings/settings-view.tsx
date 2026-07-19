"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  ArchiveRestore,
  ArrowLeft,
  Inbox,
  KeyRound,
  Loader2,
  LogOut,
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
import { UsageSection } from "@/components/settings/usage-section";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/components/ui/toast";
import { timeAgo } from "@/lib/utils";

type Initial = {
  name: string;
  email: string;
  image: string | null;
  hasPassword: boolean;
  isOAuth: boolean;
};

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

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card/80 px-3 backdrop-blur sm:px-4">
        <Button
          asChild
          variant="ghost"
          size="icon"
          aria-label="Back to chat"
          className="text-muted-foreground"
        >
          <Link href="/chat">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <Logo badgeClassName="h-7 w-7" />
        <h1 className="flex-1 text-sm font-medium text-muted-foreground">
          Settings
        </h1>
        <ThemeToggle />
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

          <UsageSection />

          <ArchivedSection />

          <DataSection />

          <DangerSection />
        </div>
      </div>
    </div>
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
  const { toast } = useToast();
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [saving, setSaving] = useState(false);

  const dirty = name !== initial.name || email !== initial.email;

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          variant: "error",
          title: "Couldn't save changes",
          description: data.error ?? "Please try again.",
        });
        return;
      }
      toast({ variant: "success", title: "Profile updated" });
      await onSaved(data.user?.name ?? name, data.user?.email ?? email);
    } catch {
      toast({
        variant: "error",
        title: "Network error",
        description: "Please try again.",
      });
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
  const { toast } = useToast();
  const [hasPassword, setHasPassword] = useState(initialHasPassword);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const tooShort = next.length > 0 && next.length < 8;
  const mismatch = confirm.length > 0 && next !== confirm;

  async function save() {
    if (next.length < 8) {
      toast({
        variant: "error",
        title: "Password too short",
        description: "Use at least 8 characters.",
      });
      return;
    }
    if (next !== confirm) {
      toast({ variant: "error", title: "Passwords don't match" });
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
        toast({
          variant: "error",
          title: "Couldn't update password",
          description: data.error ?? "Please try again.",
        });
        return;
      }
      setHasPassword(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      toast({
        variant: "success",
        title: hasPassword ? "Password updated" : "Password created",
        description: hasPassword
          ? undefined
          : "You can now sign in with email and password.",
      });
    } catch {
      toast({
        variant: "error",
        title: "Network error",
        description: "Please try again.",
      });
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
          {tooShort && (
            <p className="text-xs text-destructive">
              Use at least 8 characters.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm">Confirm new password</Label>
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {mismatch && (
            <p className="text-xs text-destructive">Passwords don&apos;t match.</p>
          )}
        </div>

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
// Archived conversations (restore / delete)
// ---------------------------------------------------------------------------
type ArchivedChat = {
  id: string;
  title: string;
  updatedAt: string;
};

function ArchivedSection() {
  const [chats, setChats] = useState<ArchivedChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/archived");
      if (!res.ok) return;
      const data: { chats: ArchivedChat[] } = await res.json();
      setChats(data.chats ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function unarchive(id: string) {
    setBusyId(id);
    setChats((prev) => prev.filter((c) => c.id !== id));
    try {
      await fetch(`/api/chat/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false }),
      });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    setChats((prev) => prev.filter((c) => c.id !== id));
    try {
      await fetch(`/api/chat/${id}`, { method: "DELETE" });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Archived conversations</CardTitle>
        <p className="text-sm text-muted-foreground">
          Archived chats are hidden from the sidebar. Restore one to bring it
          back, or delete it permanently.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/60" />
            ))}
          </div>
        ) : chats.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Inbox className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No archived conversations.
            </p>
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {chats.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Updated {timeAgo(c.updatedAt)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  disabled={busyId === c.id}
                  onClick={() => unarchive(c.id)}
                >
                  <ArchiveRestore className="h-4 w-4" />
                  <span className="hidden sm:inline">Restore</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${c.title}`}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive [&_svg]:text-destructive"
                  disabled={busyId === c.id}
                  onClick={() => remove(c.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Data (delete all chats)
// ---------------------------------------------------------------------------
function DataSection() {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function deleteChats() {
    setBusy(true);
    try {
      const res = await fetch("/api/account/chats", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          variant: "error",
          title: "Couldn't delete chats",
          description: data.error ?? "Please try again.",
        });
        return;
      }
      toast({
        variant: "success",
        title:
          data.count > 0
            ? `Deleted ${data.count} conversation${data.count === 1 ? "" : "s"}`
            : "Nothing to delete",
      });
      router.refresh();
    } catch {
      toast({
        variant: "error",
        title: "Network error",
        description: "Please try again.",
      });
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
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function deleteAccount() {
    setBusy(true);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({
          variant: "error",
          title: "Couldn't delete account",
          description: data.error ?? "Please try again.",
        });
        setBusy(false);
        return;
      }
      await signOut({ callbackUrl: "/auth/signin" });
    } catch {
      toast({
        variant: "error",
        title: "Network error",
        description: "Please try again.",
      });
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
