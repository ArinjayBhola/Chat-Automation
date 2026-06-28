import { cn } from "@/lib/utils";

/** A quiet pulsing placeholder block. No gradients - flat muted surface. */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}
