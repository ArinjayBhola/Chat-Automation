import { cn } from "@/lib/utils";

/**
 * Relay brand mark — an orchestration hub: a central node relaying to three
 * connected services. Monochrome (uses currentColor) so it adapts to any
 * surface. Flat by design — no gradients.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 11 V6" />
      <path d="M12 12.5 L6.5 16.4" />
      <path d="M12 12.5 L17.5 16.4" />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="4.3" r="1.9" />
      <circle cx="5" cy="18" r="1.9" />
      <circle cx="19" cy="18" r="1.9" />
    </svg>
  );
}

/** The mark inside a solid rounded badge (primary background, white mark). */
export function BrandBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground",
        className,
      )}
    >
      <BrandMark className="h-[58%] w-[58%]" />
    </span>
  );
}

/** Full lockup: badge + wordmark. */
export function Logo({
  className,
  badgeClassName,
  showWordmark = true,
}: {
  className?: string;
  badgeClassName?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <BrandBadge className={cn("h-8 w-8", badgeClassName)} />
      {showWordmark && (
        <span className="text-[15px] font-semibold tracking-tight">Relay</span>
      )}
    </span>
  );
}
