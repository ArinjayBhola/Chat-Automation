import { Skeleton } from "@/components/ui/skeleton";

/** Loading placeholder for the sidebar body - mirrors the real layout. */
export function SidebarSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="px-3">
        <Skeleton className="h-9 w-full" />
      </div>
      <div className="px-3 pt-3">
        <Skeleton className="h-9 w-full" />
      </div>
      <div className="flex-1 space-y-5 px-3 py-4">
        {[5, 4].map((count, group) => (
          <div key={group} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <div className="space-y-1.5">
              {Array.from({ length: count }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="h-8"
                  style={{ width: `${70 + ((i * 7) % 25)}%` }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t p-3">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2.5 w-32" />
          </div>
        </div>
      </div>
    </div>
  );
}
