export default function SportLoading() {
  return (
    <div className="wrapper py-8 space-y-8 animate-pulse">
      {/* Hero skeleton */}
      <div className="text-center py-10 space-y-4">
        <div className="h-12 bg-gray-200 dark:bg-gray-800 rounded-full max-w-sm mx-auto" />
        <div className="h-5 bg-gray-200 dark:bg-gray-800 rounded-full max-w-xs mx-auto" />
        <div className="flex justify-center gap-6 mt-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="text-center space-y-1">
              <div className="h-7 w-12 bg-gray-200 dark:bg-gray-800 rounded mx-auto" />
              <div className="h-3 w-10 bg-gray-200 dark:bg-gray-800 rounded mx-auto" />
            </div>
          ))}
        </div>
      </div>
      {/* Filter skeleton */}
      <div className="h-11 bg-gray-200 dark:bg-gray-800 rounded-full" />
      {/* Cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-200 dark:border-gray-700/50 overflow-hidden">
            <div className="h-44 bg-gray-200 dark:bg-gray-800" />
            <div className="p-5 space-y-3">
              <div className="h-5 bg-gray-200 dark:bg-gray-800 rounded w-3/4" />
              <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/2" />
              <div className="flex justify-between mt-4">
                <div className="h-7 bg-gray-200 dark:bg-gray-800 rounded w-20" />
                <div className="h-7 bg-gray-200 dark:bg-gray-800 rounded-full w-20" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
