export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top subtle indeterminate progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-stone-100 overflow-hidden">
        <div className="h-full bg-linear-to-r from-amber-500 via-amber-600 to-sky-500 animate-pulse w-full" />
      </div>

      {/* Header skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 pb-5">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-stone-200 rounded-lg animate-pulse" />
          <div className="h-4 w-72 bg-stone-100 rounded animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-28 bg-stone-100 rounded-lg animate-pulse" />
          <div className="h-9 w-32 bg-stone-200 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Content skeleton cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-stone-200 bg-white p-5 space-y-3 shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 bg-stone-200 rounded animate-pulse" />
              <div className="h-6 w-6 bg-stone-100 rounded-full animate-pulse" />
            </div>
            <div className="h-8 w-16 bg-stone-200 rounded animate-pulse" />
            <div className="h-3 w-32 bg-stone-100 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Main Table skeleton */}
      <div className="rounded-xl border border-stone-200 bg-white shadow-2xs overflow-hidden p-6 space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-stone-100">
          <div className="h-5 w-40 bg-stone-200 rounded animate-pulse" />
          <div className="h-8 w-24 bg-stone-100 rounded-lg animate-pulse" />
        </div>
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4, 5].map((row) => (
            <div
              key={row}
              className="flex items-center justify-between gap-4 py-2 border-b border-stone-50"
            >
              <div className="h-4 w-20 bg-stone-200 rounded animate-pulse" />
              <div className="h-4 w-64 bg-stone-100 rounded animate-pulse flex-1" />
              <div className="h-6 w-16 bg-stone-100 rounded-full animate-pulse" />
              <div className="h-8 w-20 bg-stone-200 rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
