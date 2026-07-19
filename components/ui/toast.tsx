"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertCircle, Info, Bell, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "default" | "success" | "error" | "info";

export type ToastOptions = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Milliseconds before auto-dismiss. 0 keeps it until dismissed. */
  duration?: number;
};

type ToastItem = Required<Omit<ToastOptions, "duration">> & {
  id: string;
  duration: number;
};

type ToastApi = {
  toast: (opts: ToastOptions) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const DEFAULT_DURATION = 4500;
const MAX_VISIBLE = 4;

/**
 * App-wide toast provider. Renders a single portalled viewport (bottom-right on
 * desktop, full-width bottom on mobile) fed by an in-memory queue. Announced via
 * an aria-live region so screen readers hear transient feedback.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((opts: ToastOptions) => {
    const id = Math.random().toString(36).slice(2);
    const item: ToastItem = {
      id,
      title: opts.title,
      description: opts.description ?? "",
      variant: opts.variant ?? "default",
      duration: opts.duration ?? DEFAULT_DURATION,
    };
    // Keep the newest at the bottom; cap how many pile up at once.
    setToasts((prev) => [...prev, item].slice(-MAX_VISIBLE));
    return id;
  }, []);

  const api = useMemo<ToastApi>(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {mounted &&
        createPortal(
          <div
            aria-live="polite"
            aria-relevant="additions"
            className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end"
          >
            {toasts.map((t) => (
              <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

const VARIANTS: Record<
  ToastVariant,
  { icon: typeof Info; ring: string; iconColor: string }
> = {
  default: {
    icon: Bell,
    ring: "border-border",
    iconColor: "text-muted-foreground",
  },
  success: {
    icon: CheckCircle2,
    ring: "border-emerald-500/30",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  error: {
    icon: AlertCircle,
    ring: "border-destructive/40",
    iconColor: "text-destructive",
  },
  info: {
    icon: Info,
    ring: "border-primary/30",
    iconColor: "text-primary",
  },
};

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: () => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(() => {
    if (toast.duration <= 0) return;
    timer.current = setTimeout(onDismiss, toast.duration);
  }, [toast.duration, onDismiss]);

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // Auto-dismiss; pause while hovered/focused so it can be read.
  useEffect(() => {
    start();
    return stop;
  }, [start, stop]);

  const meta = VARIANTS[toast.variant];
  const Icon = meta.icon;

  return (
    <div
      role="status"
      onMouseEnter={stop}
      onMouseLeave={start}
      onFocus={stop}
      onBlur={start}
      className={cn(
        "pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 rounded-xl border bg-card/95 p-3.5 shadow-lg backdrop-blur-md",
        meta.ring,
      )}
    >
      <Icon className={cn("mt-0.5 h-[18px] w-[18px] shrink-0", meta.iconColor)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {toast.description}
          </p>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={onDismiss}
        className="-m-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within <ToastProvider>");
  }
  return ctx;
}
