// Loading skeleton components for smooth UX during data fetching

export function SkeletonCard() {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-white/5" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-24 rounded bg-white/5" />
          <div className="h-2 w-32 rounded bg-white/5" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-2 w-full rounded bg-white/5" />
        <div className="h-2 w-3/4 rounded bg-white/5" />
      </div>
    </div>
  );
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 animate-pulse">
          <div className="w-8 h-8 rounded-lg bg-white/5" />
          <div className="flex-1 space-y-2">
            <div className="h-2.5 w-1/3 rounded bg-white/5" />
            <div className="h-2 w-1/2 rounded bg-white/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-2.5 rounded bg-white/5" style={{ width: `${100 - (i * 15)}%` }} />
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return <DashboardSkeleton />;
}

// --- Dashboard skeleton ---
export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-7 w-48 rounded bg-white/5" />
        <div className="h-4 w-72 rounded bg-white/5" />
      </div>
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
            <div className="h-3 w-16 rounded bg-white/5 mb-3" />
            <div className="h-7 w-20 rounded bg-white/5 mb-2" />
            <div className="h-2 w-12 rounded bg-white/5" />
          </div>
        ))}
      </div>
      {/* Tool grid */}
      <SkeletonGrid count={6} />
    </div>
  );
}

// --- AI Workspace skeleton ---
export function WorkspaceSkeleton() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] animate-pulse">
      {/* Sidebar skeleton */}
      <div className="w-64 border-r border-white/5 p-4 space-y-3 hidden lg:block">
        {Array.from({ length: 3 }).map((_, gi) => (
          <div key={gi}>
            <div className="h-3 w-16 rounded bg-white/5 mb-2" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl mb-1">
                <div className="w-5 h-5 rounded-lg bg-white/5" />
                <div className="h-3 flex-1 rounded bg-white/5" />
              </div>
            ))}
          </div>
        ))}
      </div>
      {/* Main content skeleton */}
      <div className="flex-1 p-6 space-y-4">
        <div className="h-10 w-full rounded-xl bg-white/5" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
              <div className="w-10 h-10 rounded-xl bg-white/5 mb-3" />
              <div className="h-3 w-24 rounded bg-white/5 mb-2" />
              <div className="h-2 w-32 rounded bg-white/5" />
            </div>
          ))}
        </div>
      </div>
      {/* AI Assistant skeleton */}
      <div className="w-80 border-l border-white/5 p-4 space-y-3 hidden xl:block">
        <div className="h-3 w-20 rounded bg-white/5 mb-4" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-white/[0.03] p-3 space-y-2">
            <div className="h-2 w-3/4 rounded bg-white/5" />
            <div className="h-2 w-1/2 rounded bg-white/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

// --- CV Builder skeleton ---
export function CVBuilderSkeleton() {
  return (
    <div className="flex gap-6 animate-pulse">
      {/* Editor form skeleton */}
      <div className="flex-1 space-y-5">
        <div className="h-8 w-40 rounded bg-white/5" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-3">
            <div className="h-4 w-28 rounded bg-white/5" />
            <div className="h-10 w-full rounded-xl bg-white/5" />
            <div className="h-10 w-full rounded-xl bg-white/5" />
          </div>
        ))}
      </div>
      {/* Preview skeleton */}
      <div className="w-[400px] flex-shrink-0 bg-white/[0.03] border border-white/10 rounded-2xl p-6 space-y-4">
        <div className="h-16 w-16 rounded-full bg-white/5" />
        <div className="h-5 w-32 rounded bg-white/5" />
        <div className="h-3 w-48 rounded bg-white/5" />
        <div className="space-y-2 pt-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-2.5 rounded bg-white/5" style={{ width: `${90 - i * 8}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Files skeleton ---
export function FilesSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-32 rounded bg-white/5" />
          <div className="h-3 w-48 rounded bg-white/5" />
        </div>
        <div className="h-9 w-28 rounded-xl bg-white/5" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white/5" />
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 w-20 rounded bg-white/5" />
                <div className="h-2 w-12 rounded bg-white/5" />
              </div>
            </div>
            <div className="h-2 w-16 rounded bg-white/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Projects skeleton ---
export function ProjectsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-white/5" />
        <div className="space-y-2">
          <div className="h-5 w-40 rounded bg-white/5" />
          <div className="h-3 w-56 rounded bg-white/5" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/5" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 rounded bg-white/5" />
                <div className="h-2 w-20 rounded bg-white/5" />
              </div>
              <div className="h-6 w-16 rounded-lg bg-white/5" />
            </div>
            <div className="h-2 w-3/4 rounded bg-white/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
